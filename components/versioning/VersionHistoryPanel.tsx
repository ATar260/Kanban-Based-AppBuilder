'use client';

import { ProjectVersion, VersionDiff } from '@/lib/versioning/types';
import { formatRelativeTime, formatBytes } from '@/lib/versioning/utils';
import { getCommitUrl } from '@/lib/versioning/github';

interface VersionHistoryPanelProps {
    versions: ProjectVersion[];
    currentVersionId?: string | null;
    repoFullName?: string;
    onRestore: (versionId: string) => void;
    onCompare?: (versionId1: string, versionId2: string) => void;
    className?: string;
}

export function VersionHistoryPanel({
    versions,
    currentVersionId,
    repoFullName,
    onRestore,
    onCompare,
    className = ''
}: VersionHistoryPanelProps) {
    const getStatusIcon = (trigger: string) => {
        switch (trigger) {
            case 'ticket_done': return '✅';
            case 'ticket_skipped': return '⏭️';
            case 'ticket_failed': return '❌';
            case 'manual_save': return '💾';
            case 'auto_save': return '🔄';
            case 'build_start': return '🚀';
            case 'build_complete': return '🎉';
            case 'initial': return '📦';
            default: return '📝';
        }
    };

    const getTriggerColor = (trigger: string) => {
        switch (trigger) {
            case 'ticket_done': return 'text-green-400';
            case 'ticket_skipped': return 'text-yellow-400';
            case 'ticket_failed': return 'text-red-400';
            case 'build_complete': return 'text-purple-400';
            default: return 'text-gray-400';
        }
    };

    if (versions.length === 0) {
        return (
            <div className={`flex flex-col items-center justify-center p-8 text-gray-500 ${className}`}>
                <div className="text-4xl mb-4">📦</div>
                <p className="text-center">No versions yet</p>
                <p className="text-sm text-gray-600 mt-1">
                    Versions are created when tickets are completed
                </p>
            </div>
        );
    }

    return (
        <div className={`flex flex-col ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
                <h3 className="font-semibold text-white">Version History</h3>
                <span className="text-xs text-gray-500">{versions.length} versions</span>
            </div>

            {/* Version List */}
            <div className="flex-1 overflow-y-auto">
                {versions.map((version, index) => {
                    const isCurrent = version.id === currentVersionId;
                    const isLatest = index === 0;

                    return (
                        <div
                            key={version.id}
                            className={`relative px-4 py-3 border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${isCurrent ? 'bg-comfort-sage-500/10 border-l-2 border-l-comfort-sage-500' : ''
                                }`}
                        >
                            {/* Timeline connector */}
                            {index < versions.length - 1 && (
                                <div className="absolute left-6 top-10 bottom-0 w-px bg-gray-700" />
                            )}

                            {/* Version info */}
                            <div className="flex items-start gap-3">
                                {/* Status indicator */}
                                <div className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-xs ${isLatest ? 'bg-green-500' : 'bg-gray-600'
                                    }`}>
                                    {isLatest ? '●' : '○'}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm">{getStatusIcon(version.trigger)}</span>
                                        <span className={`font-medium truncate ${getTriggerColor(version.trigger)}`}>
                                            {version.name}
                                        </span>
                                        {isCurrent && (
                                            <span className="text-xs px-1.5 py-0.5 bg-comfort-sage-500/20 text-comfort-sage-300 rounded">
                                                Current
                                            </span>
                                        )}
                                    </div>

                                    {/* Meta info */}
                                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                        <span>{formatRelativeTime(version.createdAt)}</span>
                                        <span>•</span>
                                        <span>{version.fileCount} files</span>
                                        <span>•</span>
                                        <span>{formatBytes(version.totalSize)}</span>
                                    </div>

                                    {/* Git info */}
                                    {version.gitCommitSha && repoFullName && (
                                        <div className="mt-1">
                                            <a
                                                href={getCommitUrl(repoFullName, version.gitCommitSha)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-comfort-sage-300 hover:underline"
                                            >
                                                {version.gitCommitSha.substring(0, 7)}
                                            </a>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 mt-2">
                                        {!isCurrent && (
                                            <button
                                                onClick={() => onRestore(version.id)}
                                                className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                                            >
                                                Restore
                                            </button>
                                        )}
                                        {onCompare && index < versions.length - 1 && (
                                            <button
                                                onClick={() => onCompare(version.id, versions[index + 1].id)}
                                                className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                                            >
                                                Diff
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
