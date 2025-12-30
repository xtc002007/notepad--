
import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { Project, Note, NoteType, Theme, AppSettings, DEFAULT_SETTINGS } from './types';
// import { Loader2 } from 'lucide-react'; // Removed to optimize initial load
import { storage } from './storage';

// Lazy load components to improve startup performance
const Sidebar = React.lazy(() => import('./components/Sidebar').then(m => ({ default: m.Sidebar })));
const Workspace = React.lazy(() => import('./components/Workspace').then(m => ({ default: m.Workspace })));
const QuickNotesView = React.lazy(() => import('./components/QuickNotesView').then(m => ({ default: m.QuickNotesView })));
const SettingsModal = React.lazy(() => import('./components/SettingsModal').then(m => ({ default: m.SettingsModal })));

// Utility for ID generation since we don't have external libs
const generateId = () => Math.random().toString(36).substring(2, 9);

// Special ID for Quick Notes View
const QUICK_NOTES_VIEW_ID = 'quick_notes';

const MainApp: React.FC = () => {
  // Loading State
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Data State
  const [projects, setProjects] = useState<Project[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  // Settings State
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const [activeProjectId, setActiveProjectId] = useState<string | null>(QUICK_NOTES_VIEW_ID);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [highlightNoteId, setHighlightNoteId] = useState<string | undefined>(undefined);
  const [navigatedSearchQuery, setNavigatedSearchQuery] = useState<string>(''); // For passing search context
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // --- Data Loading ---
  useEffect(() => {
    const loadData = async () => {
      try {
        await storage.init();
        const [loadedProjects, loadedNotes, loadedSettings] = await Promise.all([
          storage.getProjects(),
          storage.getNotes(),
          storage.getSettings()
        ]);
        setProjects(loadedProjects);
        setNotes(loadedNotes);
        setSettings(loadedSettings);
      } catch (error) {
        console.error("Failed to load initial data", error);
      } finally {
        setIsDataLoaded(true);
      }
    };
    loadData();
  }, []);

  // --- Settings Persistence & Application ---
  useEffect(() => {
    if (isDataLoaded) {
      storage.saveSettings(settings);
    }

    // Apply Theme
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (settings.theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(settings.theme);
    }

    // Apply Global Font Family (Fallback/UI)
    // We update a CSS variable or specific class logic here if needed, 
    // but Workspace handles the specific editor font logic.
  }, [settings, isDataLoaded]);


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
    storage.saveProject(newProject);
  };

  const handleRenameProject = (projectId: string, newName: string) => {
    const updatedProject = { ...projects.find(p => p.id === projectId)!, name: newName, updatedAt: Date.now() };
    setProjects(prev => prev.map(p => p.id === projectId ? updatedProject : p));
    storage.saveProject(updatedProject);
  };

  const handleDeleteProject = (projectId: string) => {
    if (window.confirm('Are you sure you want to delete this project? All notes inside it will be deleted.')) {
      setProjects(prev => prev.filter(p => p.id !== projectId));
      setNotes(prev => prev.filter(n => n.projectId !== projectId));
      if (activeProjectId === projectId) {
        setActiveProjectId(QUICK_NOTES_VIEW_ID);
        setActiveNoteId(null);
      }
      storage.deleteProject(projectId);
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
    storage.saveNote(newNote);

    if (pid !== QUICK_NOTES_VIEW_ID && pid !== 'uncategorized') {
      const p = projects.find(proj => proj.id === pid);
      if (p) {
        const updatedProject = { ...p, updatedAt: Date.now() };
        setProjects(prev => prev.map(proj => proj.id === pid ? updatedProject : proj));
        storage.saveProject(updatedProject);
      }
    }

    setActiveProjectId(pid);
    setActiveNoteId(newNote.id);
  };

  const handleRenameNote = (noteId: string, newTitle: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      const updatedNote = { ...note, title: newTitle };
      setNotes(prev => prev.map(n => n.id === noteId ? updatedNote : n));
      storage.saveNote(updatedNote);
    }
  };

  const handleUpdateNoteContent = (noteId: string, newContent: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      const updatedNote = { ...note, content: newContent };
      setNotes(prev => prev.map(n => n.id === noteId ? updatedNote : n));
      storage.saveNote(updatedNote); // 这种全量覆盖的方法对 3万条数据来说是安全的
    }
  };

  const handleDeleteNote = (noteId: string) => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      setNotes(prev => prev.filter(n => n.id !== noteId));
      if (activeNoteId === noteId) {
        setActiveNoteId(null);
      }
      storage.deleteNote(noteId);
    }
  };

  const handleMoveNote = (noteId: string, targetProjectId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      const updatedNote = { ...note, projectId: targetProjectId };
      setNotes(prev => prev.map(n => n.id === noteId ? updatedNote : n));
      storage.saveNote(updatedNote);
    }
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
    const dataStr = JSON.stringify({ projects, notes, settings }, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `notepad--_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleQuickTheme = () => {
    setSettings(prev => {
      let newTheme: Theme;
      if (prev.theme === 'light') newTheme = 'dark';
      else if (prev.theme === 'dark') newTheme = 'light';
      else newTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark';
      return { ...prev, theme: newTheme };
    });
  };

  // if (!isDataLoaded) {
  //   return (
  //     <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-slate-950 text-gray-400">
  //       <Loader2 className="animate-spin" size={32} />
  //     </div>
  //   );
  // }

  // Map internal font state to Tailwind classes (for UI elements, distinct from Editor)
  const fontClass = settings.fontFamily === 'serif' ? 'font-serif' : settings.fontFamily === 'mono' ? 'font-mono' : 'font-sans';

  // Simple SVG Spinner to avoid loading lucide-react just for the loader
  const LoadingSpinner = () => (
    <svg className="animate-spin text-gray-400" width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.1" />
      <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return (
    <div className={`flex h-screen w-full bg-white dark:bg-slate-950 text-gray-900 dark:text-gray-100 overflow-hidden transition-colors duration-200 ${fontClass}`}>
      <Suspense fallback={
        <div className="flex h-full w-full items-center justify-center">
          <LoadingSpinner />
        </div>
      }>
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
          theme={settings.theme}
          onToggleTheme={toggleQuickTheme}
        />

        <div className="flex-1 flex flex-col min-w-0">
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
              settings={settings}
            />
          )}
        </div>

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onUpdateSettings={setSettings}
          onClearData={handleClearData}
          onExportData={handleExportData}
        />
      </Suspense>
    </div>
  );
};

export default MainApp;
