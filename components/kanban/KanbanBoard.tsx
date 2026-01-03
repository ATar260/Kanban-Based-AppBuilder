'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
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

export interface ChatMessage {
  content: string;
  type: 'user' | 'ai' | 'system' | 'file-update' | 'command' | 'error';
  timestamp: Date;
  metadata?: any;
}

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
  // Chat Props
  chatMessages?: ChatMessage[];
  chatInput?: string;
  setChatInput?: (val: string) => void;
  onSendMessage?: () => void;
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
  chatMessages = [],
  chatInput = '',
  setChatInput,
  onSendMessage,
}: KanbanBoardProps) {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [inputTicketId, setInputTicketId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'kanban' | 'preview'>('kanban');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const inputTicket = inputTicketId ? tickets.find(t => t.id === inputTicketId) : null;
  const selectedTicket = selectedTicketId ? tickets.find(t => t.id === selectedTicketId) : null;

  const displayColumns = COLUMN_CONFIG.filter(col =>
    !['blocked', 'failed', 'skipped'].includes(col.id) || ticketsByColumn[col.id].length > 0
  );

  const totalProgress = analytics.totalTickets > 0
    ? Math.round((analytics.completed / analytics.totalTickets) * 100)
    : 0;

  // Auto-scroll chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  return (
    <div className="flex h-full bg-[#09090b] text-white font-sans">
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
            {/* Build Controls */}
            {tickets.length > 0 && !isPlanning && (
              <>
                {!isBuilding ? (
                  <button
                    onClick={onStartBuild}
                    className="px-4 py-1.5 text-sm font-medium rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20"
                  >
                    ▶ Start Build
                  </button>
                ) : isPaused ? (
                  <button
                    onClick={onResumeBuild}
                    className="px-4 py-1.5 text-sm font-medium rounded-lg bg-green-500 text-white hover:bg-green-400 transition-all"
                  >
                    ▶ Resume
                  </button>
                ) : (
                  <button
                    onClick={onPauseBuild}
                    className="px-4 py-1.5 text-sm font-medium rounded-lg bg-zinc-700 text-white hover:bg-zinc-600 transition-all"
                  >
                    ⏸ Pause
                  </button>
                )}
              </>
            )}

            {isPlanning && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20">
                <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium text-purple-400">Planning...</span>
              </div>
            )}

            {isBuilding && !isPaused && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium text-amber-400">Building...</span>
              </div>
            )}

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800 border border-zinc-700">
              <span className="text-xs font-medium text-zinc-400">{tickets.length} Tasks</span>
            </div>

            {analytics.completed > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
                <span className="text-xs font-medium text-green-400">{analytics.completed} Done</span>
              </div>
            )}
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
                All
              </button>
              {['Architect', 'Coder', 'Designer', 'Analyst', 'Planner', 'DevOps'].map(role => (
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
        <div className="flex-1 overflow-x-auto overflow-y-hidden bg-[#0c0c0e] p-4">
          {activeView === 'kanban' ? (
            <div className="flex gap-3 h-full pb-2" style={{ minWidth: 'max-content' }}>
              {displayColumns.map((column, index) => {
                const filteredTickets = activeFilter
                  ? ticketsByColumn[column.id].filter(t => t.type === activeFilter)
                  : ticketsByColumn[column.id];

                return (
                  <motion.div
                    key={column.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03, duration: 0.2 }}
                    className="w-[280px] min-w-[280px] flex flex-col rounded-xl bg-[#18181b] border border-zinc-800/60 overflow-hidden shadow-lg"
                    style={{ height: 'calc(100% - 8px)' }}
                  >
                    <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center justify-between bg-[#1f1f23]">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{COLUMN_EMOJIS[column.id]}</span>
                        <span className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">{column.title}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-zinc-700/60 text-zinc-400 font-medium">
                          {filteredTickets.length}
                        </span>
                      </div>
                      <button onClick={() => setShowAddModal(true)} className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 transition-all">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
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
