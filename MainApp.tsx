import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { Project, Note, NoteType, Theme, AppSettings, DEFAULT_SETTINGS, UserHabits, DEFAULT_USER_HABITS } from './types';
import { storage } from './storage';
import { getCurrentWindow } from '@tauri-apps/api/window';

// Lazy load components to improve startup performance
const Sidebar = React.lazy(() => import('./components/Sidebar').then(m => ({ default: m.Sidebar })));
const Workspace = React.lazy(() => import('./components/Workspace').then(m => ({ default: m.Workspace })));
const QuickNotesView = React.lazy(() => import('./components/QuickNotesView').then(m => ({ default: m.QuickNotesView })));
const SettingsModal = React.lazy(() => import('./components/SettingsModal').then(m => ({ default: m.SettingsModal })));
const ConfirmDialog = React.lazy(() => import('./components/ConfirmDialog').then(m => ({ default: m.ConfirmDialog })));

// Utility for ID generation since we don't have external libs
const generateId = () => Math.random().toString(36).substring(2, 9);

// Special ID for Quick Notes View
const QUICK_NOTES_VIEW_ID = 'quick_notes';

type LegacyUserHabits = UserHabits & {
  collapsedQuickNoteIds?: string[];
  previewQuickNoteIds?: string[];
};

const MainApp: React.FC = () => {
  // Loading State
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Data State
  const [projects, setProjects] = useState<Project[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  // Settings State
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // User Habits State
  const [userHabits, setUserHabits] = useState<UserHabits>(DEFAULT_USER_HABITS);

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null); // Start null to wait for habits
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [highlightNoteId, setHighlightNoteId] = useState<string | undefined>(undefined);
  const [navigatedSearchQuery, setNavigatedSearchQuery] = useState<string>(''); // For passing search context
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // --- Data Loading ---
  useEffect(() => {
    const loadData = async () => {
      try {
        await storage.init();
        const [loadedProjects, loadedNotes, loadedSettings, loadedHabits] = await Promise.all([
          storage.getProjects(),
          storage.getNotes(),
          storage.getSettings(),
          storage.getUserHabits()
        ]);

        // Migrate old keys if present
        const migrated = { ...loadedHabits };
        const raw = loadedHabits as LegacyUserHabits;
        if (raw.collapsedQuickNoteIds && !migrated.collapsedNoteIds?.length) {
          migrated.collapsedNoteIds = raw.collapsedQuickNoteIds;
        }
        if (raw.previewQuickNoteIds && !migrated.previewNoteIds?.length) {
          migrated.previewNoteIds = raw.previewQuickNoteIds;
        }

        const initialActive = migrated.lastActiveProjectId || QUICK_NOTES_VIEW_ID;
        const initialNoteId = migrated.lastActiveNoteId && loadedNotes.some(
          note => note.id === migrated.lastActiveNoteId && note.projectId === initialActive
        ) ? migrated.lastActiveNoteId : null;

        // Ensure initial active project is expanded
        if (initialActive !== QUICK_NOTES_VIEW_ID && initialActive !== 'uncategorized') {
          const currentExpanded = migrated.expandedProjectIds || [];
          if (!currentExpanded.includes(initialActive)) {
            migrated.expandedProjectIds = [...currentExpanded, initialActive];
          }
        }

        setProjects(loadedProjects);
        setNotes(loadedNotes);
        setSettings(loadedSettings);
        setUserHabits(migrated);

        // Set initial active state based on habits
        setActiveProjectId(initialActive);
        setActiveNoteId(initialNoteId);
      } catch (error) {
        console.error("Failed to load initial data", error);
      } finally {
        setIsDataLoaded(true);
      }
    };
    loadData();
  }, []);

  // --- Close Handler (Auto-Backup) ---
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let isClosing = false;

    const setupCloseListener = async () => {
      const win = getCurrentWindow();
      unlisten = await win.onCloseRequested(async (event) => {
        if (isClosing) return; // Prevent recursion

        if (settings.autoBackup && settings.backupPath) {
          isClosing = true;
          console.log('[MainApp] Program closing, performing backup...');
          event.preventDefault(); // Pause closing
          try {
            await storage.triggerBackup();
          } catch (e) {
            console.error('Backup failed:', e);
          }
          await win.close(); // Trigger close again, will be caught by "if (isClosing) return"
        }
      });
    };

    setupCloseListener();

    return () => {
      if (unlisten && typeof unlisten === 'function') unlisten();
    };
  }, [settings]);

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

  // --- Habits Persistence ---
  useEffect(() => {
    if (isDataLoaded) {
      storage.saveUserHabits(userHabits);
    }
  }, [userHabits, isDataLoaded]);


  // Derived State
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [projects]);

  const activeNotes = useMemo(() => {
    if (activeProjectId === QUICK_NOTES_VIEW_ID) {
      return notes
        .filter((n) => n.projectId === QUICK_NOTES_VIEW_ID)
        .sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
        });
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
    setUserHabits(prev => ({
      ...prev,
      lastActiveProjectId: newProject.id,
      lastActiveNoteId: null,
      expandedProjectIds: [...new Set([...prev.expandedProjectIds, newProject.id])]
    }));
    storage.saveProject(newProject);
  };

  const handleRenameProject = (projectId: string, newName: string) => {
    const updatedProject = { ...projects.find(p => p.id === projectId)!, name: newName, updatedAt: Date.now() };
    setProjects(prev => prev.map(p => p.id === projectId ? updatedProject : p));
    storage.saveProject(updatedProject);
  };

  const handleDeleteProject = (projectId: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Delete Project',
      message: 'Are you sure you want to delete this project? All notes inside it will be deleted permanently.',
      onConfirm: () => {
        setProjects(prev => prev.filter(p => p.id !== projectId));
        setNotes(prev => prev.filter(n => n.projectId !== projectId));
        if (activeProjectId === projectId) {
          setActiveProjectId(QUICK_NOTES_VIEW_ID);
          setActiveNoteId(null);
          setUserHabits(prev => ({ ...prev, lastActiveProjectId: QUICK_NOTES_VIEW_ID, lastActiveNoteId: null }));
        }
        storage.deleteProject(projectId);
        setConfirmState(null);
      }
    });
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
    setUserHabits(prev => ({
      ...prev,
      lastActiveProjectId: pid,
      lastActiveNoteId: newNote.id,
      editorViewMode: 'raw',
      projectLastNoteIds: { ...prev.projectLastNoteIds, [pid]: newNote.id }
    }));
  };

  const handleRenameNote = (noteId: string, newTitle: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      const updatedNote = { ...note, title: newTitle, updatedAt: Date.now() };
      setNotes(prev => prev.map(n => n.id === noteId ? updatedNote : n));
      storage.saveNote(updatedNote);
    }
  };

  const handleUpdateNoteContent = (noteId: string, newContent: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      const updatedNote = { ...note, content: newContent, updatedAt: Date.now() };
      setNotes(prev => prev.map(n => n.id === noteId ? updatedNote : n));
      storage.saveNote(updatedNote);
    }
  };

  const handleUpdateNote = (noteId: string, updates: Partial<Note>) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      const updatedNote = { ...note, ...updates, updatedAt: updates.updatedAt ?? Date.now() };
      setNotes(prev => prev.map(n => n.id === noteId ? updatedNote : n));
      storage.saveNote(updatedNote);
    }
  };

  const handleNotesReorder = (projectId: string, noteIds: string[]) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      const updatedProject = { ...project, noteOrder: noteIds, updatedAt: Date.now() };
      setProjects(prev => prev.map(p => p.id === projectId ? updatedProject : p));
      storage.saveProject(updatedProject);
    }
  };

  const handleTouchNote = (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      // Only update if it's been more than 1 second to avoid spamming updates during rapid interactions
      // Actually user wants "trigger update... show at top", so immediate update is fine.
      // But let's avoid updating if nothing changed? No, "view/expand" should trigger it.
      // Use setTimeout to ensure the sorting update doesn't conflict with other immediate UI state updates
      // (like toggling collapse/preview) that might occur in the same event loop.
      setTimeout(() => {
        setNotes(prev => {
          const currentNote = prev.find(n => n.id === noteId);
          if (!currentNote) return prev;
          const updated = { ...currentNote, updatedAt: Date.now() };
          storage.saveNote(updated);
          return prev.map(n => n.id === noteId ? updated : n);
        });
      }, 50);
    }
  };

  const handleTogglePin = (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      const updatedNote = { ...note, isPinned: !note.isPinned, updatedAt: Date.now() };
      setNotes(prev => prev.map(n => n.id === noteId ? updatedNote : n));
      storage.saveNote(updatedNote);
    }
  };

  const handleDeleteNote = (noteId: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Delete Note',
      message: 'Are you sure you want to delete this note? This action cannot be undone.',
      onConfirm: () => {
        setNotes(prev => prev.filter(n => n.id !== noteId));
        if (activeNoteId === noteId) {
          setActiveNoteId(null);
          setUserHabits(prev => ({ ...prev, lastActiveNoteId: null }));
        }
        storage.deleteNote(noteId);
        setConfirmState(null);
      }
    });
  };

  const handleMoveNote = (noteId: string, targetProjectId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      const now = Date.now();
      const updatedNote = { ...note, projectId: targetProjectId, updatedAt: now };
      setNotes(prev => prev.map(n => n.id === noteId ? updatedNote : n));
      storage.saveNote(updatedNote);
      if (targetProjectId !== QUICK_NOTES_VIEW_ID && targetProjectId !== 'uncategorized') {
        setProjects(prev => prev.map(project => {
          if (project.id !== targetProjectId) return project;
          const updatedProject = { ...project, updatedAt: now };
          storage.saveProject(updatedProject);
          return updatedProject;
        }));
      }
      if (activeNoteId === noteId) {
        setActiveProjectId(targetProjectId);
        setUserHabits(prev => ({
          ...prev,
          lastActiveProjectId: targetProjectId,
          projectLastNoteIds: { ...prev.projectLastNoteIds, [targetProjectId]: noteId },
          expandedProjectIds: targetProjectId !== QUICK_NOTES_VIEW_ID && !prev.expandedProjectIds.includes(targetProjectId)
            ? [...prev.expandedProjectIds, targetProjectId]
            : prev.expandedProjectIds
        }));
      }
    }
  };

  const handleMergeProjects = async (projectIds: string[]) => {
    if (projectIds.length < 2) return;

    const targetProjects = projects.filter(p => projectIds.includes(p.id));
    if (targetProjects.length < 2) return;

    // Sort by updatedAt assuming older projects might have smaller update times, 
    // or just rely on 'First Selected' if we can't determine age. 
    // Let's use updatedAt ascending as a stable sort for "creation-ish" order.
    const sortedProjects = [...targetProjects].sort((a, b) => a.updatedAt - b.updatedAt);

    const baseProject = sortedProjects[0];
    const sourceProjects = sortedProjects.slice(1);
    const sourceIds = sourceProjects.map(p => p.id);

    const now = Date.now();
    const affectedNotes = notes.filter(n => sourceIds.includes(n.projectId));
    const movedNotes = affectedNotes.map(note => ({ ...note, projectId: baseProject.id, updatedAt: now }));

    setNotes(prev => prev.map(n => {
      const movedNote = movedNotes.find(note => note.id === n.id);
      if (movedNote) return movedNote;
      return n;
    }));

    setProjects(prev => prev.filter(p => !sourceIds.includes(p.id)));

    try {
      await Promise.all(movedNotes.map(note => storage.saveNote(note)));
      await Promise.all(sourceIds.map(id => storage.deleteProject(id)));
    } catch (error) {
      console.error('Failed to merge projects:', error);
    }

    // If active project was deleted, switch to base
    if (activeProjectId && sourceIds.includes(activeProjectId)) {
      setActiveProjectId(baseProject.id);
      setUserHabits(prev => ({ ...prev, lastActiveProjectId: baseProject.id }));
    }
  };

  const handleMergeNotes = async (noteIds: string[]) => {
    if (noteIds.length < 2) return;

    const notesToMerge = notes.filter(n => noteIds.includes(n.id));
    if (notesToMerge.length < 2) return;

    // Sort by createdAt ascending (oldest first) so content flows chronologically
    const sortedNotes = [...notesToMerge].sort((a, b) => a.createdAt - b.createdAt);

    // Use the oldest note as the base to preserve history start
    const baseNote = sortedNotes[0];
    const otherNotes = sortedNotes.slice(1);

    // Combine content
    const combinedContent = sortedNotes
      .map(n => n.content.trim())
      .join('\n\n---\n\n');

    const updatedBaseNote: Note = {
      ...baseNote,
      content: combinedContent,
      updatedAt: Date.now(),
      // If any note was pinned, keep the merged note pinned? Or just respect base? 
      // Let's respect base for now, simple.
    };

    const otherIds = otherNotes.map(n => n.id);

    // Update UI & Storage
    setNotes(prev => {
      const remaining = prev.filter(n => !otherIds.includes(n.id));
      return remaining.map(n => n.id === baseNote.id ? updatedBaseNote : n);
    });

    try {
      await storage.saveNote(updatedBaseNote);
      await Promise.all(otherIds.map(id => storage.deleteNote(id)));
    } catch (error) {
      console.error('Failed to merge notes:', error);
    }

    // Reset active if we deleted the active note
    if (activeNoteId && otherIds.includes(activeNoteId)) {
      setActiveNoteId(baseNote.id);
      setUserHabits(prev => ({ ...prev, lastActiveNoteId: baseNote.id }));
    }
  };

  const handleNavigate = (type: 'project' | 'note', id: string, searchQuery?: string) => {
    const now = Date.now();

    if (type === 'project') {
      const projectId = id;
      setActiveProjectId(projectId);
      setNavigatedSearchQuery(searchQuery || '');

      // Update Project Timestamp to bump to top
      if (projectId !== 'quick_notes' && projectId !== 'uncategorized') {
        setProjects(prev => {
          const p = prev.find(p => p.id === projectId);
          if (p) {
            const updated = { ...p, updatedAt: now };
            storage.saveProject(updated);
            return prev.map(item => item.id === projectId ? updated : item);
          }
          return prev;
        });
      }

      // In project view mode 'detail', we no longer auto-open the first note.
      // Instead, we show the project dashboard (activeNoteId = null).
      const viewMode = userHabits.projectViewModes[id] || 'detail';

      let noteToOpen = null;
      if (viewMode === 'list') {
        // In list mode, we still need notes filtered.
      } else {
        // In detail mode, we want a project overview if no note is explicitly selected.
        noteToOpen = null;
      }

      setActiveNoteId(noteToOpen);
      setHighlightNoteId(undefined);

      setUserHabits(prev => ({
        ...prev,
        lastActiveProjectId: projectId,
        lastActiveNoteId: noteToOpen,
        expandedProjectIds: prev.expandedProjectIds.includes(projectId) ? prev.expandedProjectIds : [...prev.expandedProjectIds, projectId]
      }));
    } else { // type === 'note'
      const noteId = id;
      const note = notes.find(n => n.id === noteId);
      if (note) {
        const pid = note.projectId === 'uncategorized' ? null : note.projectId;

        // Update Note Timestamp
        const updatedNote = { ...note, updatedAt: now };

        // Update Notes State and Sort to ensure it bubbles to top
        setNotes(prev => {
          const others = prev.filter(n => n.id !== noteId);
          // Sort entire list to keep consistency
          const newList = [updatedNote, ...others].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
          return newList;
        });
        storage.saveNote(updatedNote);

        // Update Project Timestamp
        if (pid && pid !== 'quick_notes') {
          setProjects(prev => {
            const p = prev.find(proj => proj.id === pid);
            if (p) {
              const updatedP = { ...p, updatedAt: now };
              storage.saveProject(updatedP);
              return prev.map(item => item.id === pid ? updatedP : item);
            }
            return prev;
          });
        }

        setActiveProjectId(pid);
        setActiveNoteId(noteId);
        setNavigatedSearchQuery(searchQuery || '');
        setHighlightNoteId(noteId);

        setUserHabits(prev => ({
          ...prev,
          lastActiveProjectId: pid,
          lastActiveNoteId: noteId,
          projectLastNoteIds: pid ? { ...prev.projectLastNoteIds, [pid]: noteId } : prev.projectLastNoteIds,
          expandedProjectIds: (pid && !prev.expandedProjectIds.includes(pid)) ? [...prev.expandedProjectIds, pid] : prev.expandedProjectIds
        }));

        setTimeout(() => setHighlightNoteId(undefined), 2000);
      }
    }
  };

  const handleClearSearch = () => {
    setNavigatedSearchQuery('');
  };

  const handleClearData = async () => {
    setConfirmState({
      isOpen: true,
      title: 'Reset Application',
      message: 'This will delete ALL your notes and projects. Are you ABSOLUTELY sure? This cannot be undone.',
      onConfirm: async () => {
        await storage.clearAllData();
        setProjects([]);
        setNotes([]);
        setActiveProjectId(QUICK_NOTES_VIEW_ID);
        setActiveNoteId(null);
        setIsSettingsOpen(false);
        setConfirmState(null);
      }
    });
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
          onMergeProjects={handleMergeProjects}
          onDeleteProject={handleDeleteProject}
          onAddNote={handleAddNote}
          onRenameNote={handleRenameNote}
          onDeleteNote={handleDeleteNote}
          onNavigate={handleNavigate}
          onClearSearch={handleClearSearch}
          onOpenSettings={() => setIsSettingsOpen(true)}
          theme={settings.theme}
          onToggleTheme={toggleQuickTheme}
          expandedProjectIds={userHabits.expandedProjectIds || []}
          onUpdateExpandedProjects={(ids) => setUserHabits(prev => ({ ...prev, expandedProjectIds: ids }))}
          isSidebarCollapsed={userHabits.isSidebarCollapsed}
          onToggleSidebar={(collapsed) => setUserHabits(prev => ({ ...prev, isSidebarCollapsed: collapsed }))}
          projectViewModes={userHabits.projectViewModes || {}}
          onUpdateProjectViewMode={(id, mode) => setUserHabits(prev => ({
            ...prev,
            projectViewModes: { ...prev.projectViewModes, [id]: mode }
          }))}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {(activeProjectId === QUICK_NOTES_VIEW_ID || userHabits.projectViewModes[activeProjectId || ''] === 'list') ? (
            <QuickNotesView
              notes={activeNotes}
              onAddNote={handleAddNote}
              onUpdateNoteContent={handleUpdateNoteContent}
              collapsedNoteIds={userHabits.collapsedNoteIds || []}
              onToggleCollapse={(id) => setUserHabits(prev => ({
                ...prev,
                collapsedNoteIds: (prev.collapsedNoteIds || []).includes(id)
                  ? (prev.collapsedNoteIds || []).filter(cid => cid !== id)
                  : [...(prev.collapsedNoteIds || []), id]
              }))}
              previewNoteIds={userHabits.previewNoteIds || []}
              onTogglePreview={(id) => setUserHabits(prev => ({
                ...prev,
                previewNoteIds: (prev.previewNoteIds || []).includes(id)
                  ? (prev.previewNoteIds || []).filter(pid => pid !== id)
                  : [...(prev.previewNoteIds || []), id]
              }))}
              highlightNoteId={highlightNoteId}
              globalSearchQuery={navigatedSearchQuery}
              onTouchNote={handleTouchNote}
              onTogglePin={handleTogglePin}
              initialScrollPosition={userHabits.projectScrollPositions[`${activeProjectId}_list`] || 0}
              onUpdateScrollPosition={(pos) => setUserHabits(prev => ({
                ...prev,
                projectScrollPositions: { ...prev.projectScrollPositions, [`${activeProjectId}_list`]: pos }
              }))}
              onMergeNotes={handleMergeNotes}
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
              onUpdateNote={handleUpdateNote}
              onNavigate={handleNavigate}
              onNotesReorder={(ids) => activeProjectId && handleNotesReorder(activeProjectId, ids)}
              highlightNoteId={highlightNoteId}
              settings={settings}
              viewMode={userHabits.editorViewMode}
              onViewModeChange={(mode) => setUserHabits(prev => ({ ...prev, editorViewMode: mode }))}
              initialScrollPosition={activeNoteId ? (userHabits.noteScrollPositions[activeNoteId] || 0) : 0}
              onUpdateScrollPosition={(id, pos) => setUserHabits(prev => ({
                ...prev,
                noteScrollPositions: { ...prev.noteScrollPositions, [id]: pos }
              }))}
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

        {confirmState && (
          <ConfirmDialog
            isOpen={confirmState.isOpen}
            title={confirmState.title}
            message={confirmState.message}
            onConfirm={confirmState.onConfirm}
            onCancel={() => setConfirmState(null)}
          />
        )}
      </Suspense>
    </div>
  );
};

export default MainApp;
