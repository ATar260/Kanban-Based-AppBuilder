"use client";

import * as React from "react";
import { motion } from "framer-motion";
import EnhancedPromptInput from "./EnhancedPromptInput";
import TemplateGrid, { Template, TEMPLATES } from "./TemplateGrid";
import { cn } from "@/utils/cn";

interface IdleStateHeroProps {
  onSubmitPrompt: (prompt: string) => void;
  onSubmitUrl: (url: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function IdleStateHero({
  onSubmitPrompt,
  onSubmitUrl,
  disabled = false,
  className,
}: IdleStateHeroProps) {
  const [mode, setMode] = React.useState<"build" | "clone">("build");
  const [buildPrompt, setBuildPrompt] = React.useState("");
  const [cloneUrl, setCloneUrl] = React.useState("");

  const handleSubmit = () => {
    if (mode === "build" && buildPrompt.trim()) {
      onSubmitPrompt(buildPrompt.trim());
    } else if (mode === "clone" && cloneUrl.trim()) {
      onSubmitUrl(cloneUrl.trim());
    }
  };

  const handleTemplateSelect = (template: Template) => {
    setBuildPrompt(template.prompt);
    setMode("build");
  };

  return (
    <div
      className={cn(
        "min-h-screen flex flex-col items-center px-6 py-12 lg:py-16",
        "bg-gradient-to-b from-white via-[#fbfbfb] to-[#f5f5f5]",
        className
      )}
    >
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-20 left-[10%] w-72 h-72 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, #fa5d19 0%, transparent 70%)" }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.3, 0.2],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-40 right-[15%] w-96 h-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #ff7a3d 0%, transparent 70%)" }}
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.15, 0.25, 0.15],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col items-center">
        {/* Brand mark */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="relative">
            <motion.div
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#fa5d19] to-[#ff7a3d] flex items-center justify-center shadow-lg shadow-[#fa5d19]/30"
              animate={{
                boxShadow: [
                  "0 10px 30px -10px rgba(250, 93, 25, 0.3)",
                  "0 15px 40px -10px rgba(250, 93, 25, 0.5)",
                  "0 10px 30px -10px rgba(250, 93, 25, 0.3)",
                ],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <FlameIcon className="w-8 h-8 text-white" />
            </motion.div>
          </div>
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-4xl lg:text-5xl font-bold text-center text-gray-900 mb-4"
        >
          What do you want to build?
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-lg text-gray-500 text-center mb-8 max-w-xl"
        >
          Describe your idea in plain English, or clone an existing website
        </motion.p>

        {/* Mode toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mb-6"
        >
          <div className="inline-flex items-center rounded-full bg-gray-100 p-1">
            {(["build", "clone"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                disabled={disabled}
                className={cn(
                  "px-6 py-2 text-sm font-medium rounded-full transition-all duration-200",
                  m === mode
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {m === "build" ? "Build from scratch" : "Clone a website"}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Input area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="w-full max-w-2xl mb-16"
        >
          {mode === "build" ? (
            <EnhancedPromptInput
              value={buildPrompt}
              onChange={setBuildPrompt}
              onSubmit={handleSubmit}
              disabled={disabled}
              placeholder="Describe what you want to build..."
            />
          ) : (
            <CloneUrlInput
              value={cloneUrl}
              onChange={setCloneUrl}
              onSubmit={handleSubmit}
              disabled={disabled}
            />
          )}
        </motion.div>

        {/* Templates section (only show in build mode) */}
        {mode === "build" && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="w-full"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
              <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                Or start from a template
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            </div>

            <TemplateGrid
              templates={TEMPLATES}
              onSelectTemplate={handleTemplateSelect}
              disabled={disabled}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}

interface CloneUrlInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

function CloneUrlInput({ value, onChange, onSubmit, disabled }: CloneUrlInputProps) {
  const [isFocused, setIsFocused] = React.useState(false);
  const hasValue = Boolean(value.trim());

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && hasValue && !disabled) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="relative">
      <div
        className={cn(
          "relative flex items-center rounded-2xl border-2 bg-white transition-all duration-200",
          isFocused
            ? "border-[#fa5d19] shadow-[0_0_0_4px_rgba(250,93,25,0.1)]"
            : "border-gray-200 hover:border-gray-300",
          disabled && "opacity-60 cursor-not-allowed"
        )}
      >
        <div className="pl-5 pr-2 text-gray-400">
          <GlobeIcon className="w-5 h-5" />
        </div>
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          placeholder="https://example.com"
          className={cn(
            "flex-1 py-4 pr-4 text-base text-gray-900",
            "placeholder:text-gray-400 focus:outline-none",
            "bg-transparent",
            disabled && "cursor-not-allowed"
          )}
        />
        <div className="pr-4">
          <motion.button
            type="button"
            onClick={onSubmit}
            disabled={disabled || !hasValue}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all",
              hasValue && !disabled
                ? "bg-gradient-to-r from-[#fa5d19] to-[#ff7a3d] text-white shadow-lg shadow-[#fa5d19]/25 hover:shadow-xl hover:shadow-[#fa5d19]/30"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            )}
          >
            <CopyIcon className="w-4 h-4" />
            Clone
          </motion.button>
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-400 text-center">
        We'll analyze the website and recreate it for you
      </p>
    </div>
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

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
