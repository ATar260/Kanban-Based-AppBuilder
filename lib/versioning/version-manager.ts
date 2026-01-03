// Version Manager
// Orchestrates version creation across local storage and GitHub

import {
    Project,
    ProjectVersion,
    CreateVersionOptions,
    RestoreVersionOptions,
    VersionDiff,
    StorageAdapter,
    VersionTrigger
} from './types';
import { localStorageAdapter } from './local-storage-adapter';
import {
    generateId,
    generateVersionName,
    calculateDiff,
    hasChanges,
    calculateTotalSize
} from './utils';

class VersionManager {
    private localStorage: StorageAdapter;
    private gitHubEnabled: boolean = false;

    constructor() {
        this.localStorage = localStorageAdapter;
    }

    // ============================================
    // PROJECT OPERATIONS
    // ============================================

    async createProject(options: {
        name: string;
        description: string;
        mode: 'clone' | 'prompt';
        sourceUrl?: string;
    }): Promise<Project> {
        const now = new Date().toISOString();

        const project: Project = {
            id: generateId(),
            name: options.name,
            description: options.description,
            mode: options.mode,
            sourceUrl: options.sourceUrl,
            createdAt: now,
            updatedAt: now,
            currentVersionId: null,
            totalVersions: 0,
            totalFiles: 0
        };

        await this.localStorage.saveProject(project);
        console.log(`[VersionManager] Created project: ${project.id}`);

        return project;
    }

    async getProject(projectId: string): Promise<Project | null> {
        return this.localStorage.getProject(projectId);
    }

    async listProjects(): Promise<Project[]> {
        return this.localStorage.listProjects();
    }

    async updateProject(projectId: string, updates: Partial<Project>): Promise<Project | null> {
        const project = await this.localStorage.getProject(projectId);
        if (!project) return null;

        const updated: Project = {
            ...project,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        await this.localStorage.saveProject(updated);
        return updated;
    }

    async deleteProject(projectId: string): Promise<void> {
        await this.localStorage.deleteProject(projectId);
        console.log(`[VersionManager] Deleted project: ${projectId}`);
    }

    // ============================================
    // VERSION OPERATIONS
    // ============================================

    async createVersion(options: CreateVersionOptions): Promise<ProjectVersion> {
        const project = await this.localStorage.getProject(options.projectId);
        if (!project) {
            throw new Error(`Project not found: ${options.projectId}`);
        }

        // Get next version number
        const versions = await this.localStorage.listVersions(options.projectId);
        const nextVersionNumber = versions.length > 0
            ? Math.max(...versions.map(v => v.versionNumber)) + 1
            : 1;

        // Check if there are actual changes from last version
        const latestVersion = await this.localStorage.getLatestVersion(options.projectId);
        if (latestVersion && !hasChanges(latestVersion.files, options.files)) {
            // No changes, skip creating version for auto-saves
            if (options.trigger === 'auto_save') {
                console.log('[VersionManager] No changes detected, skipping auto-save');
                return latestVersion;
            }
        }

        const now = new Date().toISOString();

        const version: ProjectVersion = {
            id: generateId(),
            projectId: options.projectId,
            versionNumber: nextVersionNumber,
            name: options.name || generateVersionName(options.trigger, options.ticketTitle, nextVersionNumber),
            description: options.description || this.generateDescription(options.trigger, options.ticketTitle),
            trigger: options.trigger,
            ticketId: options.ticketId,
            ticketTitle: options.ticketTitle,
            files: options.files,
            packages: options.packages,
            kanbanState: options.kanbanState,
            createdAt: now,
            fileCount: options.files.length,
            totalSize: calculateTotalSize(options.files),
            parentVersionId: latestVersion?.id
        };

        // Save to local storage (always, as backup)
        await this.localStorage.saveVersion(version);

        // Update project metadata
        await this.updateProject(options.projectId, {
            currentVersionId: version.id,
            totalVersions: nextVersionNumber,
            totalFiles: options.files.length
        });

        console.log(`[VersionManager] Created version ${nextVersionNumber} for project ${options.projectId}`);

        // Push to GitHub if enabled
        if (options.pushToGitHub && this.gitHubEnabled && project.github?.autoCommit) {
            try {
                await this.pushVersionToGitHub(version, project);
            } catch (error) {
                console.error('[VersionManager] GitHub push failed, version saved locally:', error);
                // Don't throw - local save succeeded
            }
        }

        return version;
    }

    async getVersion(versionId: string): Promise<ProjectVersion | null> {
        return this.localStorage.getVersion(versionId);
    }

    async listVersions(projectId: string): Promise<ProjectVersion[]> {
        return this.localStorage.listVersions(projectId);
    }

    async getLatestVersion(projectId: string): Promise<ProjectVersion | null> {
        return this.localStorage.getLatestVersion(projectId);
    }

    async restoreVersion(options: RestoreVersionOptions): Promise<ProjectVersion | null> {
        const version = await this.localStorage.getVersion(options.versionId);
        if (!version) {
            console.error(`[VersionManager] Version not found: ${options.versionId}`);
            return null;
        }

        // Optionally create a backup of current state before restoring
        if (options.createBackup) {
            const latestVersion = await this.localStorage.getLatestVersion(version.projectId);
            if (latestVersion && latestVersion.id !== version.id) {
                console.log('[VersionManager] Creating backup before restore');
                // Note: Caller should create backup with current sandbox files
            }
        }

        // Update project to point to restored version
        await this.updateProject(version.projectId, {
            currentVersionId: version.id
        });

        console.log(`[VersionManager] Restored to version ${version.versionNumber}`);

        return version;
    }

    async deleteVersion(versionId: string): Promise<void> {
        await this.localStorage.deleteVersion(versionId);
    }

    async compareVersions(versionId1: string, versionId2: string): Promise<VersionDiff | null> {
        const v1 = await this.localStorage.getVersion(versionId1);
        const v2 = await this.localStorage.getVersion(versionId2);

        if (!v1 || !v2) return null;

        return calculateDiff(v1.files, v2.files);
    }

    // ============================================
    // GITHUB OPERATIONS
    // ============================================

    enableGitHub(): void {
        this.gitHubEnabled = true;
        console.log('[VersionManager] GitHub integration enabled');
    }

    disableGitHub(): void {
        this.gitHubEnabled = false;
        console.log('[VersionManager] GitHub integration disabled');
    }

    isGitHubEnabled(): boolean {
        return this.gitHubEnabled;
    }

    private async pushVersionToGitHub(version: ProjectVersion, project: Project): Promise<void> {
        if (!project.github?.connected) {
            console.log('[VersionManager] GitHub not connected for project');
            return;
        }

        // This will call the GitHub API endpoint
        const response = await fetch('/api/github/commit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId: project.id,
                versionId: version.id,
                repoFullName: project.github.repoFullName,
                branch: project.github.branch,
                message: this.generateCommitMessage(version),
                files: version.files.map(f => ({
                    path: f.path,
                    content: f.content
                }))
            })
        });

        if (!response.ok) {
            throw new Error(`GitHub commit failed: ${response.statusText}`);
        }

        const result = await response.json();

        // Update version with commit info
        version.gitCommitSha = result.sha;
        version.gitCommitUrl = result.url;
        await this.localStorage.saveVersion(version);

        console.log(`[VersionManager] Pushed to GitHub: ${result.sha}`);
    }

    // ============================================
    // EXPORT/IMPORT
    // ============================================

    async exportProject(projectId: string): Promise<{
        project: Project;
        versions: ProjectVersion[];
        exportedAt: string;
    } | null> {
        const project = await this.localStorage.getProject(projectId);
        if (!project) return null;

        const versions = await this.localStorage.listVersions(projectId);

        return {
            project,
            versions,
            exportedAt: new Date().toISOString()
        };
    }

    async importProject(data: {
        project: Project;
        versions: ProjectVersion[];
    }): Promise<Project> {
        // Generate new IDs to avoid conflicts
        const newProjectId = generateId();
        const idMap = new Map<string, string>();
        idMap.set(data.project.id, newProjectId);

        // Create project with new ID
        const project: Project = {
            ...data.project,
            id: newProjectId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await this.localStorage.saveProject(project);

        // Import versions with new IDs
        for (const version of data.versions) {
            const newVersionId = generateId();
            idMap.set(version.id, newVersionId);

            const importedVersion: ProjectVersion = {
                ...version,
                id: newVersionId,
                projectId: newProjectId,
                parentVersionId: version.parentVersionId
                    ? idMap.get(version.parentVersionId)
                    : undefined
            };

            await this.localStorage.saveVersion(importedVersion);
        }

        // Update current version reference
        if (data.project.currentVersionId) {
            project.currentVersionId = idMap.get(data.project.currentVersionId) || null;
            await this.localStorage.saveProject(project);
        }

        console.log(`[VersionManager] Imported project: ${newProjectId}`);

        return project;
    }

    // ============================================
    // HELPERS
    // ============================================

    private generateDescription(trigger: VersionTrigger, ticketTitle?: string): string {
        switch (trigger) {
            case 'ticket_done':
                return `Completed ticket: ${ticketTitle || 'Unknown'}`;
            case 'ticket_skipped':
                return `Skipped ticket: ${ticketTitle || 'Unknown'}`;
            case 'ticket_failed':
                return `Failed ticket: ${ticketTitle || 'Unknown'}`;
            case 'manual_save':
                return 'Manual save by user';
            case 'auto_save':
                return 'Automatic periodic save';
            case 'build_start':
                return 'Build process started';
            case 'build_complete':
                return 'Build process completed';
            case 'initial':
                return 'Project initialized';
            default:
                return 'Version created';
        }
    }

    private generateCommitMessage(version: ProjectVersion): string {
        const emoji = {
            'ticket_done': '✅',
            'ticket_skipped': '⏭️',
            'ticket_failed': '❌',
            'manual_save': '💾',
            'auto_save': '🔄',
            'build_start': '🚀',
            'build_complete': '🎉',
            'initial': '📦'
        }[version.trigger] || '📝';

        let message = `${emoji} ${version.name}`;

        if (version.ticketId) {
            message += `\n\nTicket: ${version.ticketId}`;
        }

        message += `\n\nFiles: ${version.fileCount}`;
        message += `\nGenerated by Timbs A.I.`;

        return message;
    }

    // ============================================
    // STORAGE INFO
    // ============================================

    async getStorageInfo(): Promise<{
        used: number;
        limit: number;
        percentage: number;
        projectCount: number;
    }> {
        const projects = await this.listProjects();
        const storageInfo = await (this.localStorage as any).getStorageInfo?.() || {
            used: 0,
            limit: 10 * 1024 * 1024,
            percentage: 0
        };

        return {
            ...storageInfo,
            projectCount: projects.length
        };
    }
}

// Export singleton instance
export const versionManager = new VersionManager();
