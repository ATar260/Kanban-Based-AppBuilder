'use client';

import { motion } from 'framer-motion';
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

  const isActiveColumn = id === 'generating' || id === 'applying' || id === 'testing' || id === 'pr_review';

  const emptyStates: Record<TicketStatus, { icon: string; title: string; description: string; animate?: boolean }> = {
    planning: {
      icon: '🎯',
      title: 'Planning',
      description: 'AI is breaking down your request',
      animate: true,
    },
    backlog: {
      icon: '📋',
      title: 'Ready',
      description: 'Tasks will queue here',
      animate: false,
    },
    awaiting_input: {
      icon: '⏳',
      title: 'Waiting',
      description: 'No inputs needed',
      animate: false,
    },
    generating: {
      icon: '⚡',
      title: 'Generator',
      description: 'Ready to generate code',
      animate: false,
    },
    applying: {
      icon: '🔧',
      title: 'Builder',
      description: 'Will apply changes here',
      animate: false,
    },
    testing: {
      icon: '🧪',
      title: 'Tester',
      description: 'Tests run here',
      animate: false,
    },
    pr_review: {
      icon: '🔍',
      title: 'Review',
      description: 'Code review happens here',
      animate: false,
    },
    done: {
      icon: '✅',
      title: 'Complete',
      description: 'Finished tasks appear here',
      animate: false,
    },
    blocked: {
      icon: '🚫',
      title: 'Blocked',
      description: 'Dependency issues',
      animate: false,
    },
    failed: {
      icon: '❌',
      title: 'Failed',
      description: 'Errors to fix',
      animate: false,
    },
    skipped: {
      icon: '⏭️',
      title: 'Skipped',
      description: 'Tasks you skipped',
      animate: false,
    },
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
                  {id === 'pr_review' && 'Reviewer'}
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
      <div className="flex-1 space-y-2">
        {tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4">
            <motion.span
              className="text-2xl mb-2"
              animate={emptyStates[id].animate ? {
                scale: [1, 1.1, 1],
                opacity: [0.7, 1, 0.7],
              } : {}}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              {emptyStates[id].icon}
            </motion.span>
            <p className="text-xs font-medium text-zinc-400 mb-0.5">
              {emptyStates[id].title}
            </p>
            <p className="text-[10px] text-zinc-500 text-center">
              {emptyStates[id].description}
            </p>
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
