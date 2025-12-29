
import React, { useState, useMemo } from 'react';
import { Note, Project, NoteType } from '../types';
import { Plus, Calendar, ArrowRight, X, Code, CheckCircle2, Zap } from 'lucide-react';
import { format } from 'date-fns';

interface QuickNotesViewProps {
  notes: Note[];
  projects: Project[];
  onAddNote: (content: string, type: NoteType) => void;
  onMoveNote: (noteId: string, projectId: string) => void;
  highlightNoteId?: string;
  searchQuery?: string;
}

const HighlightedContent: React.FC<{ content: string; query?: string }> = ({ content, query }) => {
    // Safety check for empty or undefined content
    if (!content) return null;
    if (!query) return <>{content}</>;
    
    // Simple case-insensitive highlight logic
    try {
        const parts = content.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
        return (
            <>
                {parts.map((part, i) => 
                    part.toLowerCase() === query.toLowerCase() 
                    ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 text-gray-900 dark:text-gray-100 rounded-[1px] px-0.5">{part}</mark>
                    : part
                )}
            </>
        );
    } catch {
        return <>{content}</>;
    }
};

export const QuickNotesView: React.FC<QuickNotesViewProps> = ({
  notes,
  projects,
  onAddNote,
  onMoveNote,
  highlightNoteId,
  searchQuery
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [viewJsonId, setViewJsonId] = useState<string | null>(null);

  const handleSave = () => {
    if (newContent.trim()) {
      onAddNote(newContent, NoteType.TEXT);
      setNewContent('');
      setIsAdding(false);
    }
  };

  // Scroll to highlight
  const noteRefs = React.useRef<{ [key: string]: HTMLDivElement | null }>({});
  React.useEffect(() => {
    if (highlightNoteId && noteRefs.current[highlightNoteId]) {
      noteRefs.current[highlightNoteId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      noteRefs.current[highlightNoteId]?.classList.add('ring-2', 'ring-blue-400');
      setTimeout(() => {
        noteRefs.current[highlightNoteId]?.classList.remove('ring-2', 'ring-blue-400');
      }, 2000);
    }
  }, [highlightNoteId]);

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50/50 dark:bg-slate-900/50 relative transition-colors overflow-hidden">
       {/* Header - Styled to match Workspace Header exactly */}
       <header className="flex-shrink-0 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-950 h-16 px-6 flex items-center justify-between z-10">
         <div className="flex flex-col min-w-0 flex-1 mr-4">
            <div className="flex items-center text-xs text-gray-400 dark:text-slate-500 mb-0.5">
               <span className="mr-1">Context:</span>
               <span>Local</span>
            </div>
            
            <div className="flex items-center gap-2">
                <Zap size={18} className="text-orange-500" />
                <span className="text-lg font-bold text-gray-800 dark:text-white truncate">
                    Quick Notes
                </span>
                <span className="text-xs font-normal px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full ml-2">Beta</span>
            </div>
         </div>

         <div className="flex items-center gap-2">
           <button
             onClick={() => setIsAdding(true)}
             className="px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow"
             title="Add Quick Note"
           >
             <Plus size={14} /> New Note
           </button>
         </div>
       </header>

       {/* Add Modal/Overlay */}
       {isAdding && (
         <div className="absolute inset-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm flex items-start justify-center pt-20 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-800 p-6 mx-4 transform transition-all scale-100">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">New Quick Note</h3>
                    <button onClick={() => setIsAdding(false)} className="p-2 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <textarea
                    autoFocus
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="Type your thought here..."
                    className="w-full h-40 p-4 text-base border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-gray-200 mb-4"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
                    }}
                />
                <div className="flex justify-between items-center">
                     <span className="text-xs text-gray-400 dark:text-slate-500">Ctrl/Cmd + Enter to save</span>
                     <div className="flex gap-3">
                        <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors">Cancel</button>
                        <button 
                            onClick={handleSave} 
                            disabled={!newContent.trim()}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md shadow-blue-100 dark:shadow-none font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Save Note
                        </button>
                     </div>
                </div>
            </div>
         </div>
       )}

       {/* List */}
       <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-4">
          {notes.length === 0 && !isAdding && (
             <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-slate-600">
                <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-gray-300 dark:text-slate-500">
                    <Zap size={32} />
                </div>
                <p className="text-lg font-medium text-gray-500 dark:text-slate-500">No quick notes yet</p>
                <p className="text-sm">Click the New Note button to start</p>
             </div>
          )}
          
          {notes.map(note => (
            <div 
                key={note.id} 
                ref={el => { noteRefs.current[note.id] = el; }}
                className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 group relative"
            >
                {/* Header: Date & Actions */}
                <div className="flex justify-between items-start mb-3 border-b border-gray-50 dark:border-slate-800 pb-2">
                    <div className="flex items-center text-xs font-medium text-gray-400 dark:text-slate-500 gap-2 bg-gray-50 dark:bg-slate-800 px-2 py-1 rounded">
                        <Calendar size={12} />
                        <span>{format(note.createdAt, 'MMM d, yyyy · HH:mm')}</span>
                    </div>
                    
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                            onClick={() => setViewJsonId(viewJsonId === note.id ? null : note.id)}
                            className={`p-1.5 rounded transition-colors ${viewJsonId === note.id ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                            title="View JSON"
                        >
                            <Code size={14} />
                        </button>
                        
                        {/* Project Association Dropdown */}
                        <div className="relative group/menu">
                            <button className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors">
                                <span>Move to...</span>
                                <ArrowRight size={12} />
                            </button>
                            {/* Dropdown Menu */}
                            <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-xl rounded-lg overflow-hidden hidden group-hover/menu:block z-20 animate-in fade-in slide-in-from-top-2 duration-150">
                                <div className="p-2 bg-gray-50 dark:bg-slate-900 text-xs font-semibold text-gray-500 dark:text-slate-400 border-b border-gray-100 dark:border-slate-700">
                                    SELECT PROJECT
                                </div>
                                <div className="max-h-48 overflow-y-auto py-1">
                                    {projects.length === 0 ? (
                                        <div className="px-4 py-3 text-xs text-gray-400 text-center italic">No projects created</div>
                                    ) : (
                                        projects.map(p => (
                                            <button 
                                                key={p.id}
                                                onClick={() => onMoveNote(note.id, p.id)}
                                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-between group/item"
                                            >
                                                <span className="truncate">{p.name}</span>
                                                <CheckCircle2 size={14} className="opacity-0 group-hover/item:opacity-100 text-blue-500" />
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed text-sm sm:text-base font-normal">
                    <HighlightedContent content={note.content} query={searchQuery} />
                </div>
                
                {/* JSON View */}
                {viewJsonId === note.id && (
                    <div className="mt-4 p-4 bg-slate-900 rounded-lg overflow-x-auto shadow-inner border border-slate-700">
                        <div className="flex justify-between items-center mb-2">
                             <span className="text-xs text-slate-400 font-mono">JSON Representation</span>
                             <button onClick={() => setViewJsonId(null)} className="text-slate-500 hover:text-slate-300"><X size={12}/></button>
                        </div>
                        <pre className="text-xs text-green-400 font-mono leading-tight">
                            {JSON.stringify(note, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
          ))}
       </div>
    </div>
  );
};
