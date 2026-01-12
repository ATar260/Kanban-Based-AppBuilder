'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { KanbanTicket, BuildPlan, TicketStatus, BuildAnalytics, BuildMode } from '../types';

const STORAGE_KEY = 'kanban_build_plans';

export function useKanbanBoard(initialPlan?: BuildPlan) {
  const [plan, setPlan] = useState<BuildPlan | null>(initialPlan || null);
  const [tickets, setTickets] = useState<KanbanTicket[]>(initialPlan?.tickets || []);
  const [currentTicketId, setCurrentTicketId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [buildMode, setBuildMode] = useState<BuildMode>('auto');
  const [manualQueue, setManualQueue] = useState<string[]>([]);

  // Refs for accessing latest state in async callbacks
  const ticketsRef = useRef(tickets);
  const isPausedRef = useRef(isPaused);
  const manualQueueRef = useRef(manualQueue);
  const reconciledPlanIdRef = useRef<string | null>(null);

  useEffect(() => {
    ticketsRef.current = tickets;
  }, [tickets]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    manualQueueRef.current = manualQueue;
  }, [manualQueue]);

  useEffect(() => {
    if (initialPlan) {
      setPlan(initialPlan);
      setTickets(initialPlan.tickets);
    }
  }, [initialPlan]);

  // Load the most recent plan from localStorage on mount (so refresh doesn't show "No tasks yet"
  // even when plans exist in storage).
  useEffect(() => {
    if (initialPlan) return;
    if (plan) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const storedPlans: BuildPlan[] = stored ? JSON.parse(stored) : [];
      const latest = storedPlans?.[0];
      if (!latest) return;

      setPlan(latest);
      setTickets(latest.tickets || []);
      setCurrentTicketId((latest as any).currentTicketId || null);
      setBuildMode((latest as any).buildMode || 'auto');
    } catch (e) {
      console.warn('[useKanbanBoard] Failed to load latest plan from storage:', e);
    }
  }, [initialPlan, plan]);

  useEffect(() => {
    if (plan) {
      savePlanToStorage(plan);
    }
  }, [plan, tickets]);

  const savePlanToStorage = (planToSave: BuildPlan) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const plans: BuildPlan[] = stored ? JSON.parse(stored) : [];
      const existingIndex = plans.findIndex(p => p.id === planToSave.id);

      const updatedPlan = { ...planToSave, tickets, updatedAt: new Date() };

      if (existingIndex >= 0) {
        plans[existingIndex] = updatedPlan;
      } else {
        plans.unshift(updatedPlan);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(plans.slice(0, 10)));
    } catch (e) {
      console.error('Failed to save plan:', e);
    }
  };

  const reconcileTicketStatuses = useCallback((planId?: string | null) => {
    setTickets(prev => prev.map(t => {
      const hasEvidence =
        Boolean((t as any).generatedCode) ||
        (Array.isArray(t.actualFiles) && t.actualFiles.length > 0) ||
        Boolean((t as any).completedAt) ||
        (typeof t.progress === 'number' && t.progress >= 100);

      if (!hasEvidence) return t;
      if (t.status === 'done') return t;

      // Only auto-promote tickets that are clearly "complete" but still sitting in early states.
      if (t.status === 'backlog' || t.status === 'awaiting_input') {
        const startedAt = (t as any).startedAt ? new Date((t as any).startedAt) : undefined;
        const completedAt = (t as any).completedAt ? new Date((t as any).completedAt) : new Date();
        const duration =
          t.duration != null
            ? t.duration
            : (startedAt ? Date.now() - startedAt.getTime() : undefined);

        return {
          ...t,
          status: 'done',
          progress: 100,
          completedAt,
          duration,
          previewAvailable: true,
        };
      }

      return t;
    }));
  }, []);

  // Best-effort: if a plan is loaded with tickets that already have generated code/files,
  // reconcile their status so Done reflects reality (e.g. after restore/refresh).
  useEffect(() => {
    const planId = plan?.id || null;
    if (!planId) return;
    if (tickets.length === 0) return;
    if (reconciledPlanIdRef.current === planId) return;
    reconciledPlanIdRef.current = planId;
    reconcileTicketStatuses(planId);
  }, [plan?.id, tickets.length, reconcileTicketStatuses]);

  const loadPlansFromStorage = useCallback((): BuildPlan[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.warn('[useKanbanBoard] Failed to load plans from storage:', e);
      return [];
    }
  }, []);

  const updateTicketStatus = useCallback((ticketId: string, status: TicketStatus, error?: string) => {
    setTickets(prev => prev.map(t => {
      if (t.id !== ticketId) return t;

      const updates: Partial<KanbanTicket> = { status };

      if (status === 'generating') {
        updates.startedAt = new Date();
        updates.progress = 0;
      } else if (status === 'done') {
        updates.completedAt = new Date();
        updates.progress = 100;
        if (t.startedAt) {
          updates.duration = Date.now() - new Date(t.startedAt).getTime();
        }
      } else if (status === 'failed') {
        updates.error = error;
        updates.retryCount = (t.retryCount || 0) + 1;
      } else if (status === 'blocked') {
        // Preserve the reason (dependency failure / merge conflict / etc) so users can act on it.
        updates.error = error;
      } else if (status === 'skipped') {
        updates.progress = 0;
      }

      return { ...t, ...updates };
    }));
  }, []);

  const updateTicketProgress = useCallback((ticketId: string, progress: number) => {
    setTickets(prev => prev.map(t =>
      t.id === ticketId ? { ...t, progress } : t
    ));
  }, []);

  const updateTicketFiles = useCallback((ticketId: string, files: string[]) => {
    setTickets(prev => prev.map(t =>
      t.id === ticketId ? { ...t, actualFiles: files, previewAvailable: true } : t
    ));
  }, []);

  const updateTicketCode = useCallback((ticketId: string, code: string) => {
    setTickets(prev => prev.map(t =>
      t.id === ticketId ? { ...t, generatedCode: code } : t
    ));
  }, []);

  const editTicket = useCallback((ticketId: string, updates: Partial<KanbanTicket>) => {
    setTickets(prev => prev.map(t =>
      t.id === ticketId ? { ...t, ...updates, userModified: true } : t
    ));
  }, []);

  const deleteTicket = useCallback((ticketId: string) => {
    setTickets(prev => {
      const updated = prev.filter(t => t.id !== ticketId);
      return updated.map(t => ({
        ...t,
        dependencies: t.dependencies.filter(d => d !== ticketId),
        blockedBy: t.blockedBy.filter(b => b !== ticketId)
      }));
    });
  }, []);

  const addTicket = useCallback((ticket: Omit<KanbanTicket, 'id' | 'order'>) => {
    const newTicket: KanbanTicket = {
      ...ticket,
      id: `ticket-${Date.now()}`,
      order: ticketsRef.current.length,
    };
    setTickets(prev => [...prev, newTicket]);
    return newTicket;
  }, []);

  const reorderTicket = useCallback((ticketId: string, direction: 'up' | 'down') => {
    setTickets(prev => {
      const backlogTickets = prev.filter(t => t.status === 'backlog');
      const otherTickets = prev.filter(t => t.status !== 'backlog');

      const index = backlogTickets.findIndex(t => t.id === ticketId);
      if (index === -1) return prev;

      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= backlogTickets.length) return prev;

      const reordered = [...backlogTickets];
      [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];

      return [...otherTickets, ...reordered.map((t, i) => ({ ...t, order: i }))];
    });
  }, []);

  const moveTicket = useCallback((ticketId: string, newStatus: TicketStatus) => {
    updateTicketStatus(ticketId, newStatus);
  }, [updateTicketStatus]);

  const getNextBuildableTicket = useCallback((): KanbanTicket | null => {
    // Use ref to avoid stale state in async loops
    const currentTickets = ticketsRef.current;

    const backlog = currentTickets
      .filter(t => t.status === 'backlog')
      .sort((a, b) => a.order - b.order);

    for (const ticket of backlog) {
      const hasUnmetDeps = ticket.dependencies.some(depId => {
        const dep = currentTickets.find(t => t.id === depId);
        return dep && dep.status !== 'done';
      });

      if (!hasUnmetDeps) {
        return ticket;
      }
    }

    return null;
  }, []);

  const unblockDependents = useCallback((completedTicketId: string) => {
    setTickets(prev => prev.map(t => {
      if (!t.blockedBy.includes(completedTicketId)) return t;

      const newBlockedBy = t.blockedBy.filter(id => id !== completedTicketId);
      const newStatus = newBlockedBy.length === 0 && t.status === 'blocked' ? 'backlog' : t.status;

      return { ...t, blockedBy: newBlockedBy, status: newStatus };
    }));
  }, []);

  const retryTicket = useCallback((ticketId: string) => {
    updateTicketStatus(ticketId, 'backlog');
  }, [updateTicketStatus]);

  const skipTicket = useCallback((ticketId: string) => {
    updateTicketStatus(ticketId, 'skipped');
    unblockDependents(ticketId);
  }, [updateTicketStatus, unblockDependents]);

  const restoreTicket = useCallback((ticketId: string) => {
    updateTicketStatus(ticketId, 'backlog');
  }, [updateTicketStatus]);

  const submitTicketInput = useCallback((ticketId: string, inputs: Record<string, string>) => {
    setTickets(prev => prev.map(t => {
      if (t.id !== ticketId) return t;
      return {
        ...t,
        userInputs: inputs,
        status: 'backlog' as TicketStatus,
        requiresInput: false,
      };
    }));
  }, []);

  const getAwaitingInputTickets = useCallback(() => {
    return ticketsRef.current.filter(t => t.status === 'awaiting_input');
  }, []);

  const setBuildModeForPlan = useCallback((mode: BuildMode) => {
    setBuildMode(mode);
    if (plan) {
      setPlan({ ...plan, buildMode: mode });
    }
  }, [plan]);

  const queueTicketForManualBuild = useCallback((ticketId: string) => {
    setManualQueue(prev => [...prev, ticketId]);
    setTickets(prev => prev.map(t =>
      t.id === ticketId ? { ...t, manualBuild: true } : t
    ));
  }, []);

  const getNextManualTicket = useCallback((): KanbanTicket | null => {
    const queue = manualQueueRef.current;
    if (queue.length === 0) return null;
    const nextId = queue[0];
    return ticketsRef.current.find(t => t.id === nextId) || null;
  }, []);

  const completeManualTicket = useCallback((ticketId: string) => {
    setManualQueue(prev => prev.filter(id => id !== ticketId));
  }, []);

  const buildSingleTicket = useCallback((ticketId: string) => {
    const ticket = ticketsRef.current.find(t => t.id === ticketId);
    if (!ticket || ticket.status !== 'backlog') return null;

    const hasUnmetDeps = ticket.dependencies.some(depId => {
      const dep = ticketsRef.current.find(t => t.id === depId);
      return dep && dep.status !== 'done';
    });

    if (hasUnmetDeps) {
      return { error: 'Ticket has unmet dependencies' };
    }

    return ticket;
  }, []);

  const getAnalytics = useCallback((): BuildAnalytics => {
    const currentTickets = tickets; // for rendering, use state
    const completed = currentTickets.filter(t => t.status === 'done');
    const totalDuration = completed.reduce((sum, t) => sum + (t.duration || 0), 0);

    return {
      totalTickets: currentTickets.length,
      completed: completed.length,
      failed: currentTickets.filter(t => t.status === 'failed').length,
      skipped: currentTickets.filter(t => t.status === 'skipped').length,
      inProgress: currentTickets.filter(t => ['generating', 'applying', 'pr_review', 'merge_queued', 'merging', 'testing'].includes(t.status)).length,
      blocked: currentTickets.filter(t => t.status === 'blocked').length,
      totalDuration,
      averageTicketTime: completed.length > 0 ? totalDuration / completed.length : 0,
      filesGenerated: currentTickets.reduce((sum, t) => sum + t.actualFiles.length, 0),
    };
  }, [tickets]);

  const getTicketsByColumn = useCallback(() => {
    const columns: Record<TicketStatus, KanbanTicket[]> = {
      planning: [],
      backlog: [],
      awaiting_input: [],
      generating: [],
      applying: [],
      pr_review: [],
      merge_queued: [],
      merging: [],
      testing: [],
      done: [],
      blocked: [],
      failed: [],
      skipped: [],
    };

    tickets.forEach(t => {
      columns[t.status].push(t);
    });

    columns.backlog.sort((a, b) => a.order - b.order);

    return columns;
  }, [tickets]);

  return {
    plan,
    setPlan,
    tickets,
    setTickets,
    currentTicketId,
    setCurrentTicketId,
    isPaused,
    setIsPaused,
    buildMode,
    setBuildMode: setBuildModeForPlan,
    manualQueue,
    updateTicketStatus,
    updateTicketProgress,
    updateTicketFiles,
    updateTicketCode,
    editTicket,
    deleteTicket,
    addTicket,
    reorderTicket,
    moveTicket,
    getNextBuildableTicket,
    unblockDependents,
    retryTicket,
    skipTicket,
    restoreTicket,
    getAnalytics,
    getTicketsByColumn,
    loadPlansFromStorage,
    savePlanToStorage,
    reconcileTicketStatuses,
    submitTicketInput,
    getAwaitingInputTickets,
    queueTicketForManualBuild,
    getNextManualTicket,
    completeManualTicket,
    buildSingleTicket,
  };
}
