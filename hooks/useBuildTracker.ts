'use client';

import { useRef, useCallback } from 'react';
import { BuildTrackerAgent, BuildEvent, parseStreamForEvents } from '@/lib/agents/build-tracker-agent';
import { KanbanTicket, TicketStatus } from '@/components/kanban/types';

interface UseBuildTrackerProps {
  onTicketCreate: (ticket: Omit<KanbanTicket, 'id' | 'order'>) => KanbanTicket;
  onTicketUpdate: (ticketId: string, updates: Partial<KanbanTicket>) => void;
  onTicketStatusChange: (ticketId: string, status: TicketStatus, error?: string) => void;
  onProgressUpdate: (ticketId: string, progress: number) => void;
}

export function useBuildTracker({
  onTicketCreate,
  onTicketUpdate,
  onTicketStatusChange,
  onProgressUpdate
}: UseBuildTrackerProps) {
  const agentRef = useRef<BuildTrackerAgent | null>(null);
  const processedFilesRef = useRef<Set<string>>(new Set());
  const previousCodeRef = useRef<string>('');
  
  const callbacksRef = useRef({
    onTicketCreate,
    onTicketUpdate,
    onTicketStatusChange,
    onProgressUpdate
  });
  
  callbacksRef.current = {
    onTicketCreate,
    onTicketUpdate,
    onTicketStatusChange,
    onProgressUpdate
  };

  const getOrCreateAgent = useCallback(() => {
    if (!agentRef.current) {
      agentRef.current = new BuildTrackerAgent({
        onTicketCreate: (...args) => callbacksRef.current.onTicketCreate(...args),
        onTicketUpdate: (...args) => callbacksRef.current.onTicketUpdate(...args),
        onTicketStatusChange: (...args) => callbacksRef.current.onTicketStatusChange(...args),
        onProgressUpdate: (...args) => callbacksRef.current.onProgressUpdate(...args)
      });
    }
    return agentRef.current;
  }, []);

  /**
   * Start tracking a new build
   */
  const startBuild = useCallback((description: string) => {
    agentRef.current = null;
    processedFilesRef.current.clear();
    previousCodeRef.current = '';
    return getOrCreateAgent().startTracking(description);
  }, [getOrCreateAgent]);

  /**
   * Process streamed code and update tickets
   */
  const processStreamedCode = useCallback((newCode: string) => {
    const events = parseStreamForEvents(
      previousCodeRef.current,
      newCode,
      processedFilesRef.current
    );

    const agent = getOrCreateAgent();
    events.forEach(event => agent.processEvent(event));

    previousCodeRef.current = newCode;
  }, [getOrCreateAgent]);

  /**
   * Emit a build event directly
   */
  const emitEvent = useCallback((event: BuildEvent) => {
    getOrCreateAgent().processEvent(event);
  }, [getOrCreateAgent]);

  /**
   * Mark build as applying code
   */
  const markApplying = useCallback(() => {
    getOrCreateAgent().processEvent({
      type: 'applying',
      timestamp: new Date()
    });
  }, [getOrCreateAgent]);

  /**
   * Mark build as completed
   */
  const markCompleted = useCallback(() => {
    getOrCreateAgent().processEvent({
      type: 'build_completed',
      timestamp: new Date()
    });
  }, [getOrCreateAgent]);

  /**
   * Mark build as failed
   */
  const markFailed = useCallback((error: string) => {
    getOrCreateAgent().processEvent({
      type: 'build_failed',
      error,
      timestamp: new Date()
    });
  }, [getOrCreateAgent]);

  /**
   * Mark thinking/planning phase
   */
  const markThinking = useCallback(() => {
    getOrCreateAgent().processEvent({
      type: 'thinking',
      timestamp: new Date()
    });
  }, [getOrCreateAgent]);

  /**
   * Stop tracking and reset
   */
  const stopTracking = useCallback(() => {
    getOrCreateAgent().stopTracking();
    processedFilesRef.current.clear();
    previousCodeRef.current = '';
  }, [getOrCreateAgent]);

  /**
   * Get current tracking state
   */
  const getState = useCallback(() => {
    return getOrCreateAgent().getState();
  }, [getOrCreateAgent]);

  return {
    startBuild,
    processStreamedCode,
    emitEvent,
    markApplying,
    markCompleted,
    markFailed,
    markThinking,
    stopTracking,
    getState
  };
}
