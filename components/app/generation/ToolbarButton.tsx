import * as React from 'react';

import { cn } from '@/utils/cn';

export type ToolbarButtonVariant = 'neutral' | 'primary' | 'danger';
export type ToolbarButtonLabelMode = 'responsive' | 'always' | 'never';

export interface ToolbarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon?: React.ReactNode;
  /** Show icon-only on small screens, icon+label on larger screens. */
  labelMode?: ToolbarButtonLabelMode;
  /** Visually highlight as selected/active (e.g. toggle buttons). */
  active?: boolean;
  variant?: ToolbarButtonVariant;
}

export function ToolbarButton({
  label,
  icon,
  labelMode = 'responsive',
  active = false,
  variant = 'neutral',
  className,
  type,
  ...props
}: ToolbarButtonProps) {
  const showVisibleLabel = labelMode !== 'never';
  const hideLabelOnSmall = labelMode === 'responsive';

  const ariaLabel = props['aria-label'] ?? label;
  const title = props.title ?? label;

  return (
    <button
      {...props}
      type={type ?? 'button'}
      aria-label={ariaLabel}
      title={title}
      className={cn(
        'group relative inline-flex items-center justify-center',
        'h-[34px] rounded-lg border overflow-hidden',
        'text-sm font-medium',
        'transition-all duration-200',
        'transform-gpu hover:scale-[1.02] active:scale-[0.99]',
        'hover:shadow-sm',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-comfort-sage-400/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        // Responsive padding: compact icon-only on small screens.
        'px-[7px] sm:px-[10px]',
        // Use label margin instead of `gap` so we can collapse cleanly on hover.
        'gap-0',
        // Icon sizing (works for lucide + inline svg if className is used)
        '[&_svg]:h-[24px] [&_svg]:w-[24px]',
        variant === 'neutral' && [
          'bg-gray-50 border-gray-200 text-gray-700',
          'hover:bg-comfort-sage-50 hover:border-comfort-sage-200 hover:text-gray-900',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        ],
        variant === 'primary' && [
          'bg-comfort-sage-600 border-comfort-sage-700 text-white',
          'hover:bg-comfort-sage-700 hover:shadow-comfort-sage-500/20',
          'disabled:opacity-60 disabled:cursor-not-allowed',
        ],
        variant === 'danger' && [
          'bg-red-600 border-red-700 text-white',
          'hover:bg-red-700 hover:shadow-red-500/15',
          'disabled:opacity-60 disabled:cursor-not-allowed',
        ],
        active && variant === 'neutral' && 'bg-comfort-sage-50 border-comfort-sage-200 text-comfort-charcoal-800',
        className,
      )}
    >
      {icon ? (
        <span className="flex items-center justify-center transition-opacity duration-200 ease-out group-hover:opacity-0">
          {icon}
        </span>
      ) : null}

      {showVisibleLabel ? (
        <span
          className={cn(
            'ml-[6px] max-w-[160px] truncate',
            'transition-opacity duration-200 ease-out',
            hideLabelOnSmall && 'hidden sm:inline',
            'group-hover:opacity-0',
          )}
        >
          {label}
        </span>
      ) : (
        <span className="sr-only">{label}</span>
      )}

      {/* When the label is hidden on small screens, keep an accessible name. */}
      {showVisibleLabel && hideLabelOnSmall ? <span className="sr-only sm:hidden">{label}</span> : null}

      {/* Hover takeover icon: center + enlarge without changing button width */}
      {icon ? (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute top-1/2 -translate-y-1/2 translate-x-0',
            // Start where the icon normally sits (left padded), then glide to center.
            'left-[7px] sm:left-[10px] group-hover:left-1/2 group-hover:-translate-x-1/2',
            // Start at the same size as the default icon, then grow.
            'opacity-0 scale-100 transition-all duration-200 ease-out',
            'group-hover:opacity-100 group-hover:scale-[1.38]',
            variant === 'neutral' && 'text-comfort-sage-700 group-hover:text-comfort-sage-800',
            variant !== 'neutral' && 'text-white',
          )}
        >
          <span className="[&_svg]:h-[24px] [&_svg]:w-[24px]">{icon}</span>
        </span>
      ) : null}
    </button>
  );
}

