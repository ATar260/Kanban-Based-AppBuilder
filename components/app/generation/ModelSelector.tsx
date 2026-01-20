'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, Sparkles, Zap, Cpu, Brain } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/shadcn/dropdown-menu';
import { cn } from '@/utils/cn';

interface Model {
  id: string;
  name: string;
  description: string;
  tier: 'flagship' | 'premium' | 'fast' | 'economy' | 'smart' | 'reasoning';
}

const MODELS: Model[] = [
  { id: 'openai/gpt-5.2', name: 'GPT-5.2', description: 'Best for coding', tier: 'premium' },
  { id: 'openai/gpt-5.2-pro', name: 'GPT-5.2 Pro', description: 'Highest quality', tier: 'flagship' },
  { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', description: 'Fast', tier: 'fast' },
  { id: 'openai/gpt-5-nano', name: 'GPT-5 Nano', description: 'Fastest', tier: 'economy' },
  { id: 'openai/gpt-4.1', name: 'GPT-4.1', description: 'Smart non-reasoning', tier: 'smart' },
  { id: 'openai/o4-mini', name: 'o4-mini', description: 'Reasoning', tier: 'reasoning' },
];

const TIER_ICONS: Record<Model['tier'], React.ReactNode> = {
  flagship: <Sparkles className="w-4 h-4 text-amber-500" />,
  premium: <Sparkles className="w-4 h-4 text-orange-500" />,
  fast: <Zap className="w-4 h-4 text-blue-500" />,
  economy: <Zap className="w-4 h-4 text-green-500" />,
  smart: <Cpu className="w-4 h-4 text-purple-500" />,
  reasoning: <Brain className="w-4 h-4 text-pink-500" />,
};

const TIER_BADGES: Record<Model['tier'], { label: string; className: string }> = {
  flagship: { label: 'Flagship', className: 'bg-amber-100 text-amber-700' },
  premium: { label: 'Premium', className: 'bg-orange-100 text-orange-700' },
  fast: { label: 'Fast', className: 'bg-blue-100 text-blue-700' },
  economy: { label: 'Economy', className: 'bg-green-100 text-green-700' },
  smart: { label: 'Smart', className: 'bg-purple-100 text-purple-700' },
  reasoning: { label: 'Reasoning', className: 'bg-pink-100 text-pink-700' },
};

// OpenAI logo SVG component
function OpenAILogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  );
}

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
  className?: string;
}

export function ModelSelector({ value, onChange, disabled, className }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedModel = MODELS.find(m => m.id === value) || MODELS[0];

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className={cn(
            "group relative flex items-center gap-2 h-[34px] px-[7px] sm:px-[10px] rounded-lg overflow-hidden",
            "bg-gray-50 border border-gray-200",
            "text-sm font-medium text-gray-700",
            "transition-colors duration-150",
            "hover:bg-comfort-sage-50 hover:border-comfort-sage-200 hover:text-gray-900",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-comfort-sage-400/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
        >
          <OpenAILogo className="w-[24px] h-[24px] text-gray-700 transition-opacity duration-200 ease-out group-hover:opacity-0" />
          <span className="max-w-[120px] truncate transition-opacity duration-200 ease-out group-hover:opacity-0">
            {selectedModel.name}
          </span>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="transition-opacity duration-200 ease-out group-hover:opacity-0"
          >
            <ChevronDown className="w-[24px] h-[24px] text-gray-500" />
          </motion.div>

          {/* Hover takeover: icon glides to center + grows */}
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute top-1/2 -translate-y-1/2 translate-x-0",
              "left-[7px] sm:left-[10px] group-hover:left-1/2 group-hover:-translate-x-1/2",
              // Start same size as default icon (no shrink), then grow.
              "opacity-0 scale-100 transition-all duration-200 ease-out",
              "group-hover:opacity-100 group-hover:scale-[1.38]",
              "text-comfort-sage-700 group-hover:text-comfort-sage-800"
            )}
          >
            <OpenAILogo className="w-[24px] h-[24px]" />
          </span>
        </motion.button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className={cn(
          "min-w-[280px] p-2",
          "bg-white/95 backdrop-blur-md",
          "border border-gray-200",
          "shadow-xl rounded-xl"
        )}
      >
        <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <OpenAILogo className="w-4 h-4" />
            <span>OpenAI Models</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1 bg-gray-100" />

        <AnimatePresence>
          {MODELS.map((model, index) => (
            <motion.div
              key={model.id}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <DropdownMenuItem
                onClick={() => {
                  onChange(model.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                  "transition-colors duration-150",
                  value === model.id && "bg-comfort-sage-50"
                )}
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100">
                  {TIER_ICONS[model.tier]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{model.name}</span>
                    <span className={cn(
                      "px-1.5 py-0.5 text-[10px] font-medium rounded-full",
                      TIER_BADGES[model.tier].className
                    )}>
                      {TIER_BADGES[model.tier].label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{model.description}</p>
                </div>
                {value === model.id && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  >
                    <Check className="w-4 h-4 text-comfort-sage-600" />
                  </motion.div>
                )}
              </DropdownMenuItem>
            </motion.div>
          ))}
        </AnimatePresence>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
