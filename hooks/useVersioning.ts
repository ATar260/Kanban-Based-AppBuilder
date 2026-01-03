// React Hook for Versioning
// Manages project and version state with auto-save

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Project,
    ProjectVersion,
    VersionFile,
    PackageInfo,
    KanbanTicketSnapshot,
    VersionTrigger,
    SaveStatus
} from '@/lib/versioning/types';
import { versionManager } from '@/lib/versioning/version-manager';
import { toVersionFiles } from '@/lib/versioning/utils';
import {
    isGitHubConnected,
    saveGitHubConnection,
    getGitHubConnection,
    clearGitHubConnection
} from '@/lib/versioning/github';

interface UseVersioningOptions {
    autoSaveInterval?: number;  // ms, default 5 minutes
    enableAutoSave?: boolean;
}

interface UseVersioningReturn {
    // Project state
    currentProject: Project | null;
    versions: ProjectVersion[];
    isLoading: boolean;
    error: string | null;

    // Save status
    saveStatus: SaveStatus;

    // GitHub status
    gitHubConnected: boolean;
    gitHubUsername: string | null;

    // Project actions
    createProject: (name: string, description: string, mode: 'clone' | 'prompt', sourceUrl?: string) => Promise<Project>;
    loadProject: (projectId: string) => Promise<void>;
    deleteProject: (projectId: string) => Promise<void>;
    listProjects: () => Promise<Project[]>;

    // Version actions
    saveVersion: (options: {
        trigger: VersionTrigger;
        ticketId?: string;
        ticketTitle?: string;
        getFiles: () => Promise<Array<{ path: string; content: string }>>;
        getPackages: () => PackageInfo;
        getKanbanState?: () => KanbanTicketSnapshot[];
        pushToGitHub?: boolean;
    }) => Promise<ProjectVersion | null>;

    restoreVersion: (versionId: string) => Promise<VersionFile[] | null>;

    // GitHub actions
    connectGitHub: (token: string, username: string, avatarUrl?: string) => void;
    disconnectGitHub: () => void;

    // Manual save trigger
    triggerManualSave: () => void;
}

export function useVersioning(options: UseVersioningOptions = {}): UseVersioningReturn {
    const {
        autoSaveInterval = 5 * 60 * 1000, // 5 minutes
        enableAutoSave = true
    } = options;

    // State
    const [currentProject, setCurrentProject] = useState<Project | null>(null);
    const [versions, setVersions] = useState<ProjectVersion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>({
        local: 'idle',
        github: 'disabled',
        lastSavedAt: null,
        lastPushedAt: null
    });

    // GitHub state
    const [gitHubConnected, setGitHubConnected] = useState(false);
    const [gitHubUsername, setGitHubUsername] = useState<string | null>(null);

    // Refs for auto-save
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const pendingSaveRef = useRef<(() => Promise<void>) | null>(null);

    // Initialize GitHub state
    useEffect(() => {
        const connection = getGitHubConnection();
        if (connection?.connected) {
            setGitHubConnected(true);
            setGitHubUsername(connection.username || null);
            versionManager.enableGitHub();
            setSaveStatus(prev => ({ ...prev, github: 'idle' }));
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const params = new URLSearchParams(window.location.search);
        const connected = params.get('github_connected');
        const username = params.get('github_username');
        const avatar = params.get('github_avatar');

        if (connected === 'true' && username) {
            saveGitHubConnection({
                connected: true,
                accessToken: 'cookie',
                username,
                avatarUrl: avatar || undefined,
                connectedAt: new Date().toISOString()
            });

            setGitHubConnected(true);
            setGitHubUsername(username);
            versionManager.enableGitHub();
            setSaveStatus(prev => ({ ...prev, github: 'idle' }));

            window.history.replaceState({}, '', window.location.pathname);
        }

        const githubError = params.get('github_error');
        if (githubError) {
            setError(`GitHub connection failed: ${githubError}`);
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    // Create project
    const createProject = useCallback(async (
        name: string,
        description: string,
        mode: 'clone' | 'prompt',
        sourceUrl?: string
    ): Promise<Project> => {
        setIsLoading(true);
        setError(null);

        try {
            const project = await versionManager.createProject({
                name,
                description,
                mode,
                sourceUrl
            });

            setCurrentProject(project);
            setVersions([]);

            return project;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Load project
    const loadProject = useCallback(async (projectId: string): Promise<void> => {
        setIsLoading(true);
        setError(null);

        try {
            const project = await versionManager.getProject(projectId);
            if (!project) {
                throw new Error('Project not found');
            }

            const projectVersions = await versionManager.listVersions(projectId);

            setCurrentProject(project);
            setVersions(projectVersions);
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // List projects
    const listProjects = useCallback(async (): Promise<Project[]> => {
        return versionManager.listProjects();
    }, []);

    // Delete project
    const deleteProject = useCallback(async (projectId: string): Promise<void> => {
        await versionManager.deleteProject(projectId);

        if (currentProject?.id === projectId) {
            setCurrentProject(null);
            setVersions([]);
        }
    }, [currentProject]);

    // Save version
    const saveVersion = useCallback(async (options: {
        trigger: VersionTrigger;
        ticketId?: string;
        ticketTitle?: string;
        getFiles: () => Promise<Array<{ path: string; content: string }>>;
        getPackages: () => PackageInfo;
        getKanbanState?: () => KanbanTicketSnapshot[];
        pushToGitHub?: boolean;
    }): Promise<ProjectVersion | null> => {
        if (!currentProject) {
            console.warn('[useVersioning] No current project, cannot save version');
            return null;
        }

        setSaveStatus(prev => ({
            ...prev,
            local: 'saving',
            github: options.pushToGitHub && gitHubConnected ? 'pushing' : prev.github
        }));

        try {
            const rawFiles = await options.getFiles();
            const files = toVersionFiles(rawFiles);

            const version = await versionManager.createVersion({
                projectId: currentProject.id,
                trigger: options.trigger,
                ticketId: options.ticketId,
                ticketTitle: options.ticketTitle,
                files,
                packages: options.getPackages(),
                kanbanState: options.getKanbanState?.(),
                pushToGitHub: options.pushToGitHub && gitHubConnected
            });

            // Update versions list
            setVersions(await versionManager.listVersions(currentProject.id));

            // Update project reference
            setCurrentProject(await versionManager.getProject(currentProject.id));

            const now = new Date().toISOString();
            setSaveStatus(prev => ({
                ...prev,
                local: 'saved',
                lastSavedAt: now,
                github: version.gitCommitSha ? 'pushed' : prev.github,
                lastPushedAt: version.gitCommitSha ? now : prev.lastPushedAt
            }));

            return version;
        } catch (err: any) {
            setError(err.message);
            setSaveStatus(prev => ({
                ...prev,
                local: 'error',
                github: options.pushToGitHub ? 'error' : prev.github
            }));
            return null;
        }
    }, [currentProject, gitHubConnected]);

    // Restore version
    const restoreVersion = useCallback(async (versionId: string): Promise<VersionFile[] | null> => {
        const version = await versionManager.restoreVersion({
            versionId,
            createBackup: true
        });

        if (version) {
            setVersions(await versionManager.listVersions(version.projectId));
            return version.files;
        }

        return null;
    }, []);

    // GitHub connection management
    const connectGitHub = useCallback((token: string, username: string, avatarUrl?: string) => {
        saveGitHubConnection({
            connected: true,
            accessToken: token,
            username,
            avatarUrl,
            connectedAt: new Date().toISOString()
        });

        setGitHubConnected(true);
        setGitHubUsername(username);
        versionManager.enableGitHub();
        setSaveStatus(prev => ({ ...prev, github: 'idle' }));
    }, []);

    const disconnectGitHub = useCallback(() => {
        clearGitHubConnection();
        setGitHubConnected(false);
        setGitHubUsername(null);
        versionManager.disableGitHub();
        setSaveStatus(prev => ({ ...prev, github: 'disabled' }));
    }, []);

    // Manual save trigger (to be called by parent component)
    const triggerManualSave = useCallback(() => {
        if (pendingSaveRef.current) {
            pendingSaveRef.current();
        }
    }, []);

    // Setup auto-save timer
    useEffect(() => {
        if (!enableAutoSave || !currentProject) return;

        autoSaveTimerRef.current = setInterval(() => {
            if (pendingSaveRef.current) {
                pendingSaveRef.current();
            }
        }, autoSaveInterval);

        return () => {
            if (autoSaveTimerRef.current) {
                clearInterval(autoSaveTimerRef.current);
            }
        };
    }, [enableAutoSave, autoSaveInterval, currentProject]);

    return {
        currentProject,
        versions,
        isLoading,
        error,
        saveStatus,
        gitHubConnected,
        gitHubUsername,
        createProject,
        loadProject,
        deleteProject,
        listProjects,
        saveVersion,
        restoreVersion,
        connectGitHub,
        disconnectGitHub,
        triggerManualSave
    };
}
