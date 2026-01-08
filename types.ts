
export interface UserHabits {
  lastActiveProjectId: string | null;
  lastActiveNoteId: string | null;
  editorViewMode: 'raw' | 'markdown';
  collapsedQuickNoteIds: string[];
  expandedProjectIds: string[];
  previewQuickNoteIds: string[];
  isSidebarCollapsed: boolean;
}

export interface Project {
  id: string;
  name: string;
  updatedAt: number; // Timestamp for sorting
}

export enum NoteType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
}

export interface Note {
  id: string;
  projectId: string; // 'uncategorized' if no project selected
  type: NoteType;
  content: string; // For text notes, this is the body. For files, this might be a URL or placeholder
  title?: string; // For files/images (filename)
  createdAt: number;
  updatedAt?: number; // Last modified/interacted timestamp
  isPinned?: boolean; // Whether the note is pinned to the top
}

export interface SearchResultItem {
  type: 'project' | 'file' | 'content';
  id: string;
  title: string;
  snippet?: string;
  score: number; // For weighting logic
  originalObject: Project | Note;
}

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
}

export type Theme = 'light' | 'dark' | 'system';
export type AppFont = 'sans' | 'serif' | 'mono';

export interface AppSettings {
  // Appearance
  theme: Theme;

  // Editor - Typography
  fontFamily: AppFont;
  fontSize: number; // px
  lineHeight: number; // unitless (e.g. 1.5)

  // Editor - Behavior
  showLineNumbers: boolean;
  wordWrap: boolean;
  highlightActiveLine: boolean;

  // General
  reduceMotion: boolean;

  // Backup
  backupPath?: string;
  autoBackup: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  fontFamily: 'sans',
  fontSize: 15,
  lineHeight: 1.6,
  showLineNumbers: true,
  wordWrap: true,
  highlightActiveLine: true,
  reduceMotion: false,
  autoBackup: false,
};

export const DEFAULT_USER_HABITS: UserHabits = {
  lastActiveProjectId: 'quick_notes',
  lastActiveNoteId: null,
  editorViewMode: 'raw',
  collapsedQuickNoteIds: [],
  expandedProjectIds: [],
  previewQuickNoteIds: [],
  isSidebarCollapsed: false,
};
