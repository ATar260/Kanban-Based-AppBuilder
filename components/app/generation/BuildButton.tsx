'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Play, FastForward, Pause, Square, Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

type BuildState = 'start' | 'continue' | 'building' | 'paused';

interface BuildButtonProps {
  /** Number of total tickets */
  ticketCount: number;
  /** Number of completed tickets */
  completedCount: number;
  /** Whether the build is currently active */
  isBuilding: boolean;
  /** Whether the build is paused */
  isPaused?: boolean;
  /** Called when user clicks Start or Continue */
  onStart: () => void;
  /** Called when user clicks Pause */
  onPause?: () => void;
  /** Called when user clicks Stop */
  onStop?: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Additional class name */
  className?: string;
}

function getBuildState(props: BuildButtonProps): BuildState {
  const { isBuilding, isPaused, completedCount } = props;

  if (isBuilding && isPaused) return 'paused';
  if (isBuilding) return 'building';
  if (completedCount > 0) return 'continue';
  return 'start';
}

const STATE_CONFIG = {
  start: {
    label: 'Start Build',
    icon: Play,
    bgClass: 'bg-gradient-to-r from-comfort-sage-600 to-comfort-sage-700',
    shadowClass: 'shadow-lg shadow-comfort-sage-500/25',
    hoverClass: 'hover:from-comfort-sage-700 hover:to-comfort-sage-800 hover:shadow-comfort-sage-500/35',
  },
  continue: {
    label: 'Continue',
    icon: FastForward,
    bgClass: 'bg-gradient-to-r from-comfort-sage-600 to-comfort-sage-700',
    shadowClass: 'shadow-lg shadow-comfort-sage-500/25',
    hoverClass: 'hover:from-comfort-sage-700 hover:to-comfort-sage-800 hover:shadow-comfort-sage-500/35',
  },
  building: {
    label: 'Building',
    icon: Loader2,
    bgClass: 'bg-gradient-to-r from-comfort-sage-600 to-comfort-sage-700',
    shadowClass: 'shadow-lg shadow-comfort-sage-500/25',
    hoverClass: '',
  },
  paused: {
    label: 'Resume',
    icon: Play,
    bgClass: 'bg-gradient-to-r from-comfort-sage-600 to-comfort-sage-700',
    shadowClass: 'shadow-lg shadow-comfort-sage-500/25',
    hoverClass: 'hover:from-comfort-sage-700 hover:to-comfort-sage-800 hover:shadow-comfort-sage-500/35',
  },
};

export function BuildButton({
  ticketCount,
  completedCount,
  isBuilding,
  isPaused = false,
  onStart,
  onPause,
  onStop,
  disabled,
  className,
}: BuildButtonProps) {
  const state = getBuildState({ ticketCount, completedCount, isBuilding, isPaused, onStart, disabled });
  const config = STATE_CONFIG[state];
  const Icon = config.icon;
  const progress = ticketCount > 0 ? (completedCount / ticketCount) * 100 : 0;

  const handleMainClick = () => {
    if (state === 'building') {
      return;
    }
    onStart();
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Main Build Button */}
      <motion.button
        whileHover={state !== 'building' && !disabled ? { scale: 1.02 } : {}}
        whileTap={state !== 'building' && !disabled ? { scale: 0.98 } : {}}
        onClick={handleMainClick}
        disabled={disabled || state === 'building'}
        className={cn(
          // Sweet spot between h-10/px-3 and h-11/px-3.5
          "relative group flex items-center justify-start gap-[5px] h-[39px] px-[10px] rounded-lg overflow-hidden",
          "font-semibold text-sm text-white",
          "transition-all duration-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-comfort-sage-400/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
          config.shadowClass,
          config.hoverClass,
          config.bgClass,
          disabled && "opacity-50 cursor-not-allowed",
          state === 'building' && "cursor-default"
        )}
      >
        {/* Progress indicator (subtle) */}
        {state === 'continue' && ticketCount > 0 && (
          <div className="absolute left-0 right-0 bottom-0 h-1.5 bg-white/15">
            <motion.div
              className="h-full bg-white/35"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        )}

        {/* Building glow animation */}
        {state === 'building' && (
          <motion.div
            className="absolute inset-0 rounded-lg"
            animate={{
              boxShadow: [
                '0 0 18px rgba(127, 181, 137, 0.25)',
                '0 0 34px rgba(127, 181, 137, 0.4)',
                '0 0 18px rgba(127, 181, 137, 0.25)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {/* Button content - always on top */}
        <Icon className={cn(
          "relative z-10 w-[25px] h-[25px] transition-opacity duration-200 ease-out group-hover:opacity-0",
          state === 'building' && "animate-spin"
        )} />
        <span className={cn(
          "relative z-10 max-w-[140px] truncate",
          "transition-opacity duration-200 ease-out group-hover:opacity-0"
        )}>
          {config.label}
        </span>

        {/* Hover takeover icon (centers + enlarges; button width stays stable) */}
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 translate-x-0",
            // Start where the icon normally sits (left padded), then glide to center.
            "left-[10px] group-hover:left-1/2 group-hover:-translate-x-1/2",
            // Start same size as default icon (no shrink), then grow.
            "opacity-0 scale-100 transition-all duration-200 ease-out",
            "group-hover:opacity-100 group-hover:scale-[1.4]"
          )}
        >
          <Icon className={cn("w-[25px] h-[25px]", state === 'building' && "animate-spin")} />
        </span>
      </motion.button>

      {/* Pause Button - appears when building */}
      <AnimatePresence>
        {state === 'building' && onPause && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: -10 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onPause}
            className={cn(
              "flex items-center justify-center w-11 h-11 rounded-lg border border-gray-200",
              "bg-gray-50 text-gray-700",
              "hover:bg-gray-100 hover:text-gray-900",
              "transition-colors duration-150",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-comfort-sage-400/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            )}
            title="Pause build"
          >
            <Pause className="w-7 h-7" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Stop Button - appears when building or paused */}
      <AnimatePresence>
        {(state === 'building' || state === 'paused') && onStop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: -10 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onStop}
            className={cn(
              "flex items-center justify-center w-11 h-11 rounded-lg border border-red-200",
              "bg-red-50 text-red-700",
              "hover:bg-red-100",
              "transition-colors duration-150",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            )}
            title="Stop build"
          >
            <Square className="w-7 h-7" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
