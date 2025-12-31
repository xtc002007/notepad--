
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Folder, FolderOpen, Check, Zap, Settings, Search, FileText, File, Hash, ChevronLeft, ChevronRight, ChevronDown, CaseSensitive, WholeWord, X, Trash2, Pencil, Sun, Moon, AlignJustify } from 'lucide-react';
import { Project, Note, NoteType, SearchOptions, Theme } from '../types';

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
    onRenameNote: (id: string, name: string) => void;
    onDeleteNote: (id: string) => void;
    onOpenSettings: () => void;
    onNavigate: (type: 'project' | 'note', id: string, searchQuery?: string) => void;
    theme: Theme;
    onToggleTheme: () => void;
    expandedProjectIds: string[];
    onUpdateExpandedProjects: (ids: string[]) => void;
}

type SidebarTab = 'projects' | 'search' | 'outline';

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
    onRenameNote,
    onDeleteNote,
    onOpenSettings,
    onNavigate,
    theme,
    onToggleTheme,
    expandedProjectIds,
    onUpdateExpandedProjects
}) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [activeTab, setActiveTab] = useState<SidebarTab>('projects');
    const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set(expandedProjectIds));

    useEffect(() => {
        setExpandedProjects(new Set(expandedProjectIds));
    }, [expandedProjectIds]);

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
    const [renamingNoteId, setRenamingNoteId] = useState<string | null>(null);
    const [renameNoteName, setRenameNoteName] = useState('');
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
        if ((renamingProjectId || renamingNoteId) && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [renamingProjectId, renamingNoteId]);

    useEffect(() => {
        if (activeProjectId && activeProjectId !== 'quick_notes') {
            setExpandedProjects(prev => new Set(prev).add(activeProjectId));
        }
    }, [activeProjectId]);

    // Auto-expand first project on launch
    useEffect(() => {
        if (projects.length > 0 && expandedProjectIds.length === 0) {
            onUpdateExpandedProjects([projects[0].id]);
        }
    }, [projects, expandedProjectIds]);

    const toggleProjectExpand = (e: React.MouseEvent, projectId: string) => {
        e.stopPropagation();
        const newSet = new Set(expandedProjects);
        if (newSet.has(projectId)) {
            newSet.delete(projectId);
        } else {
            newSet.add(projectId);
        }
        onUpdateExpandedProjects(Array.from(newSet));
    };

    const handleTabChange = (tab: SidebarTab) => {
        setActiveTab(tab);
        if (isCollapsed) setIsCollapsed(false);

        // Clear search query if moving away from search
        if (tab !== 'search') {
            // setSearchQuery(''); // Keep search state for now or clear based on preference
        }

        if (tab === 'search' && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }
    };

    const activeNote = useMemo(() => {
        if (!activeNoteId) return null;
        return notes.find(n => n.id === activeNoteId) || null;
    }, [notes, activeNoteId]);

    const outlineTree = useMemo(() => {
        if (!activeNote || activeNote.projectId === 'quick_notes') return [];

        const lines = activeNote.content.split('\n');
        const allHeaders = lines.map((line, index) => {
            const match = line.match(/^(#+)\s+(.*)$/);
            if (match) {
                return { level: match[1].length, text: match[2].trim(), lineIndex: index };
            }
            return null;
        }).filter(h => h !== null) as { level: number; text: string; lineIndex: number }[];

        if (allHeaders.length === 0) return [];

        const minLevel = Math.min(...allHeaders.map(h => h.level));

        // Filter to max 3 levels relative to minLevel found in doc
        return allHeaders
            .map(h => ({ ...h, relLevel: h.level - minLevel }))
            .filter(h => h.relLevel < 3);
    }, [activeNote]);

    const [collapsedOutlineItems, setCollapsedOutlineItems] = useState<Set<number>>(new Set());

    const toggleOutlineCollapse = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        const newSet = new Set(collapsedOutlineItems);
        if (newSet.has(index)) newSet.delete(index);
        else newSet.add(index);
        setCollapsedOutlineItems(newSet);
    };

    const jumpToLine = (lineIndex: number) => {
        window.dispatchEvent(new CustomEvent('editor-jump-to-line', { detail: { lineIndex } }));
    };

    const quickNotesSnippets = useMemo(() => {
        return notes
            .filter(n => n.projectId === 'quick_notes')
            .sort((a, b) => b.createdAt - a.createdAt)
            .map(n => ({
                id: n.id,
                snippet: n.content.trim().replace(/[\n\r]+/g, ' ').substring(0, 20) + (n.content.trim().length > 20 ? '...' : '')
            }));
    }, [notes]);

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

    const handleRenameNoteSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (renamingNoteId && renameNoteName.trim()) {
            onRenameNote(renamingNoteId, renameNoteName.trim());
            setRenamingNoteId(null);
            setRenameNoteName('');
        } else {
            setRenamingNoteId(null);
        }
    };

    const startRenaming = (e: React.MouseEvent, project: Project) => {
        e.stopPropagation();
        setRenamingProjectId(project.id);
        setRenameProjectName(project.name);
    };

    const handleRenameNoteClick = (e: React.MouseEvent, note: Note) => {
        e.stopPropagation();
        setRenamingNoteId(note.id);
        setRenameNoteName(note.title || 'Untitled');
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

    const effectiveThemeIsDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    return (
        <aside className={`${isCollapsed ? 'w-16' : 'w-80'} bg-gray-50 dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 h-full flex transition-all duration-300 ease-in-out relative z-30 flex-shrink-0`}>
            {/* 1. Leftmost Narrow Nav Bar */}
            <div className="w-16 flex-shrink-0 border-r border-gray-200 dark:border-slate-800 flex flex-col items-center py-4 bg-gray-100/50 dark:bg-slate-950/50 z-20">
                <div className="flex flex-col gap-4 flex-1 w-full items-center">
                    <button
                        onClick={() => handleTabChange('projects')}
                        className={`p-3 rounded-xl transition-all ${activeTab === 'projects' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm border border-gray-200 dark:border-slate-700' : 'text-gray-400 hover:text-gray-600 dark:hover:text-slate-300'}`}
                        title="Explorer"
                    >
                        <Folder size={20} />
                    </button>
                    <button
                        onClick={() => handleTabChange('search')}
                        className={`p-3 rounded-xl transition-all ${activeTab === 'search' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm border border-gray-200 dark:border-slate-700' : 'text-gray-400 hover:text-gray-600 dark:hover:text-slate-300'}`}
                        title="Search"
                    >
                        <Search size={20} />
                    </button>
                    <button
                        onClick={() => handleTabChange('outline')}
                        className={`p-3 rounded-xl transition-all ${activeTab === 'outline' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm border border-gray-200 dark:border-slate-700' : 'text-gray-400 hover:text-gray-600 dark:hover:text-slate-300'}`}
                        title="Outline"
                    >
                        <AlignJustify size={20} />
                    </button>
                </div>

                <div className="flex flex-col gap-2 w-full items-center pb-2">
                    <button
                        onClick={onToggleTheme}
                        className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
                        title="Toggle Theme"
                    >
                        {effectiveThemeIsDark ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                    <button
                        onClick={onOpenSettings}
                        className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
                        title="Settings"
                    >
                        <Settings size={20} />
                    </button>
                </div>
            </div>

            {/* 2. Main Sidebar Content Area */}
            <div className={`flex-1 flex flex-col bg-gray-50 dark:bg-slate-900 transition-all duration-300 overflow-hidden ${isCollapsed ? 'w-0' : 'w-64 opacity-100'}`}>

                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="absolute -right-3 top-1/2 -translate-y-1/2 z-50 w-6 h-6 flex items-center justify-center bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-full shadow-md text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors transform hover:scale-110"
                >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>

                <div className="flex-1 overflow-hidden relative">
                    {/* Explorer View */}
                    <div className={`absolute inset-0 flex flex-col transition-all duration-300 transform ${activeTab === 'projects' ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'}`}>
                        <div className="px-4 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-500 dark:text-slate-500 uppercase tracking-tight">Explorer</span>
                            <button onClick={handleCreateClick} className="p-1 hover:bg-gray-200 dark:hover:bg-slate-800 rounded text-gray-500 dark:text-slate-400">
                                <Plus size={16} />
                            </button>
                        </div>

                        {isCreating && (
                            <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50">
                                <form onSubmit={handleCreateProjectSubmit} className="flex gap-1.5 items-center">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        className="flex-1 min-w-0 px-2 py-1 text-xs border border-blue-300 dark:border-blue-900 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="Project name..."
                                        value={newProjectName}
                                        onChange={(e) => setNewProjectName(e.target.value)}
                                        onBlur={() => { if (!newProjectName.trim()) setIsCreating(false); }}
                                        onKeyDown={(e) => { if (e.key === 'Escape') setIsCreating(false); }}
                                    />
                                    <button type="submit" className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700">
                                        <Check size={14} />
                                    </button>
                                </form>
                            </div>
                        )}

                        <nav className="flex-1 overflow-y-auto py-2 custom-scrollbar">
                            {/* Quick Notes Entry */}
                            <button
                                onClick={() => onSelectProject('project', 'quick_notes')}
                                className={`w-full text-left py-2 px-4 flex items-center gap-3 text-sm transition-all mb-1 ${activeProjectId === 'quick_notes' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-r-2 border-blue-500' : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                            >
                                <Zap size={18} className={activeProjectId === 'quick_notes' ? 'text-blue-600 dark:text-blue-400' : 'text-orange-500'} />
                                <span className="font-medium truncate">Quick Notes</span>
                            </button>

                            <div className="mt-4 px-4 mb-2 text-[10px] font-bold text-gray-400 dark:text-slate-600 uppercase">Projects</div>

                            {projects.map((project) => (
                                <div key={project.id} className="mb-0.5">
                                    <div className={`w-full flex items-center px-2 py-1.5 text-sm cursor-pointer group/row ${activeProjectId === project.id ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-gray-100 dark:hover:bg-slate-800'}`} onClick={() => onSelectProject('project', project.id)}>
                                        <button onClick={(e) => toggleProjectExpand(e, project.id)} className="p-1 text-gray-400 transition-transform">
                                            {expandedProjects.has(project.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </button>
                                        <div className="flex-1 flex items-center gap-2 min-w-0">
                                            {expandedProjects.has(project.id) ? <FolderOpen size={16} className="text-blue-500 flex-shrink-0" /> : <Folder size={16} className="text-blue-500 flex-shrink-0" />}
                                            {renamingProjectId === project.id ? (
                                                <form onSubmit={handleRenameSubmit} className="flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        ref={renameInputRef}
                                                        type="text"
                                                        className="w-full bg-white dark:bg-slate-800 border border-blue-500 rounded px-1 py-0.5 text-xs text-gray-900 dark:text-white outline-none"
                                                        value={renameProjectName}
                                                        onChange={(e) => setRenameProjectName(e.target.value)}
                                                        onBlur={() => handleRenameSubmit()}
                                                    />
                                                </form>
                                            ) : (
                                                <span className="truncate text-gray-700 dark:text-slate-300">{project.name}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-0.5 pr-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setExpandedProjects(prev => new Set(prev).add(project.id)); setCreatingNoteInProjectId(project.id); }}
                                                className="p-1 text-gray-400 hover:text-green-500"
                                                title="New Note"
                                            >
                                                <Plus size={12} />
                                            </button>
                                            <button
                                                onClick={(e) => startRenaming(e, project)}
                                                className="p-1 text-gray-400 hover:text-blue-500"
                                                title="Rename"
                                            >
                                                <Pencil size={12} />
                                            </button>
                                            <button
                                                onClick={(e) => handleDeleteProjectClick(e, project.id)}
                                                className="p-1 text-gray-400 hover:text-red-500"
                                                title="Delete"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                    {expandedProjects.has(project.id) && (
                                        <div className="ml-6 border-l border-gray-200 dark:border-slate-800 pl-1">
                                            {creatingNoteInProjectId === project.id && (
                                                <div className="px-3 py-1.5 animate-in slide-in-from-top-1">
                                                    <form onSubmit={handleCreateNoteSubmit} className="flex gap-1 items-center">
                                                        <FileText size={14} className="text-gray-400" />
                                                        <input
                                                            ref={fileInputRef}
                                                            type="text"
                                                            className="w-full bg-transparent border-b border-blue-500 text-xs focus:outline-none py-0.5 text-gray-800 dark:text-gray-200"
                                                            placeholder="Note name..."
                                                            value={newNoteName}
                                                            onChange={(e) => setNewNoteName(e.target.value)}
                                                            onBlur={() => { if (!newNoteName.trim()) setCreatingNoteInProjectId(null); }}
                                                            onKeyDown={(e) => { if (e.key === 'Escape') setCreatingNoteInProjectId(null); }}
                                                        />
                                                    </form>
                                                </div>
                                            )}
                                            {(notesByProject[project.id] || []).map(note => (
                                                <div key={note.id} className="relative group/note">
                                                    {renamingNoteId === note.id ? (
                                                        <div className="px-3 py-1.5 ml-8 border-b border-blue-500">
                                                            <form onSubmit={handleRenameNoteSubmit} onClick={e => e.stopPropagation()}>
                                                                <input
                                                                    ref={renameInputRef}
                                                                    type="text"
                                                                    className="w-full bg-transparent text-xs text-gray-900 dark:text-white outline-none"
                                                                    value={renameNoteName}
                                                                    onChange={(e) => setRenameNoteName(e.target.value)}
                                                                    onBlur={() => handleRenameNoteSubmit()}
                                                                />
                                                            </form>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => onNavigate('note', note.id)}
                                                            className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs truncate transition-colors ${activeNoteId === note.id ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-l' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400'}`}
                                                            style={{ paddingLeft: '2.5rem' }}
                                                        >
                                                            <FileText size={12} className="flex-shrink-0" />
                                                            <span className="truncate">{note.title || 'Untitled'}</span>
                                                        </button>
                                                    )}
                                                    <div className="absolute right-1 top-1.5 flex gap-0.5 opacity-0 group-hover/note:opacity-100 transition-opacity bg-white dark:bg-slate-900 shadow-sm rounded">
                                                        <button
                                                            onClick={(e) => handleRenameNoteClick(e, note)}
                                                            className="p-0.5 text-gray-300 hover:text-blue-500"
                                                            title="Rename Note"
                                                        >
                                                            <Pencil size={12} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteNoteClick(e, note.id); }}
                                                            className="p-0.5 text-gray-300 hover:text-red-500"
                                                            title="Delete Note"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </nav>
                    </div>

                    {/* Search View */}
                    <div className={`absolute inset-0 flex flex-col transition-all duration-300 transform ${activeTab === 'search' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}`}>
                        <div className="p-4 border-b border-gray-200 dark:border-slate-800">
                            <div className="relative">
                                <Search className="absolute left-3 top-[11px] text-gray-400" size={14} />
                                <input ref={searchInputRef} type="text" className="w-full pl-9 pr-8 py-2 text-sm bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Search everywhere..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                            {searchQuery && searchResults.notes.map(n => (
                                <button key={n.id} onClick={() => onNavigate('note', n.id, searchQuery)} className="w-full text-left p-3 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg border-b border-gray-100 dark:border-slate-800/50 mb-1">
                                    <div className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate mb-1">{n.title || 'Untitled'}</div>
                                    <div className="text-xs text-gray-500 line-clamp-2">{n.snippet}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Outline View */}
                    <div className={`absolute inset-0 flex flex-col transition-all duration-300 transform ${activeTab === 'outline' ? 'translate-x-0 opacity-100' : 'translate-x-[200%] opacity-0 pointer-events-none'}`}>
                        <div className="px-4 py-4 border-b border-gray-200 dark:border-slate-800">
                            <span className="text-xs font-bold text-gray-500 dark:text-slate-500 uppercase tracking-tight">Outline</span>
                        </div>
                        <div className="flex-1 overflow-y-auto py-4 px-2 custom-scrollbar">
                            {activeProjectId === 'quick_notes' ? (
                                /* Quick Notes Snippets */
                                <div className="space-y-1">
                                    {quickNotesSnippets.map(qn => (
                                        <button
                                            key={qn.id}
                                            onClick={() => onNavigate('note', qn.id)}
                                            className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-all ${activeNoteId === qn.id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 font-medium' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                                        >
                                            {qn.snippet}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                /* Markdown Outline Tree */
                                <div className="space-y-0.5">
                                    {outlineTree.map((h, i) => {
                                        // Skip if parent is collapsed
                                        // Simplified logic: find last parent and check its collapse state
                                        let isHidden = false;
                                        for (let prevIdx = i - 1; prevIdx >= 0; prevIdx--) {
                                            if (outlineTree[prevIdx].relLevel < h.relLevel) {
                                                if (collapsedOutlineItems.has(prevIdx)) {
                                                    isHidden = true;
                                                }
                                                break;
                                            }
                                        }

                                        if (isHidden) return null;

                                        const hasChildren = (i + 1 < outlineTree.length) && outlineTree[i + 1].relLevel > h.relLevel;
                                        const isCollapsed = collapsedOutlineItems.has(i);

                                        return (
                                            <div
                                                key={i}
                                                onClick={() => jumpToLine(h.lineIndex)}
                                                className="group/outline relative flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800/50 transition-colors"
                                                style={{ paddingLeft: `${h.relLevel * 16 + 8}px` }}
                                            >
                                                {hasChildren ? (
                                                    <button
                                                        onClick={(e) => toggleOutlineCollapse(e, i)}
                                                        className="p-0.5 -ml-4 text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-colors"
                                                    >
                                                        {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                                                    </button>
                                                ) : null}
                                                <span className={`text-[13px] truncate ${h.relLevel === 0 ? 'font-semibold text-gray-800 dark:text-gray-200' : h.relLevel === 1 ? 'font-medium text-gray-700 dark:text-gray-300' : 'text-gray-600 dark:text-gray-400'}`}>
                                                    {h.text}
                                                </span>
                                            </div>
                                        );
                                    })}
                                    {outlineTree.length === 0 && (
                                        <div className="px-4 py-10 text-center text-xs text-gray-400 italic">No headings found</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
};
