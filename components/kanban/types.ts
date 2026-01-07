import type { BuildBlueprint, DataMode, TemplateTarget } from '@/types/build-blueprint';

export type TicketStatus =
  | 'planning'
  | 'backlog'
  | 'awaiting_input'
  | 'generating'
  | 'applying'
  | 'testing'
  | 'pr_review'
  | 'done'
  | 'blocked'
  | 'failed'
  | 'skipped';

export type InputRequestType = 'api_key' | 'credential' | 'env_var' | 'url' | 'text';

export interface InputRequest {
  id: string;
  type: InputRequestType;
  label: string;
  placeholder: string;
  description?: string;
  required: boolean;
  sensitive?: boolean;
}

export type TicketType =
  | 'component'
  | 'feature'
  | 'layout'
  | 'styling'
  | 'integration'
  | 'config'
  | 'database';

export type TicketPriority = 'critical' | 'high' | 'medium' | 'low';

export type TicketComplexity = 'XS' | 'S' | 'M' | 'L' | 'XL';

export interface BlueprintRefs {
  routeIds?: string[];
  flowIds?: string[];
  entityNames?: string[];
}

export interface DatabaseConfig {
  provider: 'supabase' | 'firebase' | 'mongodb' | 'postgres' | 'mysql' | 'sqlite';
  tables?: Array<{
    name: string;
    columns: Array<{ name: string; type: string; nullable?: boolean; primary?: boolean }>;
  }>;
  connectionString?: string;
  autoSetup?: boolean;
}

export interface KanbanTicket {
  id: string;
  title: string;
  description: string;
  type: TicketType;
  status: TicketStatus;
  priority: TicketPriority;
  complexity: TicketComplexity;
  estimatedFiles: number;
  actualFiles: string[];
  dependencies: string[];
  blockedBy: string[];
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  updatedAt?: Date;
  duration?: number;
  generatedCode?: string;
  previewAvailable: boolean;
  error?: string;
  retryCount: number;
  userModified: boolean;
  userNotes?: string;
  order: number;
  requiresInput?: boolean;
  inputRequests?: InputRequest[];
  userInputs?: Record<string, string>;
  databaseConfig?: DatabaseConfig;
  manualBuild?: boolean;
  blueprintRefs?: BlueprintRefs;
}

export type BuildMode = 'auto' | 'manual';

export interface BuildPlan {
  id: string;
  prompt: string;
  description?: string;
  tickets: KanbanTicket[];
  totalEstimatedTime: string;
  totalFiles: number;
  createdAt: Date;
  updatedAt: Date;
  status: 'planning' | 'ready' | 'building' | 'paused' | 'completed' | 'failed';
  buildMode: BuildMode;
  sandboxPersistent?: boolean;
  persistentUrl?: string;
  /**
   * Blueprint scaffold status for the currently active sandbox.
   * Used to avoid re-scaffolding (and potentially overwriting) on every resume.
   */
  scaffolded?: boolean;
  scaffoldedSandboxId?: string;
  /**
   * Blueprint-driven build metadata (optional for backward compatibility).
   * Stored as plain JSON (no functions/Dates) so it can be safely persisted.
   */
  blueprint?: BuildBlueprint;
  templateTarget?: TemplateTarget;
  dataMode?: DataMode;
}

export interface BuildAnalytics {
  totalTickets: number;
  completed: number;
  failed: number;
  skipped: number;
  inProgress: number;
  blocked: number;
  totalDuration: number;
  averageTicketTime: number;
  filesGenerated: number;
}

export interface KanbanColumn {
  id: TicketStatus;
  title: string;
  color: string;
  tickets: KanbanTicket[];
}

export const COLUMN_CONFIG: { id: TicketStatus; title: string; color: string }[] = [
  { id: 'planning', title: 'Planning', color: '#8B5CF6' },
  { id: 'backlog', title: 'Backlog', color: '#6B7280' },
  { id: 'awaiting_input', title: 'Awaiting Input', color: '#F97316' },
  { id: 'generating', title: 'Generating', color: '#3B82F6' },
  { id: 'applying', title: 'Applying', color: '#F59E0B' },
  { id: 'testing', title: 'Testing', color: '#8B5CF6' },
  { id: 'pr_review', title: 'PR Review', color: '#6366F1' },
  { id: 'done', title: 'Done', color: '#22C55E' },
];

export const TYPE_COLORS: Record<TicketType, string> = {
  component: '#3B82F6',
  feature: '#8B5CF6',
  layout: '#10B981',
  styling: '#F59E0B',
  integration: '#EF4444',
  config: '#6B7280',
  database: '#06B6D4',
};

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  critical: '#DC2626',
  high: '#F97316',
  medium: '#EAB308',
  low: '#22C55E',
};

export const COMPLEXITY_ESTIMATES: Record<TicketComplexity, number> = {
  XS: 5,
  S: 10,
  M: 20,
  L: 35,
  XL: 60,
};

export const TICKET_ACTIONS: Record<TicketStatus, string[]> = {
  planning: [],
  backlog: ['edit', 'skip', 'delete', 'move-up', 'move-down', 'build-now'],
  awaiting_input: ['provide-input', 'skip', 'edit'],
  generating: ['view-code'],
  applying: ['view-code'],
  testing: ['view-code'],
  pr_review: ['view-code'],
  done: ['view-code', 'regenerate'],
  failed: ['retry', 'skip', 'edit', 'view-error'],
  blocked: ['view-blockers'],
  skipped: ['restore', 'delete'],
};

export const DATABASE_PROVIDERS = {
  supabase: {
    name: 'Supabase',
    icon: '🔥',
    requiredInputs: ['supabase_url', 'supabase_anon_key'],
  },
  firebase: {
    name: 'Firebase',
    icon: '🔶',
    requiredInputs: ['firebase_config'],
  },
  mongodb: {
    name: 'MongoDB',
    icon: '🍃',
    requiredInputs: ['mongodb_uri'],
  },
  postgres: {
    name: 'PostgreSQL',
    icon: '🐘',
    requiredInputs: ['postgres_url'],
  },
  mysql: {
    name: 'MySQL',
    icon: '🐬',
    requiredInputs: ['mysql_url'],
  },
  sqlite: {
    name: 'SQLite',
    icon: '📦',
    requiredInputs: [],
  },
};
