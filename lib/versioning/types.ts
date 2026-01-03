// Versioning System Types
// Supports local storage (default) and GitHub (optional)

// ============================================
// PROJECT TYPES
// ============================================

export interface Project {
    id: string;
    name: string;
    description: string;
    mode: 'clone' | 'prompt';
    sourceUrl?: string;              // If cloned from URL
    createdAt: string;               // ISO date string
    updatedAt: string;
    currentVersionId: string | null;

    // GitHub integration (optional)
    github?: ProjectGitHubConfig;

    // Stats
    totalVersions: number;
    totalFiles: number;
}

export interface ProjectGitHubConfig {
    connected: boolean;
    repoFullName: string;            // "username/repo-name"
    branch: string;
    autoCommit: boolean;             // Commit on ticket completion
    autoPush: boolean;               // Push after commit
    lastCommitSha?: string;
    lastPushAt?: string;
}

// ============================================
// VERSION TYPES
// ============================================

export interface ProjectVersion {
    id: string;
    projectId: string;
    versionNumber: number;
    name: string;
    description: string;

    // What triggered this version
    trigger: VersionTrigger;
    ticketId?: string;
    ticketTitle?: string;

    // Snapshot data
    files: VersionFile[];
    packages: PackageInfo;
    kanbanState?: KanbanTicketSnapshot[];

    // Metadata
    createdAt: string;
    fileCount: number;
    totalSize: number;               // bytes

    // Git info (if pushed to GitHub)
    gitCommitSha?: string;
    gitCommitUrl?: string;

    // Navigation (for future branching)
    parentVersionId?: string;
}

export type VersionTrigger =
    | 'ticket_done'
    | 'ticket_skipped'
    | 'ticket_failed'
    | 'manual_save'
    | 'auto_save'
    | 'build_start'
    | 'build_complete'
    | 'initial';

export interface VersionFile {
    path: string;
    content: string;
    hash: string;                    // MD5 or SHA1 for change detection
    size: number;
    lastModified: string;
}

export interface PackageInfo {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
}

export interface KanbanTicketSnapshot {
    id: string;
    title: string;
    status: string;
    type: string;
    priority: string;
    completedAt?: string;
}

// ============================================
// STORAGE ADAPTER INTERFACE
// ============================================

export interface StorageAdapter {
    name: string;

    // Project operations
    saveProject(project: Project): Promise<void>;
    getProject(projectId: string): Promise<Project | null>;
    listProjects(): Promise<Project[]>;
    deleteProject(projectId: string): Promise<void>;

    // Version operations
    saveVersion(version: ProjectVersion): Promise<void>;
    getVersion(versionId: string): Promise<ProjectVersion | null>;
    listVersions(projectId: string): Promise<ProjectVersion[]>;
    getLatestVersion(projectId: string): Promise<ProjectVersion | null>;
    deleteVersion(versionId: string): Promise<void>;

    // Utility
    isAvailable(): boolean;
    getStorageUsed(): Promise<number>;   // bytes
    clear(): Promise<void>;
}

// ============================================
// GITHUB TYPES
// ============================================

export interface GitHubConnection {
    connected: boolean;
    accessToken?: string;            // Encrypted
    username?: string;
    avatarUrl?: string;
    connectedAt?: string;
}

export interface GitHubRepo {
    id: number;
    name: string;
    fullName: string;
    private: boolean;
    defaultBranch: string;
    htmlUrl: string;
    cloneUrl: string;
    updatedAt: string;
}

export interface GitHubCommitRequest {
    repoFullName: string;
    branch: string;
    message: string;
    files: Array<{
        path: string;
        content: string;
        mode?: 'create' | 'update' | 'delete';
    }>;
    parentSha?: string;
}

export interface GitHubCommitResult {
    success: boolean;
    sha?: string;
    url?: string;
    error?: string;
}

// ============================================
// VERSION MANAGER TYPES
// ============================================

export interface CreateVersionOptions {
    projectId: string;
    trigger: VersionTrigger;
    name?: string;
    description?: string;
    ticketId?: string;
    ticketTitle?: string;
    files: VersionFile[];
    packages: PackageInfo;
    kanbanState?: KanbanTicketSnapshot[];
    pushToGitHub?: boolean;
}

export interface RestoreVersionOptions {
    versionId: string;
    createBackup?: boolean;          // Create version before restoring
}

export interface VersionDiff {
    added: string[];                 // New file paths
    modified: string[];              // Changed file paths
    deleted: string[];               // Removed file paths
    unchanged: string[];             // Same file paths
}

// ============================================
// UI STATE TYPES
// ============================================

export interface VersioningState {
    currentProject: Project | null;
    versions: ProjectVersion[];
    isLoading: boolean;
    isSaving: boolean;
    lastSaved: string | null;
    autoSaveEnabled: boolean;
    gitHubConnected: boolean;
    error: string | null;
}

export interface SaveStatus {
    local: 'idle' | 'saving' | 'saved' | 'error';
    github: 'idle' | 'pushing' | 'pushed' | 'error' | 'disabled';
    lastSavedAt: string | null;
    lastPushedAt: string | null;
}
