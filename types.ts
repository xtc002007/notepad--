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