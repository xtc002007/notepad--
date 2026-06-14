
import { Project, Note, AppSettings, DEFAULT_SETTINGS, NoteType, UserHabits, DEFAULT_USER_HABITS } from './types';
import Database from '@tauri-apps/plugin-sql';
import { mkdir, writeFile, readFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';

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
    loadAssetBlobUrl(localPath: string): Promise<string>;
    getAppDataRoot(): Promise<string>;
    triggerBackup(): Promise<void>;
}

const DB_FILENAME = 'notepad.db';

interface ProjectRow extends Omit<Project, 'noteOrder'> {
    noteOrder: string | null;
}

interface NoteRow extends Omit<Note, 'isPinned'> {
    isPinned: number | null;
}

export class SqliteStorageService implements StorageService {
    private db: Database | null = null;
    private assetsDir = 'attachments';
    private settings: AppSettings = DEFAULT_SETTINGS;

    private initPromise: Promise<void> | null = null;

    private withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const timeoutId = setTimeout(() => reject(new Error(errorMsg)), ms);
            promise
                .then(resolve)
                .catch(reject)
                .finally(() => clearTimeout(timeoutId));
        });
    }

    private async getDb(): Promise<Database> {
        if (!this.db) await this.init();
        if (!this.db) throw new Error('Database is not initialized');
        return this.db;
    }

    private isDuplicateColumnError(error: unknown): boolean {
        return String(error).toLowerCase().includes('duplicate column');
    }

    private async addColumnIfMissing(sql: string): Promise<void> {
        const db = await this.getDb();
        try {
            await db.execute(sql);
        } catch (error) {
            if (!this.isDuplicateColumnError(error)) {
                throw error;
            }
        }
    }

    async init() {
        if (this.db) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                this.db = await this.withTimeout(
                    Database.load(`sqlite:${DB_FILENAME}`),
                    5000,
                    'Database connection timeout after 5s'
                );
            } catch (error) {
                console.error('[Storage] Failed to load database:', error);
                this.db = null;
                this.initPromise = null;
                throw error;
            }

            const db = await this.getDb();

            await db.execute(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        updatedAt INTEGER NOT NULL,
        noteOrder TEXT
      );
    `);

            await db.execute(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        title TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER,
        isPinned INTEGER,
        aiSummary TEXT,
        aiKeyInfo TEXT
      );
    `);

            await this.addColumnIfMissing('ALTER TABLE notes ADD COLUMN updatedAt INTEGER');
            await this.addColumnIfMissing('ALTER TABLE notes ADD COLUMN isPinned INTEGER');
            await this.addColumnIfMissing('ALTER TABLE notes ADD COLUMN aiSummary TEXT');
            await this.addColumnIfMissing('ALTER TABLE notes ADD COLUMN aiKeyInfo TEXT');
            await this.addColumnIfMissing('ALTER TABLE projects ADD COLUMN noteOrder TEXT');

            await db.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        json TEXT NOT NULL
      );
    `);

            await db.execute(`
      CREATE TABLE IF NOT EXISTS user_habits (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        json TEXT NOT NULL
      );
    `);

            try {
                await mkdir(this.assetsDir, { baseDir: BaseDirectory.AppData, recursive: true });
            } catch (error) {
                console.warn('[Storage] Failed to create assets directory:', error);
            }

            // Load settings into memory
            this.settings = await this.getSettings();
        })();

        return this.initPromise;
    }

    async getProjects(): Promise<Project[]> {
        const db = await this.getDb();
        const raw = await db.select<ProjectRow[]>('SELECT * FROM projects ORDER BY updatedAt DESC');
        return raw.map(p => ({
            id: p.id,
            name: p.name,
            updatedAt: p.updatedAt,
            noteOrder: p.noteOrder ? JSON.parse(p.noteOrder) : undefined
        }));
    }

    async saveProject(p: Project): Promise<void> {
        const db = await this.getDb();
        await db.execute(
            'INSERT OR REPLACE INTO projects (id, name, updatedAt, noteOrder) VALUES ($1, $2, $3, $4)',
            [p.id, p.name, p.updatedAt, p.noteOrder ? JSON.stringify(p.noteOrder) : null]
        );
    }

    async deleteProject(id: string): Promise<void> {
        const db = await this.getDb();
        await db.execute('DELETE FROM projects WHERE id = $1', [id]);
        await db.execute('DELETE FROM notes WHERE projectId = $1', [id]);
    }

    async getNotes(): Promise<Note[]> {
        const db = await this.getDb();
        const notes = await db.select<NoteRow[]>('SELECT * FROM notes ORDER BY COALESCE(updatedAt, createdAt) DESC');
        return notes.map(n => ({
            ...n,
            isPinned: !!n.isPinned
        }));
    }

    async saveNote(n: Note): Promise<void> {
        const db = await this.getDb();
        await db.execute(
            'INSERT OR REPLACE INTO notes (id, projectId, type, content, title, createdAt, updatedAt, isPinned, aiSummary, aiKeyInfo) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
            [n.id, n.projectId, n.type, n.content, n.title, n.createdAt, n.updatedAt ?? null, n.isPinned ? 1 : 0, n.aiSummary || null, n.aiKeyInfo || null]
        );
    }

    async deleteNote(id: string): Promise<void> {
        const db = await this.getDb();
        await db.execute('DELETE FROM notes WHERE id = $1', [id]);
    }

    async getSettings(): Promise<AppSettings> {
        const db = await this.getDb();
        const result = await db.select<{ json: string }[]>('SELECT json FROM settings WHERE id = 1');
        if (result.length > 0) {
            try {
                const parsed = JSON.parse(result[0].json) as Partial<AppSettings>;
                return { ...DEFAULT_SETTINGS, ...parsed };
            } catch (error) {
                console.warn('[Storage] Failed to parse settings, using defaults:', error);
                return DEFAULT_SETTINGS;
            }
        }
        return DEFAULT_SETTINGS;
    }

    async saveSettings(settings: AppSettings): Promise<void> {
        const db = await this.getDb();
        this.settings = settings;
        await db.execute(
            'INSERT OR REPLACE INTO settings (id, json) VALUES (1, $1)',
            [JSON.stringify(settings)]
        );
    }

    async getUserHabits(): Promise<UserHabits> {
        const db = await this.getDb();
        const result = await db.select<{ json: string }[]>('SELECT json FROM user_habits WHERE id = 1');
        if (result.length > 0) {
            try {
                const parsed = JSON.parse(result[0].json) as Partial<UserHabits>;
                return { ...DEFAULT_USER_HABITS, ...parsed };
            } catch (error) {
                console.warn('[Storage] Failed to parse user habits, using defaults:', error);
                return DEFAULT_USER_HABITS;
            }
        }
        return DEFAULT_USER_HABITS;
    }

    async saveUserHabits(habits: UserHabits): Promise<void> {
        const db = await this.getDb();
        await db.execute(
            'INSERT OR REPLACE INTO user_habits (id, json) VALUES (1, $1)',
            [JSON.stringify(habits)]
        );
    }

    async clearAllData(): Promise<void> {
        const db = await this.getDb();
        await db.execute('DELETE FROM projects');
        await db.execute('DELETE FROM notes');
    }

    async saveAsset(file: File): Promise<string> {
        await this.getDb();
        const safeName = file.name.replace(/[<>:"/\\|?*\x00-\x1F]+/g, '_').replace(/\s+/g, '_');
        const fileName = `${Date.now()}_${safeName}`;
        const filePath = await join(this.assetsDir, fileName);
        const arrayBuffer = await file.arrayBuffer();
        await writeFile(filePath, new Uint8Array(arrayBuffer), { baseDir: BaseDirectory.AppData });
        // Important: Normalize to forward slashes for Markdown compatibility
        return filePath.replace(/\\/g, '/');
    }

    async loadAssetBlobUrl(localPath: string): Promise<string> {
        try {
            // "localPath" comes from Markdown as "attachments/foo.png".
            // readFile with baseDir handles local relative paths correctly.
            const data = await readFile(localPath, { baseDir: BaseDirectory.AppData });

            // Simple mime inference
            let mime = 'application/octet-stream';
            if (localPath.endsWith('.png')) mime = 'image/png';
            else if (localPath.endsWith('.jpg') || localPath.endsWith('.jpeg')) mime = 'image/jpeg';
            else if (localPath.endsWith('.gif')) mime = 'image/gif';
            else if (localPath.endsWith('.webp')) mime = 'image/webp';
            else if (localPath.endsWith('.svg')) mime = 'image/svg+xml';

            const blob = new Blob([data], { type: mime });
            return URL.createObjectURL(blob);
        } catch (e) {
            console.error('[Storage] Failed to load asset blob:', localPath, e);
            return '';
        }
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
