'use client';

import { KanbanTicket as TicketType, TicketStatus } from './types';
import KanbanTicket from './KanbanTicket';

interface KanbanColumnProps {
  id: TicketStatus;
  title: string;
  color: string;
  emoji?: string;
  tickets: TicketType[];
  onEditTicket: (ticketId: string) => void;
  onSkipTicket: (ticketId: string) => void;
  onRetryTicket: (ticketId: string) => void;
  onDeleteTicket: (ticketId: string) => void;
  onRestoreTicket: (ticketId: string) => void;
  onViewCode: (ticketId: string) => void;
  onMoveUp: (ticketId: string) => void;
  onMoveDown: (ticketId: string) => void;
  onProvideInput?: (ticketId: string) => void;
  onDropTicket?: (ticketId: string, newStatus: TicketStatus) => void;
  onBuildNow?: (ticketId: string) => void;
  minimalHeader?: boolean;
}

export default function KanbanColumn({
  id,
  title,
  color,
  emoji,
  tickets,
  onEditTicket,
  onSkipTicket,
  onRetryTicket,
  onDeleteTicket,
  onRestoreTicket,
  onViewCode,
  onMoveUp,
  onMoveDown,
  onProvideInput,
  onDropTicket,
  onBuildNow,
  minimalHeader,
}: KanbanColumnProps) {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('border-amber-500/50');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('border-amber-500/50');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-amber-500/50');
    const ticketId = e.dataTransfer.getData('ticketId');
    if (ticketId && onDropTicket) {
      onDropTicket(ticketId, id);
    }
  };

  const handleDragStart = (e: React.DragEvent, ticketId: string) => {
    e.dataTransfer.setData('ticketId', ticketId);
  };

  const isActiveColumn = id === 'generating' || id === 'applying' || id === 'testing';

  const emptyMessages: Record<TicketStatus, string> = {
    planning: 'AI analyzing...',
    backlog: 'No tasks queued',
    awaiting_input: 'No inputs pending',
    generating: 'Waiting...',
    applying: 'Applying changes...',
    testing: 'Running tests...',
    done: 'No completed tasks',
    blocked: 'No blockers',
    failed: 'No failures',
    skipped: 'None skipped',
  };

  return (
    <div
      className={`w-full h-full flex flex-col rounded-none bg-transparent transition-all ${isActiveColumn && tickets.length > 0
          ? ''
          : ''
        }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column Header */}
      {!minimalHeader && (
        <div className="p-3 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {emoji && <span className="text-base">{emoji}</span>}
              <div>
                <h3 className="font-medium text-xs text-white">{title}</h3>
                <p className="text-[10px] text-zinc-500">
                  {id === 'backlog' && 'Queue'}
                  {id === 'generating' && 'AI Agent'}
                  {id === 'applying' && 'Builder'}
                  {id === 'testing' && 'Validator'}
                  {id === 'done' && 'Complete'}
                  {id === 'awaiting_input' && 'User'}
                  {id === 'planning' && 'Planner'}
                </p>
              </div>
            </div>
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: `${color}20`,
                color: color
              }}
            >
              {tickets.length}
            </span>
          </div>
        </div>
      )}

      {/* Tickets List */}
      <div className="flex-1 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        {tickets.length === 0 ? (
          <div className="text-center py-6 text-zinc-600 text-xs">
            {emptyMessages[id]}
          </div>
        ) : (
          tickets.map(ticket => (
            <div
              key={ticket.id}
              draggable={ticket.status === 'backlog' || ticket.status === 'skipped'}
              onDragStart={(e) => handleDragStart(e, ticket.id)}
              className="cursor-move"
            >
              <KanbanTicket
                ticket={ticket}
                onEdit={onEditTicket}
                onSkip={onSkipTicket}
                onRetry={onRetryTicket}
                onDelete={onDeleteTicket}
                onRestore={onRestoreTicket}
                onViewCode={onViewCode}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                onProvideInput={onProvideInput}
                onBuildNow={onBuildNow}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
