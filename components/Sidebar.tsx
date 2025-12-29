import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Folder, FolderOpen, Check, Zap, Settings, Search, FileText, File, Hash, ChevronLeft, ChevronRight, ChevronDown, CaseSensitive, WholeWord, X, Trash2, Pencil } from 'lucide-react';
import { Project, Note, NoteType, SearchOptions } from '../types';

interface SidebarProps {
  projects: Project[];
  notes: Note[];
  activeProjectId: string | null;
  activeNoteId?: string | null; 
  onSelectProject: (type: 'project' | 'note', id: string, searchQuery?: string) => void; 
  onAddProject: (name: string) => void;
  onRenameProject: (id: string, name: string) => void;
  onDeleteProject: (id: string) => void;
  onAddNote: (content: string, type: NoteType, title?: string, specificProjectId?: string) => void;
  onDeleteNote: (id: string) => void;
  onOpenSettings: () => void;
  onNavigate: (type: 'project' | 'note', id: string, searchQuery?: string) => void;
}

type SidebarTab = 'projects' | 'search';

export const Sidebar: React.FC<SidebarProps> = ({
  projects,
  notes,
  activeProjectId,
  activeNoteId,
  onSelectProject,
  onAddProject,
  onRenameProject,
  onDeleteProject,
  onAddNote,
  onDeleteNote,
  onOpenSettings,
  onNavigate
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>('projects');
  
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const [searchQuery, setSearchQuery] = useState('');
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({ caseSensitive: false, wholeWord: false });
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Creation State
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  
  const [creatingNoteInProjectId, setCreatingNoteInProjectId] = useState<string | null>(null);
  const [newNoteName, setNewNoteName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Renaming State
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameProjectName, setRenameProjectName] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreating && inputRef.current) {
        inputRef.current.focus();
    }
  }, [isCreating]);

  useEffect(() => {
      if (creatingNoteInProjectId && fileInputRef.current) {
          fileInputRef.current.focus();
      }
  }, [creatingNoteInProjectId]);

  useEffect(() => {
    if (renamingProjectId && renameInputRef.current) {
        renameInputRef.current.focus();
        renameInputRef.current.select();
    }
  }, [renamingProjectId]);

  useEffect(() => {
      if (activeProjectId && activeProjectId !== 'quick_notes') {
          setExpandedProjects(prev => new Set(prev).add(activeProjectId));
      }
  }, [activeProjectId]);

  const toggleProjectExpand = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    const newSet = new Set(expandedProjects);
    if (newSet.has(projectId)) {
        newSet.delete(projectId);
    } else {
        newSet.add(projectId);
    }
    setExpandedProjects(newSet);
  };

  const handleTabChange = (tab: SidebarTab) => {
    setActiveTab(tab);
    if (isCollapsed) setIsCollapsed(false);
    
    // Explicitly clear search query when switching back to projects (Explorer)
    if (tab === 'projects') {
        setSearchQuery('');
    }
    
    if (tab === 'search' && searchInputRef.current) {
        setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  };

  const handleCreateProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      onAddProject(newProjectName.trim());
      setNewProjectName('');
      setIsCreating(false);
    }
  };

  const handleCreateNoteSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (newNoteName.trim() && creatingNoteInProjectId) {
          onAddNote("", NoteType.TEXT, newNoteName.trim(), creatingNoteInProjectId);
          setNewNoteName('');
          setCreatingNoteInProjectId(null);
      }
  };

  const handleRenameSubmit = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (renamingProjectId && renameProjectName.trim()) {
          onRenameProject(renamingProjectId, renameProjectName.trim());
          setRenamingProjectId(null);
          setRenameProjectName('');
      } else {
          setRenamingProjectId(null); // Cancel if empty
      }
  };

  const startRenaming = (e: React.MouseEvent, project: Project) => {
      e.stopPropagation();
      setRenamingProjectId(project.id);
      setRenameProjectName(project.name);
  };

  const handleDeleteProjectClick = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      onDeleteProject(id);
  };

    const handleDeleteNoteClick = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      onDeleteNote(id);
  };

  const handleCreateClick = () => {
    if (isCollapsed) setIsCollapsed(false); 
    setActiveTab('projects');
    setIsCreating(true);
  };

  // --- Search Logic ---
  const searchResults = useMemo(() => {
    if (!searchQuery) return { projects: [], notes: [] };
    
    const { caseSensitive, wholeWord } = searchOptions;
    const flags = caseSensitive ? 'g' : 'gi';
    const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexPattern = wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery;
    
    let regex: RegExp;
    try { regex = new RegExp(regexPattern, flags); } catch (e) { return { projects: [], notes: [] }; }

    const matchedProjects = projects.filter(p => regex.test(p.name));
    
    const matchedNotes = notes.filter(n => {
        const titleMatch = n.title && regex.test(n.title);
        // Ensure content is a string before testing
        const contentMatch = n.content ? regex.test(n.content) : false;
        return titleMatch || contentMatch;
    }).map(n => {
        let snippet = '';
        if (n.content) {
            const matchIndex = n.content.search(regex);
            if (matchIndex !== -1) {
                const start = Math.max(0, matchIndex - 20);
                const end = Math.min(n.content.length, matchIndex + searchQuery.length + 60);
                snippet = (start > 0 ? '...' : '') + n.content.substring(start, end) + (end < n.content.length ? '...' : '');
            } else {
                snippet = n.content.substring(0, 80) + '...';
            }
        }
        return { ...n, snippet };
    });

    return { projects: matchedProjects, notes: matchedNotes };
  }, [searchQuery, searchOptions, projects, notes]);

  const HighlightedText = ({ text }: { text: string | undefined }) => {
    if (!text) return null;
    if (!searchQuery) return <>{text}</>;
    
    const { caseSensitive, wholeWord } = searchOptions;
    const flags = caseSensitive ? 'g' : 'gi';
    const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = wholeWord ? `(\\b${escapedQuery}\\b)` : `(${escapedQuery})`;
    
    try {
        const parts = text.split(new RegExp(pattern, flags));
        return (
            <>
                {parts.map((part, i) => {
                    let isMatch = false;
                    try { isMatch = new RegExp(`^${pattern}$`, flags).test(part); } catch { isMatch = false; }
                    return isMatch ? <span key={i} className="text-red-600 font-bold bg-red-100 dark:bg-red-900/50 rounded-[1px]">{part}</span> : part;
                })}
            </>
        );
    } catch {
        return <>{text}</>;
    }
  };

  const notesByProject = useMemo(() => {
      const map: Record<string, Note[]> = {};
      notes.forEach(n => {
          if (!map[n.projectId]) map[n.projectId] = [];
          map[n.projectId].push(n);
      });
      return map;
  }, [notes]);

  return (
    <aside className={`${isCollapsed ? 'w-20' : 'w-80'} bg-gray-50 dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 h-full flex flex-col transition-all duration-300 ease-in-out relative z-30 flex-shrink-0 group`}>
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 z-50 w-6 h-6 flex items-center justify-center bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-full shadow-md text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors transform hover:scale-110"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className="flex flex-col border-b border-gray-200 dark:border-slate-800 flex-shrink-0">
          <div className={`flex items-center h-14 px-3 ${isCollapsed ? 'justify-center py-4 h-auto' : ''}`}>
              <div className={`flex bg-gray-200/50 dark:bg-slate-800/50 rounded-lg p-1 transition-all ${isCollapsed ? 'flex-col gap-2 bg-transparent dark:bg-transparent p-0' : 'w-full grid grid-cols-2 gap-1'}`}>
                  <button onClick={() => handleTabChange('projects')} className={`flex items-center justify-center gap-2 py-1.5 rounded-md transition-all text-sm font-medium ${activeTab === 'projects' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-slate-500'}`}>
                      <Folder size={18} />{!isCollapsed && <span>Explorer</span>}
                  </button>
                  <button onClick={() => handleTabChange('search')} className={`flex items-center justify-center gap-2 py-1.5 rounded-md transition-all text-sm font-medium ${activeTab === 'search' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-slate-500'}`}>
                      <Search size={18} />{!isCollapsed && <span>Search</span>}
                  </button>
              </div>
          </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
          <div className={`absolute inset-0 flex flex-col transition-opacity duration-300 ${activeTab === 'projects' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
              {!isCollapsed && (
                <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">Projects</span>
                    <button onClick={handleCreateClick} className="p-1 hover:bg-gray-200 dark:hover:bg-slate-800 rounded text-gray-500 dark:text-slate-400">
                        <Plus size={16} />
                    </button>
                </div>
              )}

              {isCreating && !isCollapsed && (
                <div className="px-3 pb-3 animate-in slide-in-from-top-2">
                    <form onSubmit={handleCreateProjectSubmit} className="flex gap-1.5 items-center">
                        <input ref={inputRef} type="text" className="flex-1 min-w-0 px-2 py-1 text-xs border border-gray-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white" placeholder="Project Name..." value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} onBlur={() => { if(!newProjectName.trim()) setIsCreating(false); }} onKeyDown={(e) => { if(e.key === 'Escape') setIsCreating(false); }} />
                        <button type="submit" className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700"><Check size={14} /></button>
                    </form>
                </div>
              )}

              <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 select-none">
                <button onClick={() => onSelectProject('project', 'quick_notes')} className={`w-full text-left px-4 py-2 flex items-center gap-3 text-sm transition-all mb-1 ${activeProjectId === 'quick_notes' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-r-2 border-blue-500' : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'} ${isCollapsed ? 'justify-center px-2' : ''}`}>
                  <Zap size={18} className={activeProjectId === 'quick_notes' ? 'text-blue-600 dark:text-blue-400' : 'text-orange-500'} />
                  {!isCollapsed && <span className="font-medium truncate">Quick Notes</span>}
                </button>

                {!isCollapsed && <div className="mt-4 px-4 mb-2 text-[10px] font-bold text-gray-400 dark:text-slate-600 uppercase truncate">Files</div>}
                
                {projects.map((project) => {
                    const isExpanded = expandedProjects.has(project.id);
                    const projectNotes = notesByProject[project.id] || [];
                    const isProjectActive = activeProjectId === project.id;
                    const isCreatingNote = creatingNoteInProjectId === project.id;
                    const isRenaming = renamingProjectId === project.id;

                    return (
                        <div key={project.id} className="mb-0.5">
                            <div className={`w-full flex items-center text-sm transition-all group/row relative ${isProjectActive && isCollapsed ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`} onClick={() => !isRenaming && onSelectProject('project', project.id)}>
                                <button onClick={(e) => !isCollapsed && toggleProjectExpand(e, project.id)} className={`p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 ${isCollapsed ? 'hidden' : ''}`}>
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                                
                                <div className={`flex-1 flex items-center gap-2 py-1.5 pr-2 overflow-hidden cursor-pointer ${isCollapsed ? 'justify-center pl-0' : ''} ${isProjectActive ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'}`}>
                                    {isExpanded ? <FolderOpen size={18} className="flex-shrink-0 text-blue-500" /> : <Folder size={18} className="flex-shrink-0 text-blue-500" />}
                                    
                                    {!isCollapsed && (
                                        isRenaming ? (
                                            <form onSubmit={handleRenameSubmit} className="flex-1 min-w-0 flex items-center">
                                                <input 
                                                    ref={renameInputRef}
                                                    type="text" 
                                                    className="w-full bg-white dark:bg-slate-800 border border-blue-500 rounded px-1 py-0.5 text-xs text-gray-900 dark:text-white focus:outline-none"
                                                    value={renameProjectName}
                                                    onChange={(e) => setRenameProjectName(e.target.value)}
                                                    onBlur={() => handleRenameSubmit()}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Escape') {
                                                            setRenamingProjectId(null);
                                                            e.stopPropagation();
                                                        }
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </form>
                                        ) : (
                                            <span className="truncate">{project.name}</span>
                                        )
                                    )}
                                </div>

                                {!isCollapsed && !isRenaming && (
                                    <div className="flex items-center opacity-0 group-hover/row:opacity-100 transition-opacity bg-gray-50 dark:bg-slate-900 shadow-sm rounded mr-2">
                                         <button 
                                            onClick={(e) => startRenaming(e, project)} 
                                            className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                                            title="Rename Project"
                                        >
                                            <Pencil size={13} />
                                        </button>
                                         <button 
                                            onClick={(e) => handleDeleteProjectClick(e, project.id)} 
                                            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                                            title="Delete Project"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setExpandedProjects(prev => new Set(prev).add(project.id)); setCreatingNoteInProjectId(project.id); }} 
                                            className="p-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                                            title="New Note"
                                        >
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            {!isCollapsed && isExpanded && (
                                <div className="ml-7 border-l border-gray-200 dark:border-slate-800">
                                    {isCreatingNote && (
                                        <div className="px-3 py-1.5 animate-in slide-in-from-top-1">
                                            <form onSubmit={handleCreateNoteSubmit} className="flex gap-1 items-center">
                                                <FileText size={14} className="text-gray-400" />
                                                <input ref={fileInputRef} type="text" className="w-full bg-transparent border-b border-blue-500 text-xs focus:outline-none py-0.5 text-gray-800 dark:text-gray-200" placeholder="File name..." value={newNoteName} onChange={(e) => setNewNoteName(e.target.value)} onBlur={() => { if(!newNoteName.trim()) setCreatingNoteInProjectId(null); }} onKeyDown={(e) => { if(e.key === 'Escape') setCreatingNoteInProjectId(null); }} />
                                            </form>
                                        </div>
                                    )}
                                    {projectNotes.length === 0 && !isCreatingNote && <div className="px-3 py-1 text-xs text-gray-400 italic">Empty</div>}
                                    {projectNotes.map(note => (
                                        <div key={note.id} className="relative group/note">
                                            <button onClick={() => onNavigate('note', note.id)} className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-sm transition-colors ${activeNoteId === note.id ? 'text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/20 rounded-r' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400'}`}>
                                                {note.type === NoteType.TEXT ? <FileText size={14} /> : <File size={14} />}
                                                <span className="truncate pr-4">{note.title || (note.type === NoteType.TEXT ? 'Untitled Note' : 'File')}</span>
                                            </button>
                                            <button 
                                                onClick={(e) => handleDeleteNoteClick(e, note.id)}
                                                className="absolute right-1 top-1.5 p-0.5 text-gray-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 opacity-0 group-hover/note:opacity-100 transition-opacity bg-white dark:bg-slate-900 shadow-sm rounded"
                                                title="Delete Note"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
              </nav>
          </div>
          
           <div className={`absolute inset-0 flex flex-col bg-gray-50 dark:bg-slate-900 transition-opacity duration-300 ${activeTab === 'search' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
             {!isCollapsed && (
                <>
                    <div className="p-3 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <div className="relative mb-2">
                            <Search className="absolute left-2.5 top-2 text-gray-400" size={14} />
                            <input ref={searchInputRef} type="text" className="w-full pl-8 pr-7 py-1.5 text-sm bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-400" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <div className="flex gap-1 justify-end">
                            <button onClick={() => setSearchOptions(p => ({ ...p, caseSensitive: !p.caseSensitive }))} className={`p-1 rounded text-xs border ${searchOptions.caseSensitive ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-300' : 'bg-transparent border-transparent text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`} title="Match Case"><CaseSensitive size={16} /></button>
                            <button onClick={() => setSearchOptions(p => ({ ...p, wholeWord: !p.wholeWord }))} className={`p-1 rounded text-xs border ${searchOptions.wholeWord ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-300' : 'bg-transparent border-transparent text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`} title="Match Whole Word"><WholeWord size={16} /></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-0">
                         {searchQuery && searchResults.projects.length === 0 && searchResults.notes.length === 0 && <div className="p-4 text-center text-xs text-gray-500">No results found.</div>}
                        {searchResults.projects.length > 0 && (
                            <div className="py-2">
                                <div className="px-3 pb-1 text-[10px] font-bold text-gray-400 uppercase">Projects</div>
                                {searchResults.projects.map(p => (
                                    <button key={p.id} onClick={() => { onNavigate('project', p.id); }} className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 group flex items-center gap-2">
                                        <Hash size={14} className="text-blue-500" /><span className="text-sm text-gray-700 dark:text-slate-200"><HighlightedText text={p.name} /></span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {searchResults.notes.length > 0 && (
                            <div className="py-2">
                                <div className="px-3 pb-1 text-[10px] font-bold text-gray-400 uppercase">Content</div>
                                {searchResults.notes.map(n => (
                                    <button key={n.id} onClick={() => { onNavigate('note', n.id, searchQuery); }} className="w-full text-left px-3 py-3 hover:bg-gray-100 dark:hover:bg-slate-800 border-b border-gray-100 dark:border-slate-800/50 group flex flex-col items-start gap-1">
                                        <div className="flex items-center gap-2 w-full">
                                            {n.type === NoteType.TEXT ? <FileText size={14} className="text-gray-400" /> : <File size={14} className="text-orange-400" />}
                                            <span className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate flex-1"><HighlightedText text={n.title || 'Untitled'} /></span>
                                        </div>
                                        {n.snippet && <div className="pl-6 text-xs text-gray-500 dark:text-slate-400 line-clamp-2 leading-relaxed font-mono opacity-90"><HighlightedText text={n.snippet} /></div>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </>
             )}
          </div>
      </div>
      <div className="p-4 border-t border-gray-200 dark:border-slate-800 flex-shrink-0 bg-gray-50 dark:bg-slate-900 z-20">
        <button onClick={onOpenSettings} className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors ${isCollapsed ? 'justify-center' : ''}`}><Settings size={20} />{!isCollapsed && <span>Settings</span>}</button>
      </div>
    </aside>
  );
};