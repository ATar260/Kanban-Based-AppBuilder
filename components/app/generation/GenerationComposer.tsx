/* eslint-disable react/no-unescaped-entities */
"use client";

import * as React from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/shadcn/popover";
import Button from "@/components/ui/shadcn/button";
import { cn } from "@/utils/cn";

export type GenerationComposerMode = "build" | "clone" | "edit";

export interface BuildTemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;
  icon: string;
}

export const DEFAULT_BUILD_TEMPLATES: BuildTemplate[] = [
  {
    id: "landing",
    name: "Landing Page",
    description: "Hero, features, testimonials, pricing, footer",
    prompt:
      "Create a modern SaaS landing page with a hero section featuring a headline, subheadline, and CTA button. Include a features grid with icons, a testimonials section, pricing cards, and a footer with links.",
    icon: "🚀",
  },
  {
    id: "dashboard",
    name: "Dashboard",
    description: "Sidebar nav, KPIs, charts, tables",
    prompt:
      "Build an admin dashboard with a sidebar navigation, top header with user profile, stats cards showing KPIs, a line chart for trends, a bar chart for comparisons, and a data table with pagination.",
    icon: "📊",
  },
  {
    id: "ecommerce",
    name: "E-commerce",
    description: "Product grid, filters, cart, checkout",
    prompt:
      "Create an e-commerce product page with a product grid, filters sidebar, product cards with images and prices, a shopping cart drawer, and a checkout form with payment fields.",
    icon: "🛒",
  },
  {
    id: "blog",
    name: "Blog",
    description: "Posts, categories, newsletter, post page",
    prompt:
      "Build a blog homepage with featured post hero, post grid with thumbnails and excerpts, category sidebar, newsletter signup, and a single post view with author info and comments section.",
    icon: "📝",
  },
  {
    id: "portfolio",
    name: "Portfolio",
    description: "Projects, timeline, skills, contact",
    prompt:
      "Create a personal portfolio site with an about section, skills list with progress bars, project gallery with modal previews, work experience timeline, and contact form.",
    icon: "💼",
  },
  {
    id: "pricing",
    name: "Pricing Page",
    description: "Tiers, toggle, comparison, FAQ",
    prompt:
      "Build a pricing page with 3 pricing tiers (Basic, Pro, Enterprise), monthly/yearly toggle, feature comparison table, FAQ accordion, and a CTA section.",
    icon: "💰",
  },
];

interface GenerationComposerProps {
  mode: GenerationComposerMode;
  onModeChange: (mode: GenerationComposerMode) => void;

  buildValue: string;
  cloneValue: string;
  editValue: string;
  onValueChange: (mode: GenerationComposerMode, value: string) => void;

  onSubmit: (mode: GenerationComposerMode) => void;
  disabled?: boolean;

  templates?: BuildTemplate[];
  onSelectTemplate?: (template: BuildTemplate) => void;

  rightActions?: React.ReactNode;
  hint?: string;
}

function getPlaceholder(mode: GenerationComposerMode): string {
  switch (mode) {
    case "build":
      return "Describe the app you want to build…";
    case "clone":
      return "Paste a URL to clone… (e.g., https://example.com)";
    case "edit":
      return "Describe the change you want… (e.g., add a dark mode toggle)";
  }
}

function getPrimaryCta(mode: GenerationComposerMode): string {
  switch (mode) {
    case "build":
      return "Create plan";
    case "clone":
      return "Create plan";
    case "edit":
      return "Apply change";
  }
}

export default function GenerationComposer({
  mode,
  onModeChange,
  buildValue,
  cloneValue,
  editValue,
  onValueChange,
  onSubmit,
  disabled = false,
  templates = DEFAULT_BUILD_TEMPLATES,
  onSelectTemplate,
  rightActions,
  hint,
}: GenerationComposerProps) {
  const [templatesOpen, setTemplatesOpen] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const value = mode === "build" ? buildValue : mode === "clone" ? cloneValue : editValue;
  const hasValue = Boolean(value.trim());

  const handleSubmit = React.useCallback(() => {
    if (disabled) return;
    if (!hasValue) return;
    onSubmit(mode);
  }, [disabled, hasValue, mode, onSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const isCmdK = (e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K");
    if (isCmdK && mode === "build") {
      e.preventDefault();
      setTemplatesOpen(true);
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      onValueChange(mode, "");
      return;
    }

    if (e.key === "Enter") {
      if (mode === "clone") {
        e.preventDefault();
        handleSubmit();
        return;
      }

      // build/edit are multi-line: Enter submits, Shift+Enter newline
      if (!e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    }
  };

  // Auto-grow textareas for build/edit
  React.useEffect(() => {
    if (mode === "clone") return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(220, el.scrollHeight)}px`;
  }, [mode, value]);

  return (
    <div className="w-full rounded-xl border border-border bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center rounded-lg bg-black-alpha-4 p-1">
          {(
            [
              { id: "build" as const, label: "Build" },
              { id: "clone" as const, label: "Clone" },
              { id: "edit" as const, label: "Edit" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onModeChange(opt.id)}
              disabled={disabled}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                opt.id === mode
                  ? "bg-white text-gray-900 shadow-sm"
                  : "bg-transparent text-gray-600 hover:text-gray-900 hover:bg-black-alpha-4",
                disabled && "opacity-60 cursor-not-allowed hover:bg-transparent",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {mode === "build" && templates.length > 0 && (
            <Popover open={templatesOpen} onOpenChange={setTemplatesOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
                  disabled={disabled}
                  title="Templates (Ctrl/Cmd+K)"
                >
                  Templates
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[380px] p-0">
                <div className="p-3 border-b border-gray-200">
                  <div className="text-xs font-semibold text-gray-900">Quick start templates</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Pick one to populate the prompt. You can edit it before submitting.
                  </div>
                </div>
                <div className="max-h-[320px] overflow-y-auto">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                      onClick={() => {
                        if (disabled) return;
                        onModeChange("build");
                        if (onSelectTemplate) {
                          onSelectTemplate(t);
                        } else {
                          onValueChange("build", t.prompt);
                        }
                        setTemplatesOpen(false);
                        // keep focus in the composer
                        setTimeout(() => textareaRef.current?.focus(), 0);
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <div className="text-base leading-none mt-0.5">{t.icon}</div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-gray-900">{t.name}</div>
                          <div className="text-[11px] text-gray-500 truncate">{t.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {rightActions}
        </div>
      </div>

      <div className="mt-3">
        {mode === "clone" ? (
          <input
            type="url"
            value={cloneValue}
            onChange={(e) => onValueChange("clone", e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={getPlaceholder(mode)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        ) : (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onValueChange(mode, e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={getPlaceholder(mode)}
            rows={2}
            className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
          />
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="text-[11px] text-gray-500">
          {hint ?? (
            <>
              <span className="font-medium text-gray-600">Enter</span> submits
              {mode === "clone" ? (
                <>
                  , <span className="font-medium text-gray-600">Esc</span> clears.
                </>
              ) : mode === "build" ? (
                <>
                  , <span className="font-medium text-gray-600">Shift+Enter</span> adds a line,{" "}
                  <span className="font-medium text-gray-600">Esc</span> clears,{" "}
                  <span className="font-medium text-gray-600">Ctrl/Cmd+K</span> templates.
                </>
              ) : (
                <>
                  , <span className="font-medium text-gray-600">Shift+Enter</span> adds a line,{" "}
                  <span className="font-medium text-gray-600">Esc</span> clears.
                </>
              )}
            </>
          )}
        </div>

        <Button
          variant="primary"
          size="default"
          disabled={disabled || !hasValue}
          onClick={handleSubmit}
          className="min-w-[120px]"
        >
          {getPrimaryCta(mode)}
        </Button>
      </div>
    </div>
  );
}


