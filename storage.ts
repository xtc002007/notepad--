
import { Project, Note, AppSettings, DEFAULT_SETTINGS, NoteType, UserHabits, DEFAULT_USER_HABITS } from './types';
import Database from '@tauri-apps/plugin-sql';
import { mkdir, writeFile, readFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';

export interface StorageService {
    init(): Promise<void>;
    getProjects(): Promise<Project[]>;
    saveProject(project: Project): Promise<void>;
    deleteProject(id: string): Promise<void>;

    getNotes(): Promise<Note[]>;
    saveNote(note: Note): Promise<void>;
    deleteNote(id: string): Promise<void>;

    getSettings(): Promise<AppSettings>;
    saveSettings(settings: AppSettings): Promise<void>;
    getUserHabits(): Promise<UserHabits>;
    saveUserHabits(habits: UserHabits): Promise<void>;

    clearAllData(): Promise<void>;
    saveAsset(file: File): Promise<string>;
    getAssetUrl(localPath: string): Promise<string>;
    getAppDataRoot(): Promise<string>;
    triggerBackup(): Promise<void>;
}

const DB_FILENAME = 'notepad.db';

export class SqliteStorageService implements StorageService {
    private db: Database | null = null;
    private assetsDir = 'attachments';
    private settings: AppSettings = DEFAULT_SETTINGS;

    private initPromise: Promise<void> | null = null;

    private withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
        return Promise.race([
            promise,
            new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
        ]);
    }

    async init() {
        if (this.db) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                console.log('[Storage] Initializing SQLite connection...');
                this.db = await this.withTimeout(
                    Database.load(`sqlite:${DB_FILENAME}`),
                    5000,
                    'Database connection timeout after 5s'
                );
                console.log('[Storage] Database loaded successfully:', DB_FILENAME);
            } catch (error) {
                console.error('[Storage] Failed to load database:', error);
                throw error;
            }

            await this.db.execute(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      );
    `);

            await this.db.execute(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        title TEXT,
        createdAt INTEGER NOT NULL
      );
    `);

            await this.db.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        json TEXT NOT NULL
      );
    `);

            await this.db.execute(`
      CREATE TABLE IF NOT EXISTS user_habits (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        json TEXT NOT NULL
      );
    `);

            try {
                await mkdir(this.assetsDir, { baseDir: BaseDirectory.AppData, recursive: true });
            } catch (e) { }

            // Load settings into memory
            this.settings = await this.getSettings();
        })();

        return this.initPromise;
    }

    async getProjects(): Promise<Project[]> {
        if (!this.db) await this.init();
        const projects = await this.db!.select<Project[]>('SELECT * FROM projects ORDER BY updatedAt DESC');
        return projects;
    }

    async saveProject(p: Project): Promise<void> {
        if (!this.db) await this.init();
        await this.db!.execute(
            'INSERT OR REPLACE INTO projects (id, name, updatedAt) VALUES ($1, $2, $3)',
            [p.id, p.name, p.updatedAt]
        );
    }

    async deleteProject(id: string): Promise<void> {
        if (!this.db) await this.init();
        await this.db!.execute('DELETE FROM projects WHERE id = $1', [id]);
        await this.db!.execute('DELETE FROM notes WHERE projectId = $1', [id]);
    }

    async getNotes(): Promise<Note[]> {
        if (!this.db) await this.init();
        const notes = await this.db!.select<Note[]>('SELECT * FROM notes ORDER BY createdAt DESC');
        return notes;
    }

    async saveNote(n: Note): Promise<void> {
        if (!this.db) await this.init();
        await this.db!.execute(
            'INSERT OR REPLACE INTO notes (id, projectId, type, content, title, createdAt) VALUES ($1, $2, $3, $4, $5, $6)',
            [n.id, n.projectId, n.type, n.content, n.title, n.createdAt]
        );
    }

    async deleteNote(id: string): Promise<void> {
        if (!this.db) await this.init();
        await this.db!.execute('DELETE FROM notes WHERE id = $1', [id]);
    }

    async getSettings(): Promise<AppSettings> {
        if (!this.db) await this.init();
        const result = await this.db!.select<{ json: string }[]>('SELECT json FROM settings WHERE id = 1');
        if (result.length > 0) {
            try {
                const parsed = JSON.parse(result[0].json);
                return { ...DEFAULT_SETTINGS, ...parsed };
            } catch (e) {
                return DEFAULT_SETTINGS;
            }
        }
        return DEFAULT_SETTINGS;
    }

    async saveSettings(settings: AppSettings): Promise<void> {
        if (!this.db) await this.init();
        this.settings = settings;
        await this.db!.execute(
            'INSERT OR REPLACE INTO settings (id, json) VALUES (1, $1)',
            [JSON.stringify(settings)]
        );
    }

    async getUserHabits(): Promise<UserHabits> {
        if (!this.db) await this.init();
        const result = await this.db!.select<{ json: string }[]>('SELECT json FROM user_habits WHERE id = 1');
        if (result.length > 0) {
            try {
                const parsed = JSON.parse(result[0].json);
                return { ...DEFAULT_USER_HABITS, ...parsed };
            } catch (e) {
                return DEFAULT_USER_HABITS;
            }
        }
        return DEFAULT_USER_HABITS;
    }

    async saveUserHabits(habits: UserHabits): Promise<void> {
        if (!this.db) await this.init();
        await this.db!.execute(
            'INSERT OR REPLACE INTO user_habits (id, json) VALUES (1, $1)',
            [JSON.stringify(habits)]
        );
    }

    async clearAllData(): Promise<void> {
        if (!this.db) await this.init();
        await this.db!.execute('DELETE FROM projects');
        await this.db!.execute('DELETE FROM notes');
    }

    async saveAsset(file: File): Promise<string> {
        const fileName = `${Date.now()}_${file.name}`;
        const filePath = await join(this.assetsDir, fileName);
        const arrayBuffer = await file.arrayBuffer();
        await writeFile(filePath, new Uint8Array(arrayBuffer), { baseDir: BaseDirectory.AppData });
        return filePath;
    }

    async getAssetUrl(localPath: string): Promise<string> {
        const fullPath = await join(await appDataDir(), localPath);
        return convertFileSrc(fullPath);
    }

    async getAppDataRoot(): Promise<string> {
        return await appDataDir();
    }

    async triggerBackup(): Promise<void> {
        // We still need settings to know where to backup
        // If settings haven't been loaded, load them
        if (!this.settings.backupPath) {
            this.settings = await this.getSettings();
        }

        if (!this.settings.autoBackup || !this.settings.backupPath) {
            console.log('[Backup] Auto-backup skipped: not configured');
            return;
        }

        try {
            const dataDir = await appDataDir();
            const backupDir = this.settings.backupPath;

            await mkdir(backupDir, { recursive: true });

            // 1. Backup Database
            const dbPath = await join(dataDir, DB_FILENAME);
            const backupDbPath = await join(backupDir, DB_FILENAME);
            const dbContent = await readFile(dbPath);
            await writeFile(backupDbPath, dbContent);

            console.log('[Backup] Backup successful to:', backupDir);
        } catch (error) {
            console.error('[Backup] Backup failed:', error);
        }
    }
}

export const storage = new SqliteStorageService();
