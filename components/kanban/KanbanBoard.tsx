'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { KanbanTicket, BuildPlan, TicketStatus, COLUMN_CONFIG, BuildAnalytics, BuildMode } from './types';
import KanbanColumn from './KanbanColumn';
import KanbanTicketModal from './KanbanTicketModal';
import TicketEditor from './TicketEditor';
import InputRequestModal from './InputRequestModal';

const COLUMN_EMOJIS: Record<string, string> = {
  planning: '🎯',
  backlog: '📋',
  awaiting_input: '⏳',
  generating: '⚡',
  applying: '🔧',
  testing: '🧪',
  done: '✅',
  blocked: '🚫',
  failed: '❌',
  skipped: '⏭️',
};

interface KanbanBoardProps {
  plan: BuildPlan | null;
  ticketsByColumn: Record<TicketStatus, KanbanTicket[]>;
  analytics: BuildAnalytics;
  currentTicketId: string | null;
  isBuilding: boolean;
  isPaused: boolean;
  isPlanning: boolean;
  buildMode: BuildMode;
  onPlanBuild: (prompt: string) => void;
  onStartBuild: () => void;
  onPauseBuild: () => void;
  onResumeBuild: () => void;
  onEditTicket: (ticketId: string, updates: Partial<KanbanTicket>) => void;
  onSkipTicket: (ticketId: string) => void;
  onRetryTicket: (ticketId: string) => void;
  onDeleteTicket: (ticketId: string) => void;
  onRestoreTicket: (ticketId: string) => void;
  onMoveTicket: (ticketId: string, newStatus: TicketStatus) => void;
  onReorderTicket: (ticketId: string, direction: 'up' | 'down') => void;
  onAddTicket: (ticket: Omit<KanbanTicket, 'id' | 'order'>) => void;
  onSubmitInput: (ticketId: string, inputs: Record<string, string>) => void;
  onBuildSingleTicket?: (ticketId: string) => void;
  onSetBuildMode?: (mode: BuildMode) => void;
  tickets: KanbanTicket[];
  previewUrl?: string;
}

export default function KanbanBoard({
  plan,
  ticketsByColumn,
  analytics,
  currentTicketId,
  isBuilding,
  isPaused,
  isPlanning,
  buildMode,
  onPlanBuild,
  onStartBuild,
  onPauseBuild,
  onResumeBuild,
  onEditTicket,
  onSkipTicket,
  onRetryTicket,
  onDeleteTicket,
  onRestoreTicket,
  onMoveTicket,
  onReorderTicket,
  onAddTicket,
  onSubmitInput,
  onBuildSingleTicket,
  onSetBuildMode,
  tickets,
  previewUrl,
}: KanbanBoardProps) {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [inputTicketId, setInputTicketId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'kanban' | 'preview'>('kanban');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const inputTicket = inputTicketId ? tickets.find(t => t.id === inputTicketId) : null;
  const selectedTicket = selectedTicketId ? tickets.find(t => t.id === selectedTicketId) : null;

  const displayColumns = COLUMN_CONFIG.filter(col =>
    !['blocked', 'failed', 'skipped'].includes(col.id) || ticketsByColumn[col.id].length > 0
  );

  const totalProgress = analytics.totalTickets > 0
    ? Math.round((analytics.completed / analytics.totalTickets) * 100)
    : 0;

  // Derived activities (mocked for now, but could be real event log)
  const activities = useMemo(() => {
    const recent = tickets
      .filter(t => t.status !== 'backlog')
      .sort((a, b) => (b.updatedAt ? new Date(b.updatedAt).getTime() : 0) - (a.updatedAt ? new Date(a.updatedAt).getTime() : 0))
      .slice(0, 5);
    return recent;
  }, [tickets]);

  return (
    <div className="flex h-full bg-[#09090b] text-white font-sans">
      {/* Sidebar - Command Centre */}
      <div className="w-[300px] flex-shrink-0 border-r border-white/[0.06] bg-[#0f0f11] flex flex-col">
        {/* Logo Area */}
        <div className="p-4 border-b border-white/[0.06]">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <span className="text-amber-500">Timbs A.I.</span>
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Status Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-amber-500">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z" /></svg>
              </span>
              <span className="font-semibold text-sm">Command Centre</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-medium text-green-500 uppercase">Online</span>
            </div>
          </div>

          {/* Current Mission */}
          <div>
            <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Current Mission</div>
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 relative overflow-hidden group mb-2">
              <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="text-amber-500 hover:text-amber-400">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </button>
              </div>
              <p className="text-sm font-medium text-amber-100 leading-relaxed line-clamp-3">
                {plan?.description ? `"${plan.description}"` : '"Waiting for mission parameters..."'}
              </p>
            </div>
            <div className="flex gap-1">
              <button className="flex-1 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-all border border-transparent hover:border-zinc-700">
                System Design
              </button>
              <button className="flex-1 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-all">
                Execution Plan
              </button>
            </div>
          </div>

          {/* Architecture */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Architecture</div>
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-500 rounded border border-amber-500/20">Auto-generated</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-2 rounded-lg bg-zinc-800/30 border border-white/[0.04]">
                <div className="w-8 h-8 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-500">🔐</span>
                </div>
                <div>
                  <div className="text-xs font-medium text-zinc-200">Auth Service</div>
                  <div className="text-[10px] text-zinc-500">OAuth + JWT + Sessions</div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-2 rounded-lg bg-zinc-800/30 border border-white/[0.04]">
                <div className="w-8 h-8 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-purple-500">💾</span>
                </div>
                <div>
                  <div className="text-xs font-medium text-zinc-200">Database</div>
                  <div className="text-[10px] text-zinc-500">Users, Sessions, Tokens</div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-2 rounded-lg bg-zinc-800/30 border border-white/[0.04]">
                <div className="w-8 h-8 rounded bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-green-500">⚛️</span>
                </div>
                <div>
                  <div className="text-xs font-medium text-zinc-200">Frontend</div>
                  <div className="text-[10px] text-zinc-500">React + Tailwind UI</div>
                </div>
              </div>
            </div>
          </div>

          {/* Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Progress</div>
              <div className="text-[10px] text-zinc-400">{analytics.completed}/{analytics.totalTickets}</div>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-orange-400">● Drafting Intent</span>
                  <span className="text-zinc-600">Done</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-orange-400 to-orange-600 w-full" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-amber-400">● Building</span>
                  <span className="text-zinc-400">{totalProgress}%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 w-[var(--progress)]" style={{ '--progress': `${totalProgress}%` } as any} />
                </div>
              </div>
              {/* Global progress */}
              <div className="pt-2 border-t border-white/[0.04]">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-zinc-400">Overall</span>
                  <span className="text-zinc-300">{totalProgress}%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 w-[var(--progress)]" style={{ '--progress': `${totalProgress}%` } as any} />
                </div>
              </div>
            </div>
          </div>

          {/* Swarm Activity */}
          <div className="flex-1 min-h-[100px]">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Swarm Activity</div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] text-green-500">Live</span>
              </div>
            </div>
            <div className="space-y-3 relative pb-4">
              <div className="absolute left-[3px] top-1 bottom-0 w-px bg-zinc-800" />
              {activities.map((activity, i) => (
                <div key={activity.id} className="relative pl-4 text-xs group">
                  <div className={`absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full border border-zinc-900 ring-2 ring-[#0f0f11] z-10 ${activity.status === 'done' ? 'bg-green-500' : 'bg-amber-500'
                    }`} />
                  <div className="text-zinc-400 truncate w-full">
                    <span className={`font-medium ${activity.status === 'done' ? 'text-green-400' :
                        activity.status === 'generating' ? 'text-amber-400' : 'text-zinc-300'
                      }`}>
                      {activity.status === 'done' ? 'Completed' :
                        activity.status === 'generating' ? 'Building' : 'Updated'}
                    </span>
                    <span className="opacity-75 block mt-0.5 text-zinc-500 group-hover:text-zinc-300 transition-colors"> {activity.title}</span>
                  </div>
                  <div className="text-[10px] text-zinc-600 mt-1">
                    {activity.updatedAt ? new Date(activity.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                  </div>
                </div>
              ))}
              {activities.length === 0 && (
                <div className="pl-4 text-xs text-zinc-600 italic">Waiting for activity...</div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/[0.06] bg-[#0c0c0e]">
          <div className="grid grid-cols-2 gap-2 mb-2">
            {onSetBuildMode && (
              <>
                <button
                  onClick={() => onSetBuildMode('auto')}
                  className={`p-2 rounded-lg text-xs font-medium text-center transition-all border ${buildMode === 'auto'
                      ? 'bg-amber-500 text-black border-amber-500'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                    }`}
                >
                  ✨ Auto Check
                </button>
                <button
                  onClick={() => onSetBuildMode('manual')}
                  className={`p-2 rounded-lg text-xs font-medium text-center transition-all border ${buildMode === 'manual'
                      ? 'bg-purple-500 text-white border-purple-500'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                    }`}
                >
                  🛠️ Manual
                </button>
              </>
            )}
          </div>
          <button
            onClick={() => setActiveView(activeView === 'kanban' ? 'preview' : 'kanban')}
            className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors border border-white/[0.06] mb-2"
          >
            {activeView === 'kanban' ? 'See Preview' : 'Back to Board'}
          </button>
          {isBuilding && !isPaused ? (
            <button onClick={onPauseBuild} className="w-full py-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 rounded-lg text-xs font-medium transition-colors">
              Pause Build
            </button>
          ) : (
            !isBuilding && tickets.length > 0 && (
              <button onClick={onStartBuild} className="w-full py-2 bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/20 rounded-lg text-xs font-medium transition-colors">
                Start Build
              </button>
            )
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Top Header */}
        <header className="h-14 border-b border-white/[0.06] bg-[#0f0f11] flex items-center justify-between px-4 sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            {/* Search */}
            <div className="relative w-full max-w-md group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-zinc-500 group-focus-within:text-zinc-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search tasks, agents..."
                className="block w-full pl-10 pr-3 py-1.5 border border-zinc-800 rounded-lg leading-5 bg-zinc-900/50 text-zinc-300 placeholder-zinc-600 focus:outline-none focus:bg-black focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 sm:text-sm transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/5 border border-green-500/10">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-green-500">6 Agents Active</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800 border border-zinc-700">
              <span className="text-xs font-medium text-zinc-400">{tickets.length} Tasks</span>
            </div>
            <button className="p-1.5 text-zinc-400 hover:text-white transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>
            </button>
          </div>
        </header>

        {/* Kanban Filters */}
        {activeView === 'kanban' && (
          <div className="px-4 py-3 border-b border-white/[0.04] bg-[#0c0c0e] shrink-0">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setActiveFilter(null)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${activeFilter === null ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-zinc-400 bg-zinc-800/50 hover:bg-zinc-800 hover:text-zinc-200 border border-transparent'
                  }`}
              >
                All Agents
              </button>
              {['Architect', 'Coder', 'Designer', 'Analyst', 'Planner', 'DevOps', 'Frontend'].map(role => (
                <button
                  key={role}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-500 bg-zinc-800/20 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-lg transition-all flex items-center gap-1.5 border border-transparent hover:border-zinc-700"
                >
                  <span>{role === 'Architect' ? '🏗️' : role === 'Coder' ? '💻' : role === 'Designer' ? '🎨' : role === 'DevOps' ? '🚀' : '🤖'}</span>
                  {role}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Board Area */}
        <div className="flex-1 overflow-x-auto bg-[#0c0c0e] p-6">
          {activeView === 'kanban' ? (
            tickets.length > 0 ? (
              <div className="flex gap-4 min-w-max h-full">
                {displayColumns.map((column, index) => {
                  const filteredTickets = activeFilter
                    ? ticketsByColumn[column.id].filter(t => t.type === activeFilter)
                    : ticketsByColumn[column.id];

                  return (
                    <motion.div
                      key={column.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="w-80 flex flex-col h-full rounded-xl bg-[#0f0f11]/50 border border-white/[0.04] overflow-hidden shadow-sm"
                    >
                      <div className="p-3 border-b border-white/[0.04] flex items-center justify-between bg-[#111113]">
                        <div className="flex items-center gap-2">
                          <span className="text-sm grayscale opacity-70">{COLUMN_EMOJIS[column.id]}</span>
                          <span className="text-xs font-bold text-zinc-300 uppercase tracking-wide">{column.title}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800/80 text-zinc-500 font-mono">
                            {filteredTickets.length}
                          </span>
                        </div>
                        <button onClick={() => setShowAddModal(true)} className="text-zinc-600 hover:text-zinc-400 transition-colors">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-zinc-800">
                        <KanbanColumn
                          id={column.id}
                          title={column.title}
                          color={column.color}
                          emoji={COLUMN_EMOJIS[column.id]}
                          tickets={filteredTickets}
                          onEditTicket={(id) => setSelectedTicketId(id)}
                          onSkipTicket={onSkipTicket}
                          onRetryTicket={onRetryTicket}
                          onDeleteTicket={onDeleteTicket}
                          onRestoreTicket={onRestoreTicket}
                          onViewCode={(id) => setSelectedTicketId(id)}
                          onMoveUp={(id) => onReorderTicket(id, 'up')}
                          onMoveDown={(id) => onReorderTicket(id, 'down')}
                          onProvideInput={(id) => setInputTicketId(id)}
                          onDropTicket={onMoveTicket}
                          onBuildNow={buildMode === 'manual' ? onBuildSingleTicket : undefined}
                          minimalHeader={true}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              // Empty State
              <div className="h-full flex flex-col items-center justify-center">
                <div className="text-center p-12 rounded-2xl border border-zinc-800 bg-zinc-900/30">
                  <div className="text-5xl mb-6">✨</div>
                  <h3 className="text-2xl font-bold text-white mb-2">Timbs A.I. Command Centre</h3>
                  <p className="text-zinc-500 mb-8 max-w-sm mx-auto leading-relaxed">
                    Your agents are ready. Establish a mission to begin the architectural drafting process.
                  </p>
                  <button
                    onClick={() => onPlanBuild('Build a new react application')}
                    className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold rounded-xl hover:shadow-lg hover:shadow-amber-500/20 transition-all opacity-80 hover:opacity-100"
                  >
                    Initialize Mission
                  </button>
                </div>
              </div>
            )
          ) : (
            /* Preview Mode */
            <div className="h-full rounded-xl overflow-hidden border border-white/[0.06] bg-black shadow-2xl">
              {previewUrl ? (
                <iframe src={previewUrl} className="w-full h-full bg-white" title="Preview" />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                  <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                  </div>
                  <p>No preview available yet</p>
                  <p className="text-xs text-zinc-600 mt-2">Start a build to generate the preview</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals remain mostly same */}
      {selectedTicket && (
        <KanbanTicketModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicketId(null)}
          onEdit={(updates) => onEditTicket(selectedTicket.id, updates)}
          onSkip={() => { onSkipTicket(selectedTicket.id); setSelectedTicketId(null); }}
          onRetry={() => { onRetryTicket(selectedTicket.id); setSelectedTicketId(null); }}
          onDelete={() => { onDeleteTicket(selectedTicket.id); setSelectedTicketId(null); }}
        />
      )}

      {showAddModal && (
        <TicketEditor
          onSave={(ticket) => { onAddTicket(ticket); setShowAddModal(false); }}
          onCancel={() => setShowAddModal(false)}
          existingTickets={tickets}
        />
      )}

      {inputTicket && inputTicket.inputRequests && inputTicket.inputRequests.length > 0 && (
        <InputRequestModal
          ticket={inputTicket}
          onSubmit={(ticketId, inputs) => { onSubmitInput(ticketId, inputs); setInputTicketId(null); }}
          onCancel={() => setInputTicketId(null)}
          onSkip={() => { onSkipTicket(inputTicket.id); setInputTicketId(null); }}
        />
      )}
    </div>
  );
}
