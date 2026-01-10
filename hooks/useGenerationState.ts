'use client';

import { useMemo } from 'react';
import type { BuildPlan, KanbanTicket } from '@/components/kanban/types';

export type GenerationState = 'idle' | 'analyzing' | 'building' | 'complete';

export interface GenerationStateContext {
  state: GenerationState;
  prompt: string | null;
  plan: BuildPlan | null;
  tickets: KanbanTicket[];
  progress: number;
  isPlanning: boolean;
  isBuilding: boolean;
}

interface UseGenerationStateProps {
  plan: BuildPlan | null;
  tickets: KanbanTicket[];
  isPlanning: boolean;
  hasInitialSubmission: boolean;
  generationProgress: {
    isGenerating: boolean;
    isThinking?: boolean;
  };
}

/**
 * Derives the current generation state from existing app state.
 * This is a "derived state" hook - it computes the UI state from
 * the existing plan/ticket/progress state rather than managing its own.
 */
export function useGenerationState({
  plan,
  tickets,
  isPlanning,
  hasInitialSubmission,
  generationProgress,
}: UseGenerationStateProps): GenerationStateContext {
  const state = useMemo((): GenerationState => {
    // No submission yet = idle (show template selector)
    if (!hasInitialSubmission && !plan && tickets.length === 0) {
      return 'idle';
    }

    // Planning in progress = analyzing
    if (isPlanning || generationProgress.isThinking) {
      return 'analyzing';
    }

    // Has tickets but not all done = building
    if (tickets.length > 0) {
      const doneCount = tickets.filter(t => t.status === 'done').length;
      const failedCount = tickets.filter(t => t.status === 'failed').length;
      const skippedCount = tickets.filter(t => t.status === 'skipped').length;
      const completedOrSkipped = doneCount + failedCount + skippedCount;

      if (completedOrSkipped >= tickets.length) {
        return 'complete';
      }
      return 'building';
    }

    // Has initial submission but no tickets yet = analyzing
    if (hasInitialSubmission) {
      return 'analyzing';
    }

    return 'idle';
  }, [hasInitialSubmission, plan, tickets, isPlanning, generationProgress.isThinking]);

  const progress = useMemo(() => {
    if (tickets.length === 0) return 0;
    const doneCount = tickets.filter(t => t.status === 'done').length;
    return Math.round((doneCount / tickets.length) * 100);
  }, [tickets]);

  const isBuilding = useMemo(() => {
    return tickets.some(t =>
      ['generating', 'applying', 'testing', 'pr_review'].includes(t.status)
    );
  }, [tickets]);

  return {
    state,
    prompt: null, // Could be enhanced to track the original prompt
    plan,
    tickets,
    progress,
    isPlanning,
    isBuilding,
  };
}
