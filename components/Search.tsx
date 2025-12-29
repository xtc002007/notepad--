import React, { useState, useEffect, useRef } from 'react';
import { Search as SearchIcon, FileText, Hash, ArrowRight, File } from 'lucide-react';
import { Project, Note, NoteType } from '../types';

interface SearchProps {
  projects: Project[];
  notes: Note[];
  onNavigate: (type: 'project' | 'note', id: string) => void;
}

export const Search: React.FC<SearchProps> = ({ projects, notes, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search Logic
  const getResults = () => {
    if (!query) return null;
    const lowerQuery = query.toLowerCase();

    // 1. Projects (Highest Priority)
    const matchedProjects = projects.filter((p) => 
      p.name.toLowerCase().includes(lowerQuery)
    );

    // 2. File/Note Titles (Medium Priority)
    const matchedFiles = notes.filter((n) => 
      (n.type !== NoteType.TEXT && n.title?.toLowerCase().includes(lowerQuery)) ||
      (n.type === NoteType.TEXT && n.content.split('\n')[0].toLowerCase().includes(lowerQuery) && n.content.length < 50) // Treat short notes like titles
    );

    // 3. Content Body (Low Priority)
    // Exclude items already found in Priority 2
    const matchedContent = notes.filter((n) => {
        if (matchedFiles.find(mf => mf.id === n.id)) return false;
        return n.content.toLowerCase().includes(lowerQuery);
    });

    return { matchedProjects, matchedFiles, matchedContent };
  };

  const results = getResults();
  const hasResults = results && (results.matchedProjects.length > 0 || results.matchedFiles.length > 0 || results.matchedContent.length > 0);

  const handleSelect = (type: 'project' | 'note', id: string) => {
    onNavigate(type, id);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto z-50">
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
        </div>
        <input
          ref={inputRef}
          type="text"
          className="block w-full pl-10 pr-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg leading-5 bg-gray-50 dark:bg-slate-900 placeholder-gray-500 dark:placeholder-slate-500 text-gray-900 dark:text-white focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm shadow-sm"
          placeholder="Search everything... (Ctrl + F)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <span className="text-gray-400 text-xs border border-gray-200 dark:border-slate-700 rounded px-1.5 py-0.5 hidden sm:inline-block">
            ⌘F
          </span>
        </div>
      </div>

      {/* Results Dropdown */}
      {isOpen && query && (
        <div className="absolute mt-2 w-full bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 overflow-hidden max-h-[70vh] overflow-y-auto">
          {!hasResults ? (
            <div className="p-4 text-center text-gray-500 dark:text-slate-500 text-sm">No results found</div>
          ) : (
            <>
              {/* Level 1: Projects */}
              {results.matchedProjects.length > 0 && (
                <div className="border-b border-gray-100 dark:border-slate-800">
                  <div className="px-4 py-2 bg-gray-50 dark:bg-slate-800 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Projects (Go to Folder)
                  </div>
                  {results.matchedProjects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSelect('project', p.id)}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-between group transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Hash className="text-blue-500 dark:text-blue-400" size={18} />
                        <span className="font-medium text-gray-800 dark:text-gray-200">{p.name}</span>
                      </div>
                      <ArrowRight className="text-gray-300 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all" size={16} />
                    </button>
                  ))}
                </div>
              )}

              {/* Level 2: Files / Titles */}
              {results.matchedFiles.length > 0 && (
                <div className="border-b border-gray-100 dark:border-slate-800">
                  <div className="px-4 py-2 bg-gray-50 dark:bg-slate-800 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Files & Quick Notes
                  </div>
                  {results.matchedFiles.map(n => (
                    <button
                      key={n.id}
                      onClick={() => handleSelect('note', n.id)}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-3 transition-colors"
                    >
                      <File className={n.type === NoteType.IMAGE ? "text-purple-500 dark:text-purple-400" : "text-orange-500 dark:text-orange-400"} size={16} />
                      <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                        {n.title || n.content}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Level 3: Content Snippets */}
              {results.matchedContent.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-gray-50 dark:bg-slate-800 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Content Matches
                  </div>
                  {results.matchedContent.map(n => (
                    <button
                      key={n.id}
                      onClick={() => handleSelect('note', n.id)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 border-b border-gray-50 dark:border-slate-800 last:border-0 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <FileText className="text-gray-400 dark:text-slate-500 mt-0.5" size={14} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-400 dark:text-slate-500 mb-0.5">
                            In {projects.find(p => p.id === n.projectId)?.name || 'Uncategorized'}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-slate-400 line-clamp-2 break-words">
                            {/* Highlight match simply */}
                             {n.content}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};