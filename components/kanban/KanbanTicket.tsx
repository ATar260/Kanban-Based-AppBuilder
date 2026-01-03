'use client';

import { useState } from 'react';
import { KanbanTicket as TicketType, TYPE_COLORS, PRIORITY_COLORS, TICKET_ACTIONS } from './types';

interface KanbanTicketProps {
  ticket: TicketType;
  onEdit: (ticketId: string) => void;
  onSkip: (ticketId: string) => void;
  onRetry: (ticketId: string) => void;
  onDelete: (ticketId: string) => void;
  onRestore: (ticketId: string) => void;
  onViewCode: (ticketId: string) => void;
  onMoveUp: (ticketId: string) => void;
  onMoveDown: (ticketId: string) => void;
  onProvideInput?: (ticketId: string) => void;
  onBuildNow?: (ticketId: string) => void;
  isDragging?: boolean;
}

export default function KanbanTicket({
  ticket,
  onEdit,
  onSkip,
  onRetry,
  onDelete,
  onRestore,
  onViewCode,
  onMoveUp,
  onMoveDown,
  onProvideInput,
  onBuildNow,
  isDragging = false,
}: KanbanTicketProps) {
  const [showActions, setShowActions] = useState(false);
  const actions = TICKET_ACTIONS[ticket.status];

  const priorityDots = {
    critical: 3,
    high: 2,
    medium: 1,
    low: 0,
  };

  const handleAction = (action: string) => {
    switch (action) {
      case 'edit': onEdit(ticket.id); break;
      case 'skip': onSkip(ticket.id); break;
      case 'retry': onRetry(ticket.id); break;
      case 'delete': onDelete(ticket.id); break;
      case 'restore': onRestore(ticket.id); break;
      case 'view-code':
      case 'view-error': onViewCode(ticket.id); break;
      case 'move-up': onMoveUp(ticket.id); break;
      case 'move-down': onMoveDown(ticket.id); break;
      case 'regenerate': onRetry(ticket.id); break;
      case 'provide-input': onProvideInput?.(ticket.id); break;
      case 'build-now': onBuildNow?.(ticket.id); break;
    }
    setShowActions(false);
  };

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-3 shadow-sm transition-all ${
        isDragging ? 'shadow-lg scale-105 rotate-2' : 'hover:shadow-md'
      } ${ticket.status === 'failed' ? 'border-red-300 bg-red-50' : ''} ${
        ticket.status === 'awaiting_input' ? 'border-orange-300 bg-orange-50' : ''
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{ backgroundColor: `${TYPE_COLORS[ticket.type]}20`, color: TYPE_COLORS[ticket.type] }}
          >
            {ticket.type}
          </span>
          <div className="flex gap-0.5">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${
                  i < priorityDots[ticket.priority]
                    ? ''
                    : 'bg-gray-200'
                }`}
                style={i < priorityDots[ticket.priority] ? { backgroundColor: PRIORITY_COLORS[ticket.priority] } : {}}
              />
            ))}
          </div>
        </div>
        <span className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
          {ticket.complexity}
        </span>
      </div>

      <h4 className="font-medium text-sm text-gray-900 mb-1 line-clamp-1">{ticket.title}</h4>
      <p className="text-xs text-gray-500 line-clamp-2 mb-2">{ticket.description}</p>

      <div className="flex items-center gap-3 text-[10px] text-gray-400 mb-2">
        <span className="flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          {ticket.actualFiles.length || ticket.estimatedFiles} files
        </span>
        {ticket.dependencies.length > 0 && (
          <span className="flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            {ticket.dependencies.length} deps
          </span>
        )}
        {ticket.duration && (
          <span className="flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {Math.round(ticket.duration / 1000)}s
          </span>
        )}
      </div>

      {(ticket.status === 'generating' || ticket.status === 'applying') && (
        <div className="mb-2">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${ticket.progress}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-400 mt-0.5 block">{ticket.progress}%</span>
        </div>
      )}

      {ticket.error && (
        <div className="text-[10px] text-red-600 bg-red-50 px-2 py-1 rounded mb-2 line-clamp-2">
          {ticket.error}
        </div>
      )}

      {ticket.status === 'awaiting_input' && ticket.inputRequests && ticket.inputRequests.length > 0 && (
        <div className="text-[10px] text-orange-600 bg-orange-100 px-2 py-1.5 rounded mb-2 flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{ticket.inputRequests.length} input{ticket.inputRequests.length > 1 ? 's' : ''} needed</span>
        </div>
      )}

      {showActions && actions.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-2 border-t border-gray-100">
          {actions.map(action => (
            <button
              key={action}
              onClick={() => handleAction(action)}
              className="text-[10px] px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
            >
              {action.replace('-', ' ')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
