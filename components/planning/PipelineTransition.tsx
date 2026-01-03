'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface PipelineTransitionProps {
  ticketCount: number;
  onMoveToPipeline: () => void;
  onEditPlan: () => void;
  isPlanLocked: boolean;
  className?: string;
}

export function PipelineTransition({
  ticketCount,
  onMoveToPipeline,
  onEditPlan,
  isPlanLocked,
  className = '',
}: PipelineTransitionProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleClick = () => {
    if (isPlanLocked) {
      onEditPlan();
    } else if (!isConfirming) {
      setIsConfirming(true);
    } else {
      onMoveToPipeline();
      setIsConfirming(false);
    }
  };

  if (ticketCount === 0) return null;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {isPlanLocked ? (
        <motion.button
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={handleClick}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors border border-zinc-700"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Unlock & Edit Plan
        </motion.button>
      ) : isConfirming ? (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2"
        >
          <span className="text-sm text-zinc-400">Lock plan and start build?</span>
          <button
            onClick={() => setIsConfirming(false)}
            className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleClick}
            className="px-4 py-1.5 text-sm font-medium bg-gradient-to-r from-amber-500 to-orange-500 text-black rounded-lg hover:from-amber-400 hover:to-orange-400 transition-all"
          >
            Confirm
          </button>
        </motion.div>
      ) : (
        <motion.button
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={handleClick}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-medium rounded-lg hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Move to Pipeline
          <span className="px-1.5 py-0.5 bg-black/20 rounded text-xs">
            {ticketCount} tasks
          </span>
        </motion.button>
      )}
    </div>
  );
}
