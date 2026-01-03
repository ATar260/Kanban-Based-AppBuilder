/**
 * Build Tracker Agent
 * 
 * Monitors the build process and updates Kanban tickets in real-time.
 * Runs independently from the builder agent, observing file changes
 * and generation progress.
 */

import { KanbanTicket, TicketStatus, TicketType } from '@/components/kanban/types';

export interface BuildEvent {
  type: 'file_started' | 'file_completed' | 'file_failed' | 'build_started' | 'build_completed' | 'build_failed' | 'applying' | 'thinking';
  filePath?: string;
  content?: string;
  error?: string;
  progress?: number;
  timestamp: Date;
}

export interface TrackerCallbacks {
  onTicketCreate: (ticket: Omit<KanbanTicket, 'id' | 'order'>) => KanbanTicket;
  onTicketUpdate: (ticketId: string, updates: Partial<KanbanTicket>) => void;
  onTicketStatusChange: (ticketId: string, status: TicketStatus, error?: string) => void;
  onProgressUpdate: (ticketId: string, progress: number) => void;
}

export class BuildTrackerAgent {
  private callbacks: TrackerCallbacks;
  private mainTicketId: string | null = null;
  private fileTickets: Map<string, string> = new Map(); // filePath -> ticketId
  private isActive: boolean = false;
  private buildDescription: string = '';

  constructor(callbacks: TrackerCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Start tracking a new build
   */
  startTracking(description: string): string {
    this.isActive = true;
    this.buildDescription = description;
    this.fileTickets.clear();

    // Create main build ticket
    const mainTicket = this.callbacks.onTicketCreate({
      title: `🚀 ${description.length > 50 ? description.substring(0, 50) + '...' : description}`,
      description: description,
      type: 'feature',
      status: 'generating',
      priority: 'high',
      complexity: 'L',
      estimatedFiles: 5,
      actualFiles: [],
      dependencies: [],
      blockedBy: [],
      progress: 5,
      startedAt: new Date(),
      previewAvailable: false,
      retryCount: 0,
      userModified: false,
    });

    this.mainTicketId = mainTicket.id;
    return mainTicket.id;
  }

  /**
   * Process a build event and update tickets accordingly
   */
  processEvent(event: BuildEvent): void {
    if (!this.isActive) return;

    switch (event.type) {
      case 'thinking':
        if (this.mainTicketId) {
          this.callbacks.onProgressUpdate(this.mainTicketId, 10);
          this.callbacks.onTicketUpdate(this.mainTicketId, {
            status: 'generating'
          });
        }
        break;

      case 'file_started':
        if (event.filePath) {
          this.createFileTicket(event.filePath, 'generating');
        }
        break;

      case 'file_completed':
        if (event.filePath) {
          this.updateFileTicket(event.filePath, 'done', event.content);
          this.updateMainProgress();
        }
        break;

      case 'file_failed':
        if (event.filePath) {
          this.updateFileTicket(event.filePath, 'failed', undefined, event.error);
        }
        break;

      case 'applying':
        if (this.mainTicketId) {
          this.callbacks.onTicketStatusChange(this.mainTicketId, 'applying');
          this.callbacks.onProgressUpdate(this.mainTicketId, 90);
        }
        break;

      case 'build_completed':
        if (this.mainTicketId) {
          this.callbacks.onTicketStatusChange(this.mainTicketId, 'done');
          this.callbacks.onProgressUpdate(this.mainTicketId, 100);
          this.callbacks.onTicketUpdate(this.mainTicketId, {
            completedAt: new Date(),
            actualFiles: Array.from(this.fileTickets.keys())
          });
        }
        this.isActive = false;
        break;

      case 'build_failed':
        if (this.mainTicketId) {
          this.callbacks.onTicketStatusChange(this.mainTicketId, 'failed', event.error);
        }
        this.isActive = false;
        break;
    }
  }

  /**
   * Create a ticket for a new file being generated
   */
  private createFileTicket(filePath: string, status: TicketStatus): void {
    if (this.fileTickets.has(filePath)) return;

    const fileName = filePath.split('/').pop() || filePath;
    const fileExt = filePath.split('.').pop() || '';
    
    const ticketType: TicketType = 
      fileExt === 'css' ? 'styling' :
      filePath.includes('layout') ? 'layout' :
      filePath.includes('component') ? 'component' :
      filePath.includes('hook') ? 'feature' :
      filePath.includes('util') ? 'config' :
      'component';

    const ticket = this.callbacks.onTicketCreate({
      title: fileName,
      description: `Generating ${filePath}`,
      type: ticketType,
      status: status,
      priority: 'medium',
      complexity: 'S',
      estimatedFiles: 1,
      actualFiles: [filePath],
      dependencies: this.mainTicketId ? [this.mainTicketId] : [],
      blockedBy: [],
      progress: status === 'generating' ? 50 : 0,
      startedAt: new Date(),
      previewAvailable: false,
      retryCount: 0,
      userModified: false,
    });

    this.fileTickets.set(filePath, ticket.id);
  }

  /**
   * Update an existing file ticket
   */
  private updateFileTicket(
    filePath: string, 
    status: TicketStatus, 
    content?: string,
    error?: string
  ): void {
    // Create ticket if it doesn't exist
    if (!this.fileTickets.has(filePath)) {
      this.createFileTicket(filePath, status);
    }

    const ticketId = this.fileTickets.get(filePath);
    if (!ticketId) return;

    this.callbacks.onTicketStatusChange(ticketId, status, error);
    
    if (status === 'done') {
      this.callbacks.onProgressUpdate(ticketId, 100);
      this.callbacks.onTicketUpdate(ticketId, {
        completedAt: new Date(),
        generatedCode: content,
        previewAvailable: true
      });
    }
  }

  /**
   * Update main ticket progress based on completed files
   */
  private updateMainProgress(): void {
    if (!this.mainTicketId) return;
    
    const totalFiles = this.fileTickets.size;
    if (totalFiles === 0) return;

    // Base progress: 10% for start, 80% for files, 10% for applying
    const fileProgress = Math.min(80, (totalFiles / 5) * 80);
    const progress = 10 + fileProgress;
    
    this.callbacks.onProgressUpdate(this.mainTicketId, Math.round(progress));
  }

  /**
   * Stop tracking
   */
  stopTracking(): void {
    this.isActive = false;
    this.mainTicketId = null;
    this.fileTickets.clear();
  }

  /**
   * Get current tracking state
   */
  getState(): { isActive: boolean; mainTicketId: string | null; fileCount: number } {
    return {
      isActive: this.isActive,
      mainTicketId: this.mainTicketId,
      fileCount: this.fileTickets.size
    };
  }
}

/**
 * Parse streamed code and emit build events
 */
export function parseStreamForEvents(
  previousCode: string,
  newCode: string,
  processedFiles: Set<string>
): BuildEvent[] {
  const events: BuildEvent[] = [];
  
  // Check for completed files
  const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
  let match;
  
  while ((match = fileRegex.exec(newCode)) !== null) {
    const filePath = match[1];
    const fileContent = match[2];
    
    if (!processedFiles.has(filePath)) {
      events.push({
        type: 'file_completed',
        filePath,
        content: fileContent.trim(),
        timestamp: new Date()
      });
      processedFiles.add(filePath);
    }
  }
  
  // Check for file currently being generated
  const lastFileMatch = newCode.match(/<file path="([^"]+)">([^]*?)$/);
  if (lastFileMatch && !lastFileMatch[0].includes('</file>')) {
    const filePath = lastFileMatch[1];
    if (!processedFiles.has(filePath)) {
      events.push({
        type: 'file_started',
        filePath,
        timestamp: new Date()
      });
    }
  }
  
  return events;
}
