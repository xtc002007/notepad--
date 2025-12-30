
import { Project, Note, AppSettings, DEFAULT_SETTINGS } from './types';

// Define the interface for any storage provider
export interface StorageService {
  getProjects(): Promise<Project[]>;
  saveProjects(projects: Project[]): Promise<void>;
  
  getNotes(): Promise<Note[]>;
  saveNotes(notes: Note[]): Promise<void>;
  
  getSettings(): AppSettings;
  saveSettings(settings: AppSettings): void;
  
  clearAllData(): Promise<void>;
}

// Key constants
const STORAGE_KEYS = {
  PROJECTS: 'zen_projects',
  NOTES: 'zen_notes',
  SETTINGS: 'zen_settings', // Unified settings key
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

  getSettings(): AppSettings {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!saved) return DEFAULT_SETTINGS;
      
      // Merge saved settings with defaults to handle new keys in future updates
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  }

  saveSettings(settings: AppSettings): void {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  async clearAllData(): Promise<void> {
    localStorage.removeItem(STORAGE_KEYS.PROJECTS);
    localStorage.removeItem(STORAGE_KEYS.NOTES);
    // We purposefully keep settings
  }
}

// Export a singleton instance
export const storage = new LocalStorageService();
