import type { BuildPlan, KanbanTicket, TicketStatus } from '@/components/kanban/types';
import type { UIStyle } from '@/types/ui-style';

export type BuildRunStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed';

export type BuildRunMode = 'full' | 'single_ticket';

export interface BuildRunInput {
  plan: BuildPlan;
  tickets: KanbanTicket[];
  /**
   * The sandbox to apply changes into for this run.
   * Phase 1 uses a single sandbox for the whole run.
   */
  sandboxId: string;
  /**
   * AI model identifier (e.g. `openai/gpt-4o`).
   */
  model: string;
  /**
   * Optional UI style chosen during planning (used to keep ticket prompts consistent).
   */
  uiStyle?: UIStyle;
  /**
   * Optional: run only one ticket (manual build-now).
   */
  onlyTicketId?: string;
  /**
   * Optional: maximum number of tickets to execute concurrently (bounded worker pool).
   */
  maxConcurrency?: number;
  /**
   * Optional: skip PR review/auto-fix stage for demo speed.
   * If true, generated patches go straight to the merge queue.
   */
  skipPrReview?: boolean;
  /**
   * Optional: skip integration gate ("testing") + healing for demo speed.
   * If true, merges are accepted immediately after apply.
   */
  skipIntegrationGate?: boolean;
}

export type BuildEvent =
  | {
      type: 'run_started';
      runId: string;
      status: BuildRunStatus;
      at: number;
      planId?: string;
      sandboxId: string;
      mode: BuildRunMode;
    }
  | {
      type: 'run_status';
      runId: string;
      status: BuildRunStatus;
      at: number;
      message?: string;
      error?: string;
    }
  | {
      type: 'log';
      runId: string;
      at: number;
      level: 'system' | 'info' | 'warning' | 'error';
      message: string;
      ticketId?: string;
    }
  | {
      type: 'ticket_status';
      runId: string;
      at: number;
      ticketId: string;
      status: TicketStatus;
      progress?: number;
      error?: string;
      retryCount?: number;
    }
  | {
      type: 'ticket_warnings';
      runId: string;
      at: number;
      ticketId: string;
      warnings: string[];
    }
  | {
      type: 'ticket_artifacts';
      runId: string;
      at: number;
      ticketId: string;
      generatedCode?: string;
      appliedFiles?: string[];
      applyDurationMs?: number;
      reviewDurationMs?: number;
      validationDurationMs?: number;
      reviewIssuesCount?: number;
    }
  | {
      type: 'run_completed';
      runId: string;
      status: BuildRunStatus;
      at: number;
    };

export interface BuildRunRecord {
  runId: string;
  createdAt: number;
  updatedAt: number;
  status: BuildRunStatus;
  paused: boolean;
  input: BuildRunInput;
  events: BuildEvent[];
  /**
   * Latest known tickets state as mutated by the run (server-side truth for this run).
   * The UI can reconcile against this if it misses SSE events.
   */
  tickets: KanbanTicket[];
  currentTicketId?: string;
  error?: string;
  baseUrl?: string;
}

