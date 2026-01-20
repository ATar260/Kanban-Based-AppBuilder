'use client';

import { useMemo, useState } from 'react';
import type { KanbanTicket } from '@/components/kanban/types';
import type { PlanVersion } from '@/hooks/usePlanVersions';
import { formatRelativeTime } from '@/lib/versioning/utils';

interface PlanVersionHistoryPanelProps {
  versions: PlanVersion[];
  currentTickets: KanbanTicket[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onCreateSnapshot?: () => void;
  onRestore: (version: PlanVersion) => void;
  restoreDisabled?: boolean;
  className?: string;
}

type TicketDiff = {
  added: KanbanTicket[];
  removed: KanbanTicket[];
  changed: Array<{ before: KanbanTicket; after: KanbanTicket; fields: string[] }>;
};

function diffTickets(before: KanbanTicket[], after: KanbanTicket[]): TicketDiff {
  const beforeById = new Map(before.map(t => [t.id, t]));
  const afterById = new Map(after.map(t => [t.id, t]));

  const added: KanbanTicket[] = [];
  const removed: KanbanTicket[] = [];
  const changed: Array<{ before: KanbanTicket; after: KanbanTicket; fields: string[] }> = [];

  for (const t of after) {
    if (!beforeById.has(t.id)) added.push(t);
  }

  for (const t of before) {
    const next = afterById.get(t.id);
    if (!next) {
      removed.push(t);
      continue;
    }

    const fields: string[] = [];
    if (t.title !== next.title) fields.push('title');
    if (t.description !== next.description) fields.push('description');
    if (t.type !== next.type) fields.push('type');
    if (t.priority !== next.priority) fields.push('priority');
    if (t.complexity !== next.complexity) fields.push('complexity');
    if (t.status !== next.status) fields.push('status');
    if (t.order !== next.order) fields.push('order');
    if (JSON.stringify(t.dependencies || []) !== JSON.stringify(next.dependencies || [])) fields.push('dependencies');
    if (JSON.stringify(t.blockedBy || []) !== JSON.stringify(next.blockedBy || [])) fields.push('blockedBy');
    if (JSON.stringify(t.inputRequests || []) !== JSON.stringify(next.inputRequests || [])) fields.push('inputRequests');

    if (fields.length > 0) changed.push({ before: t, after: next, fields });
  }

  return { added, removed, changed };
}

export function PlanVersionHistoryPanel({
  versions,
  currentTickets,
  isLoading = false,
  error = null,
  onRefresh,
  onCreateSnapshot,
  onRestore,
  restoreDisabled = false,
  className = '',
}: PlanVersionHistoryPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(versions[0]?.id || null);
  const selected = useMemo(() => versions.find(v => v.id === selectedId) || null, [versions, selectedId]);

  const diff = useMemo(() => {
    if (!selected) return null;
    return diffTickets(selected.tickets || [], currentTickets || []);
  }, [selected, currentTickets]);

  const sourceIcon = (source: string) => {
    switch (source) {
      case 'initial_plan':
        return '📦';
      case 'move_to_pipeline':
        return '🔒';
      case 'manual':
      default:
        return '💾';
    }
  };

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="min-w-0">
          <h3 className="font-semibold text-white truncate">Plan Versions</h3>
          <p className="text-xs text-gray-500 truncate">
            {versions.length > 0 ? `${versions.length} snapshot${versions.length === 1 ? '' : 's'}` : 'No snapshots yet'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
              title="Refresh"
            >
              Refresh
            </button>
          )}
          {onCreateSnapshot && (
            <button
              onClick={onCreateSnapshot}
              className="text-xs px-2 py-1 rounded bg-comfort-sage-600 hover:bg-comfort-sage-500 text-white transition-colors"
              title="Create snapshot"
            >
              Snapshot
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-red-300 bg-red-500/10 border-b border-red-500/20">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center p-8 text-gray-400">
          <div className="w-5 h-5 border-2 border-comfort-sage-500 border-t-transparent rounded-full animate-spin mr-2" />
          Loading…
        </div>
      ) : versions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-gray-500">
          <div className="text-3xl mb-3">🗂️</div>
          <p className="text-sm text-center">We’ll snapshot your plan when you click “Start Build”.</p>
          {onCreateSnapshot && (
            <button
              onClick={onCreateSnapshot}
              className="mt-3 text-xs px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors"
            >
              Create snapshot now
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto">
            {versions.map((v) => {
              const isSelected = v.id === selectedId;
              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedId(v.id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${
                    isSelected ? 'bg-comfort-sage-500/10 border-l-2 border-l-comfort-sage-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-sm">
                      {sourceIcon(v.source)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-100 font-medium truncate">{v.name}</span>
                        {v.storage === 'supabase' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-300">
                            DB
                          </span>
                        )}
                        {typeof v.versionNumber === 'number' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">
                            v{v.versionNumber}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        <span>{formatRelativeTime(v.createdAt)}</span>
                        <span>•</span>
                        <span>{(v.tickets?.length || 0)} tickets</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="border-t border-gray-700 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-gray-300">Diff vs current plan</div>
              <button
                disabled={!selected || restoreDisabled}
                onClick={() => selected && onRestore(selected)}
                className={`text-xs px-3 py-1.5 rounded transition-colors ${
                  !selected || restoreDisabled
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    : 'bg-comfort-sage-600 hover:bg-comfort-sage-500 text-white'
                }`}
                title={restoreDisabled ? 'Disabled while build is running' : 'Restore this snapshot'}
              >
                Restore
              </button>
            </div>

            {!selected || !diff ? (
              <div className="text-xs text-gray-500">Select a snapshot to see changes.</div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded bg-gray-800/60 p-2">
                    <div className="text-[10px] text-gray-500">Added</div>
                    <div className="text-sm font-semibold text-gray-100">{diff.added.length}</div>
                  </div>
                  <div className="rounded bg-gray-800/60 p-2">
                    <div className="text-[10px] text-gray-500">Removed</div>
                    <div className="text-sm font-semibold text-gray-100">{diff.removed.length}</div>
                  </div>
                  <div className="rounded bg-gray-800/60 p-2">
                    <div className="text-[10px] text-gray-500">Changed</div>
                    <div className="text-sm font-semibold text-gray-100">{diff.changed.length}</div>
                  </div>
                </div>

                {(diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0) ? (
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {diff.added.slice(0, 6).map(t => (
                      <div key={`a-${t.id}`} className="text-xs text-green-300">
                        + {t.title}
                      </div>
                    ))}
                    {diff.removed.slice(0, 6).map(t => (
                      <div key={`r-${t.id}`} className="text-xs text-red-300">
                        - {t.title}
                      </div>
                    ))}
                    {diff.changed.slice(0, 6).map(({ after, fields }) => (
                      <div key={`c-${after.id}`} className="text-xs text-yellow-200">
                        ~ {after.title} <span className="text-[10px] text-gray-500">({fields.join(', ')})</span>
                      </div>
                    ))}
                    {(diff.added.length + diff.removed.length + diff.changed.length) > 18 && (
                      <div className="text-[10px] text-gray-500">Showing first items only…</div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">No differences.</div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}


