// Local Storage Adapter
// Default storage backend - works offline, no setup required

import {
    StorageAdapter,
    Project,
    ProjectVersion
} from './types';

const STORAGE_PREFIX = 'timbs-ai:';
const PROJECTS_KEY = `${STORAGE_PREFIX}projects`;
const VERSIONS_PREFIX = `${STORAGE_PREFIX}versions:`;
const MAX_STORAGE_MB = 10; // localStorage limit is usually ~5-10MB

export class LocalStorageAdapter implements StorageAdapter {
    name = 'localStorage';

    // ============================================
    // PROJECT OPERATIONS
    // ============================================

    async saveProject(project: Project): Promise<void> {
        const projects = await this.listProjects();
        const existingIndex = projects.findIndex(p => p.id === project.id);

        if (existingIndex >= 0) {
            projects[existingIndex] = project;
        } else {
            projects.push(project);
        }

        this.setItem(PROJECTS_KEY, projects);
    }

    async getProject(projectId: string): Promise<Project | null> {
        const projects = await this.listProjects();
        return projects.find(p => p.id === projectId) || null;
    }

    async listProjects(): Promise<Project[]> {
        return this.getItem<Project[]>(PROJECTS_KEY) || [];
    }

    async deleteProject(projectId: string): Promise<void> {
        // Delete all versions first
        const versions = await this.listVersions(projectId);
        for (const version of versions) {
            await this.deleteVersion(version.id);
        }

        // Delete project
        const projects = await this.listProjects();
        const filtered = projects.filter(p => p.id !== projectId);
        this.setItem(PROJECTS_KEY, filtered);
    }

    // ============================================
    // VERSION OPERATIONS
    // ============================================

    async saveVersion(version: ProjectVersion): Promise<void> {
        const key = this.getVersionKey(version.projectId);
        const versions = await this.listVersions(version.projectId);
        const existingIndex = versions.findIndex(v => v.id === version.id);

        if (existingIndex >= 0) {
            versions[existingIndex] = version;
        } else {
            versions.push(version);
        }

        // Sort by version number descending (newest first)
        versions.sort((a, b) => b.versionNumber - a.versionNumber);

        // Check storage limit - keep only last 50 versions per project
        const trimmedVersions = versions.slice(0, 50);

        try {
            this.setItem(key, trimmedVersions);
        } catch (error: any) {
            if (error.name === 'QuotaExceededError') {
                // Storage full - remove oldest versions and try again
                console.warn('[LocalStorage] Storage quota exceeded, trimming old versions');
                const reducedVersions = trimmedVersions.slice(0, 20);
                this.setItem(key, reducedVersions);
            } else {
                throw error;
            }
        }
    }

    async getVersion(versionId: string): Promise<ProjectVersion | null> {
        // Need to search all projects since we don't know which project
        const projects = await this.listProjects();

        for (const project of projects) {
            const versions = await this.listVersions(project.id);
            const version = versions.find(v => v.id === versionId);
            if (version) return version;
        }

        return null;
    }

    async listVersions(projectId: string): Promise<ProjectVersion[]> {
        const key = this.getVersionKey(projectId);
        return this.getItem<ProjectVersion[]>(key) || [];
    }

    async getLatestVersion(projectId: string): Promise<ProjectVersion | null> {
        const versions = await this.listVersions(projectId);
        return versions[0] || null; // Already sorted by version number desc
    }

    async deleteVersion(versionId: string): Promise<void> {
        const version = await this.getVersion(versionId);
        if (!version) return;

        const key = this.getVersionKey(version.projectId);
        const versions = await this.listVersions(version.projectId);
        const filtered = versions.filter(v => v.id !== versionId);
        this.setItem(key, filtered);
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    isAvailable(): boolean {
        try {
            const testKey = `${STORAGE_PREFIX}test`;
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch {
            return false;
        }
    }

    async getStorageUsed(): Promise<number> {
        let total = 0;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(STORAGE_PREFIX)) {
                const value = localStorage.getItem(key);
                if (value) {
                    total += key.length + value.length;
                }
            }
        }

        // Approximate bytes (UTF-16 = 2 bytes per char)
        return total * 2;
    }

    async getStorageInfo(): Promise<{ used: number; limit: number; percentage: number }> {
        const used = await this.getStorageUsed();
        const limit = MAX_STORAGE_MB * 1024 * 1024;
        return {
            used,
            limit,
            percentage: (used / limit) * 100
        };
    }

    async clear(): Promise<void> {
        const keysToRemove: string[] = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(STORAGE_PREFIX)) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));
    }

    // ============================================
    // PRIVATE HELPERS
    // ============================================

    private getVersionKey(projectId: string): string {
        return `${VERSIONS_PREFIX}${projectId}`;
    }

    private getItem<T>(key: string): T | null {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch {
            return null;
        }
    }

    private setItem<T>(key: string, value: T): void {
        localStorage.setItem(key, JSON.stringify(value));
    }
}

// Singleton instance
export const localStorageAdapter = new LocalStorageAdapter();
