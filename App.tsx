
import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { Workspace } from './components/Workspace';
import { QuickNotesView } from './components/QuickNotesView';
import { SettingsModal } from './components/SettingsModal';
import { Project, Note, NoteType, Theme } from './types';
import { Sun, Moon, Loader2 } from 'lucide-react';
import { storage } from './storage';

// Utility for ID generation since we don't have external libs
const generateId = () => Math.random().toString(36).substring(2, 9);

// Special ID for Quick Notes View
const QUICK_NOTES_VIEW_ID = 'quick_notes';

const App: React.FC = () => {
  // Loading State
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Data State
  const [projects, setProjects] = useState<Project[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  // Theme State (Sync initialization for UI stability)
  const [theme, setTheme] = useState<Theme>(() => storage.getTheme());

  const [activeProjectId, setActiveProjectId] = useState<string | null>(QUICK_NOTES_VIEW_ID); 
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null); 
  const [highlightNoteId, setHighlightNoteId] = useState<string | undefined>(undefined);
  const [navigatedSearchQuery, setNavigatedSearchQuery] = useState<string>(''); // For passing search context
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // --- Data Loading ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const [loadedProjects, loadedNotes] = await Promise.all([
          storage.getProjects(),
          storage.getNotes()
        ]);
        setProjects(loadedProjects);
        setNotes(loadedNotes);
      } catch (error) {
        console.error("Failed to load initial data", error);
      } finally {
        setIsDataLoaded(true);
      }
    };
    loadData();
  }, []);

  // --- Persistence (Auto-save) ---
  // Only save if data has finished loading to prevent overwriting with empty arrays
  useEffect(() => {
    if (isDataLoaded) {
      storage.saveProjects(projects);
    }
  }, [projects, isDataLoaded]);

  useEffect(() => {
    if (isDataLoaded) {
      storage.saveNotes(notes);
    }
  }, [notes, isDataLoaded]);

  // --- Theme Handling ---
  useEffect(() => {
    storage.saveTheme(theme);
    
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  // Derived State
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [projects]);

  const activeNotes = useMemo(() => {
    if (activeProjectId === QUICK_NOTES_VIEW_ID) {
        return notes
            .filter((n) => n.projectId === QUICK_NOTES_VIEW_ID)
            .sort((a, b) => b.createdAt - a.createdAt); 
    }
    return notes.filter((n) => n.projectId === activeProjectId);
  }, [notes, activeProjectId]);

  const activeProject = useMemo(() => 
    projects.find(p => p.id === activeProjectId) || null
  , [projects, activeProjectId]);

  // Actions
  const handleAddProject = (name: string) => {
    const newProject: Project = {
      id: generateId(),
      name,
      updatedAt: Date.now(),
    };
    setProjects([newProject, ...projects]);
    setActiveProjectId(newProject.id);
    setActiveNoteId(null);
  };

  const handleRenameProject = (projectId: string, newName: string) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, name: newName, updatedAt: Date.now() } : p));
  };

  const handleDeleteProject = (projectId: string) => {
    if (window.confirm('Are you sure you want to delete this project? All notes inside it will be deleted.')) {
        setProjects(prev => prev.filter(p => p.id !== projectId));
        setNotes(prev => prev.filter(n => n.projectId !== projectId));
        if (activeProjectId === projectId) {
            setActiveProjectId(QUICK_NOTES_VIEW_ID);
            setActiveNoteId(null);
        }
    }
  };

  const handleAddNote = (content: string, type: NoteType, title?: string, specificProjectId?: string) => {
    const pid = specificProjectId || activeProjectId || 'uncategorized'; 
    
    const newNote: Note = {
      id: generateId(),
      projectId: pid,
      type,
      content,
      title: title || (type === NoteType.TEXT ? 'Untitled' : 'File'),
      createdAt: Date.now(),
    };

    setNotes([...notes, newNote]);

    if (pid !== QUICK_NOTES_VIEW_ID && pid !== 'uncategorized') {
      setProjects(prev => prev.map(p => 
        p.id === pid ? { ...p, updatedAt: Date.now() } : p
      ));
    }
    
    setActiveProjectId(pid);
    setActiveNoteId(newNote.id);
  };

  const handleRenameNote = (noteId: string, newTitle: string) => {
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, title: newTitle } : n));
  };

  const handleUpdateNoteContent = (noteId: string, newContent: string) => {
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, content: newContent } : n));
  };

  const handleDeleteNote = (noteId: string) => {
      if (window.confirm('Are you sure you want to delete this note?')) {
          setNotes(prev => prev.filter(n => n.id !== noteId));
          if (activeNoteId === noteId) {
              setActiveNoteId(null);
          }
      }
  };

  const handleMoveNote = (noteId: string, targetProjectId: string) => {
    setNotes(prev => prev.map(n => 
        n.id === noteId ? { ...n, projectId: targetProjectId } : n
    ));
  };

  const handleNavigate = (type: 'project' | 'note', id: string, searchQuery?: string) => {
    if (type === 'project') {
      setActiveProjectId(id);
      setActiveNoteId(null);
      setHighlightNoteId(undefined);
      setNavigatedSearchQuery('');
    } else {
      const note = notes.find(n => n.id === id);
      if (note) {
        setActiveProjectId(note.projectId === 'uncategorized' ? null : note.projectId);
        setActiveNoteId(id);
        setHighlightNoteId(id);
        setNavigatedSearchQuery(searchQuery || '');
        setTimeout(() => setHighlightNoteId(undefined), 2000);
      }
    }
  };

  const handleClearData = async () => {
    if (confirm('Are you sure you want to delete all notes and projects? This cannot be undone.')) {
      await storage.clearAllData();
      setProjects([]);
      setNotes([]);
      setActiveProjectId(QUICK_NOTES_VIEW_ID);
      setActiveNoteId(null);
      setIsSettingsOpen(false);
    }
  };

  const handleExportData = () => {
    const dataStr = JSON.stringify({ projects, notes }, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zennote_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleQuickTheme = () => {
    setTheme(current => {
      if (current === 'light') return 'dark';
      if (current === 'dark') return 'light';
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return isSystemDark ? 'light' : 'dark';
    });
  };

  const effectiveThemeIsDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (!isDataLoaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-slate-950 text-gray-400">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-white dark:bg-slate-950 text-gray-900 dark:text-gray-100 font-sans overflow-hidden transition-colors duration-200">
      <Sidebar 
        projects={sortedProjects} 
        notes={notes}
        activeProjectId={activeProjectId} 
        activeNoteId={activeNoteId}
        onSelectProject={handleNavigate}
        onAddProject={handleAddProject}
        onRenameProject={handleRenameProject}
        onDeleteProject={handleDeleteProject}
        onAddNote={handleAddNote}
        onDeleteNote={handleDeleteNote}
        onNavigate={handleNavigate}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 border-b border-gray-100 dark:border-slate-800 flex items-center justify-end px-4 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md z-20 flex-shrink-0">
          <div className="flex items-center gap-2 z-10">
            <button 
              onClick={toggleQuickTheme}
              className="p-2 text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-all"
              title="Toggle Theme"
            >
              {effectiveThemeIsDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>

        {activeProjectId === QUICK_NOTES_VIEW_ID ? (
            <QuickNotesView 
                notes={activeNotes}
                projects={projects}
                onAddNote={handleAddNote}
                onMoveNote={handleMoveNote}
                highlightNoteId={highlightNoteId}
                searchQuery={navigatedSearchQuery}
            />
        ) : (
            <Workspace 
                project={activeProject}
                notes={activeNotes}
                activeNoteId={activeNoteId}
                initialSearchQuery={navigatedSearchQuery}
                onAddNote={handleAddNote}
                onRenameProject={handleRenameProject}
                onRenameNote={handleRenameNote}
                onUpdateNoteContent={handleUpdateNoteContent}
                highlightNoteId={highlightNoteId}
            />
        )}
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        onClearData={handleClearData}
        onExportData={handleExportData}
      />
    </div>
  );
};

export default App;
