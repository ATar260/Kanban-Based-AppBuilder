"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/utils/cn";

interface SuggestionChip {
  label: string;
  prompt: string;
}

const DEFAULT_SUGGESTIONS: SuggestionChip[] = [
  { label: "Add authentication", prompt: "Include user authentication with login, signup, and protected routes" },
  { label: "Dark mode", prompt: "Add a dark mode toggle with system preference detection" },
  { label: "Responsive design", prompt: "Make it fully responsive for mobile, tablet, and desktop" },
  { label: "Animations", prompt: "Add smooth animations and micro-interactions" },
];

interface EnhancedPromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  suggestions?: SuggestionChip[];
  className?: string;
}

export default function EnhancedPromptInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Describe what you want to build...",
  suggestions = DEFAULT_SUGGESTIONS,
  className,
}: EnhancedPromptInputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = React.useState(false);
  const hasValue = Boolean(value.trim());

  // Auto-grow textarea
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(200, Math.max(120, el.scrollHeight))}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (hasValue && !disabled) {
        onSubmit();
      }
    }
  };

  const handleSuggestionClick = (suggestion: SuggestionChip) => {
    const newValue = value.trim()
      ? `${value.trim()}. ${suggestion.prompt}`
      : suggestion.prompt;
    onChange(newValue);
    textareaRef.current?.focus();
  };

  return (
    <div className={cn("relative", className)}>
      {/* Main input container */}
      <div
        className={cn(
          "relative rounded-2xl border-2 bg-white transition-all duration-200",
          isFocused
            ? "border-emerald-500 shadow-[0_0_0_4px_rgb(16_185_129_/_0.1)]"
            : "border-gray-200 hover:border-gray-300",
          disabled && "opacity-60 cursor-not-allowed"
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          placeholder={placeholder}
          rows={3}
          className={cn(
            "w-full resize-none rounded-2xl px-5 py-4 text-base text-gray-900",
            "placeholder:text-gray-400 focus:outline-none",
            "bg-transparent",
            disabled && "cursor-not-allowed"
          )}
        />

        {/* Submit button */}
        <div className="absolute bottom-4 right-4">
          <motion.button
            type="button"
            onClick={onSubmit}
            disabled={disabled || !hasValue}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all",
              hasValue && !disabled
                ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            )}
          >
            <FlameIcon className="w-4 h-4" />
            Build
          </motion.button>
        </div>
      </div>

      {/* Suggestion chips */}
      {!hasValue && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-4 flex flex-wrap gap-2"
        >
          <span className="text-xs text-gray-400 mr-1 self-center">Add:</span>
          {suggestions.map((suggestion, idx) => (
            <motion.button
              key={suggestion.label}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              disabled={disabled}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + idx * 0.05 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full",
                "bg-gray-100 text-gray-600 hover:bg-emerald-500/10 hover:text-emerald-500",
                "border border-transparent hover:border-emerald-500/20",
                "transition-all duration-200",
                disabled && "opacity-50 cursor-not-allowed hover:bg-gray-100 hover:text-gray-600"
              )}
            >
              + {suggestion.label}
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* Keyboard hint */}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
        <span>
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono text-[10px]">Enter</kbd>
          {" "}to submit,{" "}
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono text-[10px]">Shift+Enter</kbd>
          {" "}for new line
        </span>
      </div>
    </div>
  );
}

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2C12 2 8.5 6 8.5 10C8.5 12 9.5 13.5 10.5 14.5C9.5 14 8 13.5 8 11C8 11 6 13 6 16C6 19.314 8.686 22 12 22C15.314 22 18 19.314 18 16C18 12 14 10 14 6C14 6 14 8 12 10C12 8 12 2 12 2Z"
        fill="currentColor"
      />
    </svg>
  );
}
