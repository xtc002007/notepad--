
import { Project, Note, Theme } from './types';

// Define the interface for any storage provider
export interface StorageService {
  getProjects(): Promise<Project[]>;
  saveProjects(projects: Project[]): Promise<void>;
  
  getNotes(): Promise<Note[]>;
  saveNotes(notes: Note[]): Promise<void>;
  
  getTheme(): Theme;
  saveTheme(theme: Theme): void;
  
  clearAllData(): Promise<void>;
}

// Key constants
const STORAGE_KEYS = {
  PROJECTS: 'zen_projects',
  NOTES: 'zen_notes',
  THEME: 'zen_theme',
};

// Implementation for LocalStorage
export class LocalStorageService implements StorageService {
  async getProjects(): Promise<Project[]> {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROJECTS);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to load projects', error);
      return [];
    }
  }

  async saveProjects(projects: Project[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    } catch (error) {
      console.error('Failed to save projects', error);
    }
  }

  async getNotes(): Promise<Note[]> {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.NOTES);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to load notes', error);
      return [];
    }
  }

  async saveNotes(notes: Note[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
    } catch (error) {
      console.error('Failed to save notes', error);
    }
  }

  // Theme is often needed synchronously to prevent flash of unstyled content
  getTheme(): Theme {
    return (localStorage.getItem(STORAGE_KEYS.THEME) as Theme) || 'system';
  }

  saveTheme(theme: Theme): void {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }

  async clearAllData(): Promise<void> {
    localStorage.removeItem(STORAGE_KEYS.PROJECTS);
    localStorage.removeItem(STORAGE_KEYS.NOTES);
    // We optionally keep the theme
  }
}

// Export a singleton instance
export const storage = new LocalStorageService();
