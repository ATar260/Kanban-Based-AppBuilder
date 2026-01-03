import { useState, useCallback } from 'react';
import type { TicketStatus } from '@/components/kanban/types';

const COLUMN_ORDER: TicketStatus[] = [
  'backlog',
  'generating',
  'applying',
  'testing',
  'done',
];

interface MoveValidation {
  isValid: boolean;
  isBackward: boolean;
  requiresConfirmation: boolean;
  message?: string;
}

interface PendingMove {
  ticketId: string;
  ticketTitle: string;
  fromColumn: TicketStatus;
  toColumn: TicketStatus;
}

export function useTicketMovement() {
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [showRegressionWarning, setShowRegressionWarning] = useState(false);

  const validateMove = useCallback((
    fromColumn: TicketStatus,
    toColumn: TicketStatus,
    ticketStatus?: TicketStatus
  ): MoveValidation => {
    const fromIndex = COLUMN_ORDER.indexOf(fromColumn);
    const toIndex = COLUMN_ORDER.indexOf(toColumn);

    if (fromIndex === -1 || toIndex === -1) {
      return { isValid: false, isBackward: false, requiresConfirmation: false, message: 'Invalid column' };
    }

    if (fromColumn === toColumn) {
      return { isValid: true, isBackward: false, requiresConfirmation: false };
    }

    const isBackward = toIndex < fromIndex;

    if (isBackward) {
      if (fromColumn === 'done' || fromColumn === 'testing') {
        return {
          isValid: true,
          isBackward: true,
          requiresConfirmation: true,
          message: 'Moving completed work backward will revert changes',
        };
      }
      return { isValid: true, isBackward: true, requiresConfirmation: false };
    }

    const stepDifference = toIndex - fromIndex;
    if (stepDifference > 1) {
      return {
        isValid: false,
        isBackward: false,
        requiresConfirmation: false,
        message: 'Cannot skip columns. Tasks must progress sequentially.',
      };
    }

    return { isValid: true, isBackward: false, requiresConfirmation: false };
  }, []);

  const initiateMove = useCallback((
    ticketId: string,
    ticketTitle: string,
    fromColumn: TicketStatus,
    toColumn: TicketStatus
  ): boolean => {
    const validation = validateMove(fromColumn, toColumn);

    if (!validation.isValid) {
      return false;
    }

    if (validation.requiresConfirmation) {
      setPendingMove({ ticketId, ticketTitle, fromColumn, toColumn });
      setShowRegressionWarning(true);
      return false;
    }

    return true;
  }, [validateMove]);

  const confirmMove = useCallback(() => {
    const move = pendingMove;
    setPendingMove(null);
    setShowRegressionWarning(false);
    return move;
  }, [pendingMove]);

  const cancelMove = useCallback(() => {
    setPendingMove(null);
    setShowRegressionWarning(false);
  }, []);

  const getColumnStyle = useCallback((
    columnId: TicketStatus,
    draggedFromColumn?: TicketStatus
  ): { canDrop: boolean; isHighlighted: boolean } => {
    if (!draggedFromColumn) {
      return { canDrop: true, isHighlighted: false };
    }

    const validation = validateMove(draggedFromColumn, columnId);
    return {
      canDrop: validation.isValid,
      isHighlighted: validation.isValid && draggedFromColumn !== columnId,
    };
  }, [validateMove]);

  return {
    validateMove,
    initiateMove,
    confirmMove,
    cancelMove,
    pendingMove,
    showRegressionWarning,
    getColumnStyle,
  };
}
