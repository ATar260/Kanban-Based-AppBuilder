'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, Sparkles, Box, Server, Triangle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/shadcn/dropdown-menu';
import { cn } from '@/utils/cn';

interface SandboxProvider {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const SANDBOX_PROVIDERS: SandboxProvider[] = [
  {
    id: 'auto',
    name: 'Auto',
    description: 'Automatically select best provider',
    icon: <Sparkles className="w-[24px] h-[24px] text-amber-500" />
  },
  {
    id: 'e2b',
    name: 'E2B',
    description: 'Fast cloud sandboxes',
    icon: <Box className="w-[24px] h-[24px] text-blue-500" />
  },
  {
    id: 'modal',
    name: 'Modal',
    description: 'GPU-enabled sandboxes',
    icon: <Server className="w-[24px] h-[24px] text-purple-500" />
  },
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Vercel Sandbox runtime',
    icon: <Triangle className="w-[24px] h-[24px] text-gray-900" />
  },
];

interface SandboxSelectorProps {
  value: string;
  onChange: (provider: string) => void;
  disabled?: boolean;
  className?: string;
  // Health status from sandbox
  sandboxData?: {
    healthStatusCode?: number | null;
    healthError?: string;
  } | null;
}

export function SandboxSelector({
  value,
  onChange,
  disabled,
  className,
  sandboxData
}: SandboxSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedProvider = SANDBOX_PROVIDERS.find(p => p.id === value) || SANDBOX_PROVIDERS[0];

  // Determine health status
  const healthCode = sandboxData?.healthStatusCode;
  const healthError = sandboxData?.healthError;
  const isHealthy = typeof healthCode === 'number' ? healthCode >= 200 && healthCode < 300 : true;
  const hasHealthData = sandboxData !== null && sandboxData !== undefined;

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
          title={healthError ? `${isHealthy ? 'Sandbox healthy' : `Sandbox error`}\n${healthError}` : (isHealthy ? 'Sandbox healthy' : 'Sandbox error')}
        >
          <div className="relative flex items-center justify-center w-[24px] h-[24px] transition-opacity duration-200 ease-out group-hover:opacity-0">
            {selectedProvider.icon}
            {/* Health indicator dot (anchored near the icon, not the chevron) */}
            {hasHealthData && (
              <span className="absolute top-0 right-0 flex h-2.5 w-2.5">
                <span className={cn(
                  "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                  isHealthy ? "bg-green-400" : "bg-red-400"
                )} />
                <span className={cn(
                  "relative inline-flex rounded-full h-2.5 w-2.5",
                  isHealthy ? "bg-green-500" : "bg-red-500"
                )} />
              </span>
            )}
          </div>
          <span className="max-w-[100px] truncate transition-opacity duration-200 ease-out group-hover:opacity-0">
            {selectedProvider.name}
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
              "group-hover:opacity-100 group-hover:scale-[1.38]"
            )}
          >
            <span className="flex items-center justify-center">{selectedProvider.icon}</span>
          </span>
        </motion.button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className={cn(
          "min-w-[260px] p-2",
          "bg-white/95 backdrop-blur-md",
          "border border-gray-200",
          "shadow-xl rounded-xl"
        )}
      >
        <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4" />
            <span>Sandbox Provider</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1 bg-gray-100" />

        {/* Health status banner if there's an error */}
        {hasHealthData && !isHealthy && (
          <div className="mx-2 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs font-medium text-red-700">
              Sandbox Error {healthCode && `(HTTP ${healthCode})`}
            </p>
            {healthError && (
              <p className="text-xs text-red-600 mt-0.5 truncate">{healthError}</p>
            )}
          </div>
        )}

        <AnimatePresence>
          {SANDBOX_PROVIDERS.map((provider, index) => (
            <motion.div
              key={provider.id}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <DropdownMenuItem
                onClick={() => {
                  onChange(provider.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                  "transition-colors duration-150",
                  value === provider.id && "bg-comfort-sage-50"
                )}
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100">
                  {provider.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{provider.name}</span>
                    {provider.id === 'auto' && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-amber-100 text-amber-700">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{provider.description}</p>
                </div>
                {value === provider.id && (
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
