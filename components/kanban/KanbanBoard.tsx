'use client';

import { useState } from 'react';
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
  pr_review: '🔎',
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
  chatMessages?: ChatMessage[];
  chatInput?: string;
  setChatInput?: (val: string) => void;
  onSendMessage?: () => void;
}

export default function KanbanBoard({
  ticketsByColumn,
  analytics,
  isBuilding,
  isPaused,
  isPlanning,
  buildMode,
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
  tickets,
}: KanbanBoardProps) {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [inputTicketId, setInputTicketId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);

  const inputTicket = inputTicketId ? tickets.find(t => t.id === inputTicketId) : null;
  const selectedTicket = selectedTicketId ? tickets.find(t => t.id === selectedTicketId) : null;

  const displayColumns = COLUMN_CONFIG.filter(col =>
    !['blocked', 'failed', 'skipped'].includes(col.id) || ticketsByColumn[col.id].length > 0
  );

  const totalProgress = analytics.totalTickets > 0
    ? Math.round((analytics.completed / analytics.totalTickets) * 100)
    : 0;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Top Header - Responsive */}
      <header className="min-h-[48px] border-b border-gray-200 bg-white flex flex-wrap items-center justify-between px-3 py-2 gap-2 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <h2 className="text-xs sm:text-sm font-semibold text-gray-800">Build</h2>
          {tickets.length > 0 && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-16 sm:w-32 h-1.5 sm:h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                  style={{ width: `${totalProgress}%` }}
                />
              </div>
              <span className="text-[10px] sm:text-xs text-gray-500 font-medium">{totalProgress}%</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {isPlanning && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-100 text-purple-700">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] sm:text-xs font-medium hidden sm:inline">Planning...</span>
            </div>
          )}

          {isBuilding && !isPaused && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-100 text-blue-700">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] sm:text-xs font-medium hidden sm:inline">Building...</span>
            </div>
          )}

          <div className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-md bg-gray-100 text-gray-600">
            <span className="text-[10px] sm:text-xs font-medium">{tickets.length}</span>
            <span className="text-[10px] sm:text-xs font-medium hidden sm:inline">Tasks</span>
          </div>

          {analytics.completed > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-100 text-green-700">
              <span className="text-xs font-medium">{analytics.completed} Done</span>
            </div>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="p-1 sm:p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all"
            title="Add task"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sm:w-4 sm:h-4">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile Column Selector */}
      <div className="sm:hidden px-3 py-2 border-b border-gray-200 bg-white shrink-0 overflow-x-auto">
        <div className="flex items-center gap-1.5">
          {displayColumns.map((column) => {
            const count = ticketsByColumn[column.id].length;
            const isSelected = selectedColumn === column.id || (!selectedColumn && column.id === displayColumns[0]?.id);
            return (
              <button
                key={column.id}
                onClick={() => setSelectedColumn(column.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                <span>{COLUMN_EMOJIS[column.id]}</span>
                <span className="hidden xs:inline">{column.title}</span>
                {count > 0 && (
                  <span className={`px-1 rounded text-[9px] ${isSelected ? 'bg-blue-500' : 'bg-gray-200'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop Filters */}
      {tickets.length > 0 && (
        <div className="hidden sm:block px-4 py-2 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveFilter(null)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                activeFilter === null 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {['Architect', 'Coder', 'Designer', 'Analyst', 'Planner', 'DevOps'].map(role => (
              <button
                key={role}
                onClick={() => setActiveFilter(activeFilter === role ? null : role)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 whitespace-nowrap ${
                  activeFilter === role
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <span>{role === 'Architect' ? '🏗️' : role === 'Coder' ? '💻' : role === 'Designer' ? '🎨' : role === 'DevOps' ? '🚀' : '🤖'}</span>
                {role}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Kanban Columns - Mobile: Single column, Desktop: All columns */}
      <div className="flex-1 overflow-hidden p-2 sm:p-4">
        {tickets.length > 0 ? (
          <>
            {/* Mobile View - Single Column */}
            <div className="sm:hidden h-full">
              {displayColumns.map((column) => {
                const isSelected = selectedColumn === column.id || (!selectedColumn && column.id === displayColumns[0]?.id);
                if (!isSelected) return null;
                
                const filteredTickets = activeFilter
                  ? ticketsByColumn[column.id].filter(t => t.type === activeFilter)
                  : ticketsByColumn[column.id];

                return (
                  <div key={column.id} className="h-full flex flex-col rounded-lg bg-white border border-gray-200 overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-200 flex items-center gap-2 bg-gray-50">
                      <span>{COLUMN_EMOJIS[column.id]}</span>
                      <span className="text-xs font-semibold text-gray-700 uppercase">{column.title}</span>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-gray-200 text-gray-600 font-medium">
                        {filteredTickets.length}
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
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
                  </div>
                );
              })}
            </div>

            {/* Desktop View - All Columns */}
            <div className="hidden sm:flex gap-3 h-full overflow-x-scroll pb-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
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
                    className="w-[260px] lg:w-[280px] min-w-[260px] lg:min-w-[280px] flex flex-col rounded-lg bg-white border border-gray-200 overflow-hidden shadow-sm"
                    style={{ height: 'calc(100% - 8px)' }}
                  >
                    <div className="px-3 py-2.5 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{COLUMN_EMOJIS[column.id]}</span>
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{column.title}</span>
                        <span className="px-1.5 py-0.5 rounded-full text-xs bg-gray-200 text-gray-600 font-medium">
                          {filteredTickets.length}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
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
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 px-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3 sm:mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400 sm:w-8 sm:h-8">
                <path d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </div>
            <h3 className="text-xs sm:text-sm font-medium text-gray-600 mb-1">No tasks yet</h3>
            <p className="text-[10px] sm:text-xs text-gray-400 text-center">Tasks will appear here when you start a build</p>
          </div>
        )}
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
