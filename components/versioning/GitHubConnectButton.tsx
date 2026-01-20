'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { initiateGitHubOAuth, isGitHubConnected, getGitHubConnection, clearGitHubConnection } from '@/lib/versioning/github';
import { cn } from '@/utils/cn';

// GitHub logo as a reusable component
function GitHubLogo({ className }: { className?: string }) {
    return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
        </svg>
    );
}

interface GitHubConnectButtonProps {
    onConnect?: () => void;
    onDisconnect?: () => void;
    className?: string;
    mode?: 'default' | 'toolbar';
}

export function GitHubConnectButton({
    onConnect,
    onDisconnect,
    className = '',
    mode = 'default'
}: GitHubConnectButtonProps) {
    const [isConnected, setIsConnected] = useState(() => isGitHubConnected());
    const connection = getGitHubConnection();
    const isToolbar = mode === 'toolbar';
    const overlayStartLeft = isToolbar ? 'left-[7px] sm:left-[10px]' : 'left-5';

    const handleConnect = () => {
        if (!process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID) {
            alert('GitHub integration not configured. Add NEXT_PUBLIC_GITHUB_CLIENT_ID to your .env.local file.');
            return;
        }
        initiateGitHubOAuth();
    };

    const handleDisconnect = () => {
        clearGitHubConnection();
        setIsConnected(false);
        onDisconnect?.();
    };

    if (isConnected && connection) {
        return (
            <div className={cn("flex items-center gap-1.5", isToolbar && "h-9", className)}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                        "relative flex items-center gap-2 border shadow-sm",
                        isToolbar ? "h-[34px] px-[7px] sm:px-[10px] rounded-lg" : "px-3 py-2 rounded-xl",
                        "bg-comfort-sage-50 border-comfort-sage-200"
                    )}
                >
                    {/* Subtle glow effect */}
                    <div className={cn(
                        "absolute inset-0 animate-pulse",
                        isToolbar ? "rounded-lg" : "rounded-xl",
                        "bg-comfort-sage-500/10"
                    )} />

                    {connection.avatarUrl && (
                        <img
                            src={connection.avatarUrl}
                            alt={connection.username}
                            className="relative w-5 h-5 rounded-full ring-2 ring-comfort-sage-300"
                        />
                    )}
                    <span className="relative text-sm font-medium text-comfort-sage-800">@{connection.username}</span>
                    <Check className="relative w-5 h-5 text-comfort-sage-700" />
                </motion.div>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleDisconnect}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                    title="Disconnect GitHub"
                >
                    <X className="w-4 h-4" />
                </motion.button>
            </div>
        );
    }

    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleConnect}
            aria-label="Publish"
            title="Publish to GitHub"
            className={cn(
                "group relative flex items-center transition-all duration-200 focus:outline-none overflow-hidden",
                "gap-0",
                isToolbar
                  ? "h-[34px] px-[7px] sm:px-[10px] rounded-lg shadow-sm hover:shadow-md hover:shadow-gray-900/20"
                  : "px-5 py-3 rounded-xl shadow-lg shadow-gray-900/20 hover:shadow-xl hover:shadow-gray-900/30",
                "bg-gray-900 hover:bg-gray-800 text-white",
                "focus-visible:ring-2 focus-visible:ring-comfort-sage-400/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                className
            )}
        >
            <GitHubLogo
              className={cn(
                "w-[24px] h-[24px]",
                "transition-opacity duration-200 ease-out group-hover:opacity-0"
              )}
            />
            <span
              className={cn(
                "ml-3 whitespace-nowrap transition-opacity duration-200 ease-out group-hover:opacity-0",
                isToolbar ? "hidden sm:inline text-sm font-medium" : "text-base font-semibold",
              )}
            >
              Publish
            </span>

            {/* Hover takeover icon (centers + enlarges; button width stays stable) */}
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute top-1/2 -translate-y-1/2 translate-x-0",
                overlayStartLeft,
                // Start same size as default icon (no shrink), then grow.
                "opacity-0 scale-100 transition-all duration-200 ease-out",
                "group-hover:left-1/2 group-hover:-translate-x-1/2 group-hover:opacity-100 group-hover:scale-[1.32]",
                "text-white group-hover:text-comfort-sage-200"
              )}
            >
              <GitHubLogo className="w-[24px] h-[24px]" />
            </span>
        </motion.button>
    );
}
