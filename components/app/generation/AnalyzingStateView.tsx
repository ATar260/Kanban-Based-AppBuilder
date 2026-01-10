"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/utils/cn";
import type { KanbanTicket } from "@/components/kanban/types";

interface AnalyzingStateViewProps {
  prompt?: string;
  tickets: KanbanTicket[];
  isPlanning: boolean;
  loadingStage?: "gathering" | "planning" | "generating" | null;
  className?: string;
}

const STAGES = [
  { id: "gathering", label: "Gathering context", icon: "🔍" },
  { id: "planning", label: "Creating build plan", icon: "📋" },
  { id: "generating", label: "Setting up tasks", icon: "⚡" },
];

export default function AnalyzingStateView({
  prompt,
  tickets,
  isPlanning,
  loadingStage,
  className,
}: AnalyzingStateViewProps) {
  const [visibleTickets, setVisibleTickets] = React.useState<KanbanTicket[]>([]);

  // Progressively reveal tickets
  React.useEffect(() => {
    if (tickets.length === 0) {
      setVisibleTickets([]);
      return;
    }

    const timeouts: NodeJS.Timeout[] = [];
    tickets.forEach((ticket, idx) => {
      const timeout = setTimeout(() => {
        setVisibleTickets((prev) => {
          if (prev.find((t) => t.id === ticket.id)) return prev;
          return [...prev, ticket];
        });
      }, idx * 200);
      timeouts.push(timeout);
    });

    return () => timeouts.forEach(clearTimeout);
  }, [tickets]);

  return (
    <div
      className={cn(
        "min-h-screen flex flex-col items-center justify-center px-6 py-12",
        "bg-gradient-to-b from-white via-[#fbfbfb] to-[#f5f5f5]",
        className
      )}
    >
      {/* Animated flame background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(250,93,25,0.15) 0%, transparent 70%)",
          }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-2xl mx-auto flex flex-col items-center">
        {/* Animated flame icon */}
        <motion.div
          className="relative mb-8"
          animate={{
            y: [0, -8, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <motion.div
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#fa5d19] to-[#ff7a3d] flex items-center justify-center"
            animate={{
              boxShadow: [
                "0 0 30px 10px rgba(250, 93, 25, 0.2)",
                "0 0 50px 20px rgba(250, 93, 25, 0.4)",
                "0 0 30px 10px rgba(250, 93, 25, 0.2)",
              ],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <FlameIcon className="w-10 h-10 text-white" />
            </motion.div>
          </motion.div>

          {/* Particle effects */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-[#fa5d19]"
              style={{
                left: "50%",
                top: "50%",
              }}
              animate={{
                x: [0, Math.cos((i * Math.PI) / 3) * 50],
                y: [0, Math.sin((i * Math.PI) / 3) * 50 - 30],
                opacity: [1, 0],
                scale: [1, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeOut",
              }}
            />
          ))}
        </motion.div>

        {/* Status text */}
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-2xl font-bold text-gray-900 mb-2 text-center"
        >
          {isPlanning ? "Analyzing your request..." : "Setting up your project..."}
        </motion.h2>

        {/* User prompt display */}
        {prompt && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-gray-500 text-center mb-8 max-w-lg line-clamp-2"
          >
            "{prompt}"
          </motion.p>
        )}

        {/* Progress stages */}
        <div className="flex items-center gap-2 mb-10">
          {STAGES.map((stage, idx) => {
            const isActive = loadingStage === stage.id;
            const isPast =
              loadingStage === "planning"
                ? idx === 0
                : loadingStage === "generating"
                  ? idx <= 1
                  : false;

            return (
              <React.Fragment key={stage.id}>
                <motion.div
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                    isActive
                      ? "bg-[#fa5d19]/10 text-[#fa5d19] border border-[#fa5d19]/20"
                      : isPast
                        ? "bg-green-50 text-green-600 border border-green-200"
                        : "bg-gray-100 text-gray-400 border border-transparent"
                  )}
                  animate={isActive ? { scale: [1, 1.02, 1] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  {isPast ? (
                    <CheckIcon className="w-4 h-4" />
                  ) : isActive ? (
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      {stage.icon}
                    </motion.span>
                  ) : (
                    <span className="opacity-50">{stage.icon}</span>
                  )}
                  <span>{stage.label}</span>
                </motion.div>
                {idx < STAGES.length - 1 && (
                  <div
                    className={cn(
                      "w-8 h-0.5 rounded-full transition-colors",
                      isPast ? "bg-green-300" : "bg-gray-200"
                    )}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Discovered tasks */}
        <AnimatePresence mode="popLayout">
          {visibleTickets.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full"
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="text-sm font-medium text-gray-600">
                  Identified {visibleTickets.length} task{visibleTickets.length !== 1 ? "s" : ""}
                </span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {visibleTickets.map((ticket, idx) => (
                  <TaskCard key={ticket.id} ticket={ticket} index={idx} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface TaskCardProps {
  ticket: KanbanTicket;
  index: number;
}

function TaskCard({ ticket, index }: TaskCardProps) {
  const typeColors: Record<string, string> = {
    component: "#3B82F6",
    feature: "#8B5CF6",
    layout: "#10B981",
    styling: "#F59E0B",
    integration: "#EF4444",
    config: "#6B7280",
    database: "#06B6D4",
  };

  const color = typeColors[ticket.type] || "#6B7280";

  return (
    <motion.div
      initial={{ opacity: 0, x: -20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
          style={{ background: color }}
        >
          {ticket.type.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 text-sm line-clamp-1">{ticket.title}</h4>
          <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{ticket.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <span
              className="px-2 py-0.5 text-[10px] font-medium rounded-full"
              style={{ background: `${color}15`, color }}
            >
              {ticket.type}
            </span>
            {ticket.complexity && (
              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-600">
                {ticket.complexity}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 2C12 2 8.5 6 8.5 10C8.5 12 9.5 13.5 10.5 14.5C9.5 14 8 13.5 8 11C8 11 6 13 6 16C6 19.314 8.686 22 12 22C15.314 22 18 19.314 18 16C18 12 14 10 14 6C14 6 14 8 12 10C12 8 12 2 12 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={className}>
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
