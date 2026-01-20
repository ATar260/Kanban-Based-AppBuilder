'use client';

import { useMemo, useState } from 'react';
import copy from 'copy-to-clipboard';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/shadcn/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/shadcn/alert-dialog';
import { cn } from '@/utils/cn';

type ProjectSwitcherDropdownProps = {
  projectName?: string | null;
  projectId?: string | null;
  /** Called after user confirms reset */
  onResetProject: () => void;
  /** Navigate to a projects page / picker */
  onOpenProjects: () => void;
  /** Optional: URL to copy for “Copy link” */
  projectUrlToCopy?: string;
  className?: string;
};

function shortId(id: string) {
  if (id.length <= 10) return id;
  return `${id.slice(0, 6)}…${id.slice(-3)}`;
}

export function ProjectSwitcherDropdown({
  projectName,
  projectId,
  onResetProject,
  onOpenProjects,
  projectUrlToCopy,
  className,
}: ProjectSwitcherDropdownProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const displayName = useMemo(() => {
    const trimmed = (projectName || '').trim();
    if (trimmed) return trimmed;
    if (projectId) return `Project ${shortId(projectId)}`;
    return 'Project';
  }, [projectName, projectId]);

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'group relative flex items-center gap-2 h-[34px] rounded-lg border border-gray-200 bg-gray-50',
              'px-[7px] sm:px-[10px] text-sm font-medium text-gray-700',
              'transition-all duration-200 transform-gpu hover:scale-[1.02] active:scale-[0.99]',
              'hover:shadow-sm',
              'hover:bg-comfort-sage-50 hover:border-comfort-sage-200 hover:text-gray-900',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-comfort-sage-400/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
              className,
            )}
            title={displayName}
            aria-label="Project menu"
          >
            {/* simple dot/logo placeholder */}
            <span className="w-3 h-3 rounded-full bg-comfort-sage-500 transition-transform duration-200 ease-out group-hover:scale-[1.15]" />
            <span className="max-w-[160px] truncate hidden sm:inline inline-block transition-transform duration-200 ease-out group-hover:scale-[1.03]">
              {displayName}
            </span>
            <span className="sr-only sm:hidden">{displayName}</span>
            <svg
              className="h-5 w-5 text-gray-500 transition-transform duration-200 ease-out group-hover:scale-[1.05]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" sideOffset={8} className="min-w-[240px] p-2">
          <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Current
          </DropdownMenuLabel>
          <div className="px-2 pb-2">
            <div className="text-sm font-medium text-gray-900 truncate">{displayName}</div>
            {projectId && <div className="text-xs text-gray-500 truncate">ID: {projectId}</div>}
          </div>

          <DropdownMenuSeparator className="my-1 bg-gray-100" />

          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setMenuOpen(false);
              setConfirmOpen(true);
            }}
            className="cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="ml-2">New project (reset)</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setMenuOpen(false);
              onOpenProjects();
            }}
            className="cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7h6l2 2h10v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
              />
            </svg>
            <span className="ml-2">Projects…</span>
          </DropdownMenuItem>

          {projectUrlToCopy && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setMenuOpen(false);
                copy(projectUrlToCopy);
              }}
              className="cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2M8 16h8a2 2 0 002-2v-8a2 2 0 00-2-2H8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span className="ml-2">Copy link</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="p-0 overflow-hidden">
          <div className="p-6">
            <AlertDialogHeader className="space-y-2">
              <AlertDialogTitle className="text-lg">Start a new project?</AlertDialogTitle>
              <AlertDialogDescription className="text-sm">
                This will clear your current plan, chat, and in-page project state. Your sandbox URL and selected model will be kept.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>

          <div className="border-t border-gray-200" />

          <AlertDialogFooter className="p-4 sm:p-4 gap-2 sm:gap-2 sm:space-x-0">
            <AlertDialogCancel className="mt-0 rounded-lg px-4 py-2 text-sm">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg px-4 py-2 text-sm bg-comfort-sage-600 hover:bg-comfort-sage-700 text-white"
              onClick={() => {
                setConfirmOpen(false);
                onResetProject();
              }}
            >
              New project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

