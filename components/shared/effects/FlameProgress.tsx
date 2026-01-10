"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/utils/cn";

interface FlameProgressProps {
  progress: number; // 0-100
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function FlameProgress({
  progress,
  showLabel = true,
  size = "md",
  className,
}: FlameProgressProps) {
  const clampedProgress = Math.max(0, Math.min(100, progress));

  const heights = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  };

  // Color shifts from cool to hot as progress increases
  const getGradient = () => {
    if (clampedProgress < 33) {
      return "from-amber-400 via-orange-400 to-orange-500";
    } else if (clampedProgress < 66) {
      return "from-orange-400 via-orange-500 to-red-500";
    } else {
      return "from-orange-500 via-red-500 to-red-600";
    }
  };

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-gray-600">
            Build Progress
          </span>
          <span className="text-xs font-semibold text-gray-900">
            {Math.round(clampedProgress)}%
          </span>
        </div>
      )}

      <div className={cn("relative w-full bg-gray-200 rounded-full overflow-hidden", heights[size])}>
        {/* Base progress bar */}
        <motion.div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full bg-gradient-to-r",
            getGradient()
          )}
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />

        {/* Animated glow effect at the leading edge */}
        {clampedProgress > 0 && clampedProgress < 100 && (
          <motion.div
            className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-white/40 to-transparent"
            animate={{
              left: [`${Math.max(0, clampedProgress - 10)}%`, `${clampedProgress}%`],
              opacity: [0.5, 0],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}

        {/* Flame particles at the leading edge */}
        {clampedProgress > 5 && clampedProgress < 100 && (
          <div
            className="absolute top-1/2 -translate-y-1/2"
            style={{ left: `${clampedProgress}%` }}
          >
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-orange-400"
                style={{
                  left: -4,
                }}
                animate={{
                  y: [-2, -8 - i * 3],
                  x: [0, (i - 1) * 4],
                  opacity: [1, 0],
                  scale: [1, 0.5],
                }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: "easeOut",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Completion celebration */}
      {clampedProgress === 100 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-2 flex items-center gap-1.5 text-xs font-medium text-green-600"
        >
          <CheckIcon className="w-3.5 h-3.5" />
          Build complete!
        </motion.div>
      )}
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={className}>
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
