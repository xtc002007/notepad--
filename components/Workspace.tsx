
import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Project, Note, NoteType, SearchOptions } from '../types';
import { File as FileIcon, Search, CaseSensitive, WholeWord, X, ChevronDown, ChevronUp, FileText, Code, Eye, Pencil } from 'lucide-react';

interface WorkspaceProps {
  project: Project | null;
  notes: Note[];
  activeNoteId: string | null;
  initialSearchQuery?: string;
  onAddNote: (content: string, type: NoteType, title?: string) => void;
  onRenameProject: (projectId: string, newName: string) => void;
  onRenameNote: (noteId: string, newTitle: string) => void;
  onUpdateNoteContent: (noteId: string, newContent: string) => void;
  highlightNoteId?: string;
}

// --- Helper: Highlight logic for raw text ---
const getHighlightParts = (content: string, query: string, options: SearchOptions) => {
    if (!content) return [];
    if (!query) return [{ text: content, isMatch: false }];
    const { caseSensitive, wholeWord } = options;
    const flags = caseSensitive ? 'g' : 'gi';
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = wholeWord ? `(\\b${escapedQuery}\\b)` : `(${escapedQuery})`;
    const parts = content.split(new RegExp(pattern, flags));
    return parts.map(part => {
        let isMatch = false;
        try { isMatch = new RegExp(`^${pattern}$`, flags).test(part); } catch { isMatch = false; }
        return { text: part, isMatch };
    });
};

// --- Component: Highlight Backdrop for Source Mode ---
const HighlightBackdrop: React.FC<{
  content: string;
  query: string;
  options: SearchOptions;
}> = ({ content, query, options }) => {
  if (!query) return null;
  
  const parts = getHighlightParts(content, query, options);
  let matchCounter = 0;

  return (
    <div className="font-mono text-sm leading-relaxed p-4 text-gray-900 dark:text-gray-200 w-full pointer-events-none whitespace-pre">
        {parts.map((part, i) => {
            if (part.isMatch) {
                const id = `match-${matchCounter}`;
                matchCounter++;
                return <mark id={id} key={i} className="bg-yellow-300/60 dark:bg-yellow-600/60 text-inherit rounded-[1px]">{part.text}</mark>;
            }
            return <span key={i}>{part.text}</span>;
        })}
        <span className="invisible">.</span>
    </div>
  );
};

// --- Helper: Safer Non-Recursive Highlighter for Markdown Preview ---
interface HighlightElementsProps {
  children?: React.ReactNode;
  query: string;
  options: SearchOptions;
}

const HighlightElements: React.FC<HighlightElementsProps> = ({ children, query, options }) => {
    if (!query) return <>{children}</>;
    
    if (typeof children === 'string') {
        const parts = getHighlightParts(children, query, options);
        return (
            <>
                {parts.map((part, i) => 
                    part.isMatch ? 
                    <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 text-gray-900 dark:text-gray-100 rounded-[1px] px-0.5">{part.text}</mark> : 
                    part.text
                )}
            </>
        );
    }

    if (Array.isArray(children)) {
        return <>{children.map((child, i) => <HighlightElements key={i} query={query} options={options}>{child}</HighlightElements>)}</>;
    }

    // React Elements are left alone to let children render
    return <>{children}</>;
};

export const Workspace: React.FC<WorkspaceProps> = ({
  project,
  notes,
  activeNoteId,
  initialSearchQuery,
  onRenameProject,
  onRenameNote,
  onUpdateNoteContent,
}) => {
  // View State
  const [viewMode, setViewMode] = useState<'raw' | 'markdown'>('raw');
  
  // Search State
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({ caseSensitive: false, wholeWord: false });
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Active Note
  const activeNote = useMemo(() => notes.find(n => n.id === activeNoteId) || null, [notes, activeNoteId]);

  // Search Logic
  useEffect(() => {
    if (initialSearchQuery) {
        setSearchQuery(initialSearchQuery);
        setIsSearchVisible(true);
        setViewMode('raw'); 
    }
  }, [initialSearchQuery, activeNoteId]);

  // Match Calculation
  const searchMatchesCount = useMemo(() => {
    if (!searchQuery || !activeNote || !activeNote.content) return 0;
    const { caseSensitive, wholeWord } = searchOptions;
    const flags = caseSensitive ? 'g' : 'gi';
    const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery;
    try {
        const matches = activeNote.content.match(new RegExp(pattern, flags));
        return matches ? matches.length : 0;
    } catch { return 0; }
  }, [searchQuery, searchOptions, activeNote]);

  // Scroll to Match Logic
  const scrollToMatch = (index: number) => {
      // 1. Source Mode Scroll
      if (viewMode === 'raw') {
        const markId = `match-${index}`;
        const markElement = document.getElementById(markId);
        
        if (markElement && textareaRef.current) {
            const top = markElement.offsetTop;
            const left = markElement.offsetLeft;
            
            textareaRef.current.scrollTo({
                top: top - (textareaRef.current.clientHeight / 2), 
                left: left - 50,
                behavior: 'smooth'
            });
        }
      } 
      // 2. Preview Mode Scroll
      else if (viewMode === 'markdown' && previewContainerRef.current) {
         // In Preview mode, marks don't have deterministic IDs like match-0 because of component structure.
         // However, the order of marks in the DOM roughly corresponds to the string match order.
         const marks = previewContainerRef.current.getElementsByTagName('mark');
         if (marks[index]) {
             marks[index].scrollIntoView({
                 behavior: 'smooth',
                 block: 'center',
                 inline: 'nearest'
             });
         }
      }
      
      setCurrentMatchIndex(index);
  };

  const handleNextMatch = () => {
      if (searchMatchesCount === 0) return;
      const nextIndex = (currentMatchIndex + 1) % searchMatchesCount;
      scrollToMatch(nextIndex); // Update index inside function or after? 
      // Logic fix: setState is async. Pass nextIndex directly.
  };

  const handlePrevMatch = () => {
      if (searchMatchesCount === 0) return;
      const prevIndex = (currentMatchIndex - 1 + searchMatchesCount) % searchMatchesCount;
      scrollToMatch(prevIndex);
  };

  const handleScroll = () => {
      if (textareaRef.current) {
          const { scrollTop, scrollLeft } = textareaRef.current;
          if (backdropRef.current) {
              backdropRef.current.scrollTop = scrollTop;
              backdropRef.current.scrollLeft = scrollLeft;
          }
          if (lineNumbersRef.current) {
              lineNumbersRef.current.scrollTop = scrollTop;
          }
      }
  };

  const toggleSearch = () => {
      if (isSearchVisible) {
          setIsSearchVisible(false);
          setSearchQuery('');
      } else {
          setIsSearchVisible(true);
      }
  };

  // Line Numbers Calculation
  const lineCount = useMemo(() => {
      if (!activeNote || !activeNote.content) return 1;
      return activeNote.content.split('\n').length;
  }, [activeNote?.content]);

  // Markdown Components with Highlight Support
  const markdownComponents = useMemo(() => {
      const Wrapper = ({ children }: any) => <HighlightElements query={searchQuery} options={searchOptions}>{children}</HighlightElements>;
      
      return {
          // Block elements
          p: ({ children }: any) => <p className="mb-4"><Wrapper>{children}</Wrapper></p>,
          li: ({ children }: any) => <li><Wrapper>{children}</Wrapper></li>,
          h1: ({ children }: any) => <h1 className="text-2xl font-bold mb-4"><Wrapper>{children}</Wrapper></h1>,
          h2: ({ children }: any) => <h2 className="text-xl font-bold mb-3"><Wrapper>{children}</Wrapper></h2>,
          h3: ({ children }: any) => <h3 className="text-lg font-bold mb-2"><Wrapper>{children}</Wrapper></h3>,
          h4: ({ children }: any) => <h4 className="text-base font-bold mb-2"><Wrapper>{children}</Wrapper></h4>,
          h5: ({ children }: any) => <h5 className="text-sm font-bold mb-1"><Wrapper>{children}</Wrapper></h5>,
          h6: ({ children }: any) => <h6 className="text-xs font-bold mb-1"><Wrapper>{children}</Wrapper></h6>,
          blockquote: ({ children }: any) => <blockquote className="border-l-4 border-gray-200 pl-4 italic"><Wrapper>{children}</Wrapper></blockquote>,
          
          // Inline elements
          strong: ({ children }: any) => <strong><Wrapper>{children}</Wrapper></strong>,
          em: ({ children }: any) => <em><Wrapper>{children}</Wrapper></em>,
          code: ({ children, className }: any) => <code className={className}><Wrapper>{children}</Wrapper></code>,
          a: ({ children, href }: any) => <a href={href} className="text-blue-600 hover:underline"><Wrapper>{children}</Wrapper></a>,
          del: ({ children }: any) => <del><Wrapper>{children}</Wrapper></del>,
          
          // Tables
          td: ({ children }: any) => <td className="border px-4 py-2"><Wrapper>{children}</Wrapper></td>,
          th: ({ children }: any) => <th className="border px-4 py-2 bg-gray-100 dark:bg-slate-800"><Wrapper>{children}</Wrapper></th>,
      };
  }, [searchQuery, searchOptions]);


  if (!activeNote) {
      return (
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 text-gray-400 dark:text-slate-600">
              <FileText size={64} className="mb-4 opacity-20" />
              <p>Select a file from the explorer to view</p>
          </div>
      );
  }

  return (
    <main className="flex-1 flex flex-col h-full relative bg-white dark:bg-slate-950 transition-colors overflow-hidden">
      
      {/* Header Bar */}
      <header className="flex-shrink-0 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-950 h-16 px-6 flex items-center justify-between z-10">
        <div className="flex flex-col min-w-0 flex-1 mr-4">
             <div className="flex items-center text-xs text-gray-400 dark:text-slate-500 mb-0.5">
                <span className="mr-1">Project:</span>
                {project ? (
                    <div className="flex items-center gap-2 group/edit-project">
                        <input 
                            ref={projectInputRef}
                            className="bg-transparent border-none p-0 focus:ring-0 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-blue-600 cursor-pointer hover:border-b hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                            value={project.name}
                            onChange={(e) => onRenameProject(project.id, e.target.value)}
                            title="Rename Project"
                        />
                        <button 
                            onClick={() => projectInputRef.current?.focus()}
                            className="opacity-0 group-hover/edit-project:opacity-100 p-1 text-gray-400 hover:text-blue-500 transition-opacity"
                        >
                            <Pencil size={10} />
                        </button>
                    </div>
                ) : <span>Uncategorized</span>}
             </div>
             
             <div className="flex items-center gap-2 group/edit-title">
                 {activeNote.type === NoteType.TEXT ? <FileText size={18} className="text-blue-500" /> : <FileIcon size={18} className="text-orange-500" />}
                 <input 
                    ref={titleInputRef}
                    className="bg-transparent border-none p-0 focus:ring-0 text-lg font-bold text-gray-800 dark:text-white w-full hover:border-b-2 hover:border-gray-200 dark:hover:border-slate-700 focus:border-blue-500 transition-all rounded-none"
                    value={activeNote.title || 'Untitled'}
                    onChange={(e) => onRenameNote(activeNote.id, e.target.value)}
                    placeholder="Untitled Note"
                 />
                 <button 
                    onClick={() => titleInputRef.current?.focus()}
                    className="opacity-0 group-hover/edit-title:opacity-100 p-1.5 text-gray-400 hover:text-blue-500 transition-opacity"
                 >
                    <Pencil size={14} />
                 </button>
             </div>
        </div>

        <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-900 rounded-lg p-1">
            <button 
                onClick={() => setViewMode('raw')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${viewMode === 'raw' ? 'bg-white dark:bg-slate-800 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-slate-500'}`}
            >
                <Code size={14} /> Source
            </button>
            <button 
                onClick={() => setViewMode('markdown')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${viewMode === 'markdown' ? 'bg-white dark:bg-slate-800 shadow text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-slate-500'}`}
            >
                <Eye size={14} /> Preview
            </button>
        </div>

        <div className="ml-4 pl-4 border-l border-gray-200 dark:border-slate-800 flex items-center gap-2">
             {!isSearchVisible ? (
                 <button onClick={toggleSearch} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded transition-colors" title="Find in file">
                     <Search size={18} />
                 </button>
             ) : (
                <div className="flex items-center gap-1 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-2 py-1 shadow-sm animate-in slide-in-from-right-2 fade-in">
                    <Search size={14} className="text-gray-400" />
                    <input 
                        autoFocus
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentMatchIndex(0); }}
                        placeholder="Find..."
                        className="bg-transparent border-none focus:ring-0 w-32 text-sm text-gray-800 dark:text-gray-200 p-0"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                e.shiftKey ? handlePrevMatch() : handleNextMatch();
                            } else if (e.key === 'Escape') {
                                toggleSearch();
                            }
                        }}
                    />
                    
                    <div className="flex items-center border-l border-gray-300 dark:border-slate-700 ml-1 pl-1 gap-0.5">
                        <span className="text-[10px] text-gray-400 min-w-[3ch] text-center">{searchMatchesCount > 0 ? `${currentMatchIndex + 1}/${searchMatchesCount}` : '0'}</span>
                        <button onClick={handlePrevMatch} className="hover:bg-gray-200 dark:hover:bg-slate-700 rounded p-0.5" title="Previous"><ChevronUp size={14}/></button>
                        <button onClick={handleNextMatch} className="hover:bg-gray-200 dark:hover:bg-slate-700 rounded p-0.5" title="Next"><ChevronDown size={14}/></button>
                    </div>

                    <div className="flex items-center border-l border-gray-300 dark:border-slate-700 ml-1 pl-1 gap-0.5">
                        <button onClick={() => setSearchOptions(o => ({...o, caseSensitive: !o.caseSensitive}))} className={`p-0.5 rounded ${searchOptions.caseSensitive ? 'text-blue-600 bg-blue-100' : 'text-gray-400'}`} title="Case Sensitive"><CaseSensitive size={14}/></button>
                        <button onClick={() => setSearchOptions(o => ({...o, wholeWord: !o.wholeWord}))} className={`p-0.5 rounded ${searchOptions.wholeWord ? 'text-blue-600 bg-blue-100' : 'text-gray-400'}`} title="Whole Word"><WholeWord size={14}/></button>
                    </div>

                    <button onClick={toggleSearch} className="ml-1 text-gray-400 hover:text-red-500 p-0.5"><X size={14} /></button>
                </div>
             )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative group/editor flex">
         
         {/* Line Numbers Gutter (Only in Source Mode) */}
         {viewMode === 'raw' && (
            <div 
                ref={lineNumbersRef}
                className="flex-shrink-0 w-12 bg-gray-50 dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 pt-4 pb-4 text-right pr-3 select-none overflow-hidden"
                style={{ fontFamily: 'monospace', fontSize: '0.875rem', lineHeight: '1.625' }}
            >
                {Array.from({ length: lineCount }).map((_, i) => (
                    <div key={i} className="text-gray-300 dark:text-slate-600">{i + 1}</div>
                ))}
            </div>
         )}

         {/* Editor / Viewer */}
         <div className="flex-1 relative h-full min-w-0">
            {viewMode === 'markdown' ? (
                <div 
                    ref={previewContainerRef}
                    className="h-full w-full overflow-y-auto custom-scrollbar prose dark:prose-invert max-w-none p-4 cursor-text"
                    onDoubleClick={() => setViewMode('raw')}
                    title="Double click to edit"
                >
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {activeNote.content}
                    </ReactMarkdown>
                </div>
            ) : (
                /* RAW EDITABLE MODE WITH BACKDROP HIGHLIGHTS */
                <div className="relative w-full h-full bg-white dark:bg-slate-950">
                    {/* Backdrop for Highlights */}
                    {searchQuery && (
                        <div 
                            ref={backdropRef}
                            className="absolute inset-0 z-0 overflow-auto select-none pointer-events-none custom-scrollbar"
                            aria-hidden="true"
                        >
                            <HighlightBackdrop 
                                content={activeNote.content} 
                                query={searchQuery} 
                                options={searchOptions} 
                            />
                        </div>
                    )}
                    
                    {/* Editable Textarea 
                        NOTE: Using whitespace-pre (No Wrap) ensures line numbers align perfectly. 
                    */}
                    <textarea
                        ref={textareaRef}
                        value={activeNote.content}
                        onChange={(e) => onUpdateNoteContent(activeNote.id, e.target.value)}
                        onScroll={handleScroll}
                        spellCheck={false}
                        className={`absolute inset-0 z-10 w-full h-full p-4 font-mono text-sm leading-relaxed whitespace-pre overflow-auto bg-transparent resize-none outline-none custom-scrollbar ${searchQuery ? 'text-transparent caret-gray-900 dark:caret-white selection:bg-blue-200/50 dark:selection:bg-blue-800/50' : 'text-gray-900 dark:text-gray-200'}`}
                        placeholder="Start typing..."
                    />
                </div>
            )}
         </div>
      </div>

    </main>
  );
};
