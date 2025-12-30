'use client';

import { cn } from '@/lib/utils';
import { BOOKING_STATUS_CONFIG } from '@/lib/calendar/constants';
import type { BookingStatus } from '@/types/calendar';

interface ScheduleStatusBadgeProps {
  status: BookingStatus | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * Badge component for displaying project schedule status
 * Uses the same color scheme as engineer booking status
 */
export function ScheduleStatusBadge({
  status,
  size = 'md',
  showLabel = true,
  interactive = false,
  onClick,
  className,
}: ScheduleStatusBadgeProps) {
  const isInteractive = interactive || !!onClick;

  if (!status) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border font-medium',
          'bg-muted/50 text-muted-foreground border-muted/80',
          'shadow-sm transition-all duration-200',
          size === 'sm' && 'text-[10px] px-2 py-0.5',
          size === 'md' && 'text-xs px-2.5 py-1',
          size === 'lg' && 'text-sm px-3 py-1.5',
          className
        )}
      >
        <span
          className={cn(
            'rounded-full bg-muted-foreground/40',
            size === 'sm' && 'h-1.5 w-1.5',
            size === 'md' && 'h-2 w-2',
            size === 'lg' && 'h-2.5 w-2.5'
          )}
        />
        {showLabel && <span>No dates</span>}
      </span>
    );
  }

  const config = BOOKING_STATUS_CONFIG[status];

  return (
    <span
      onClick={onClick}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        'shadow-sm transition-all duration-200',
        config.bgColor,
        config.textColor,
        config.borderColor,
        // Size variants
        size === 'sm' && 'text-[10px] px-2 py-0.5',
        size === 'md' && 'text-xs px-2.5 py-1',
        size === 'lg' && 'text-sm px-3 py-1.5',
        // Interactive states
        isInteractive && 'cursor-pointer hover:shadow-md hover:-translate-y-px active:translate-y-0',
        isInteractive && `focus-visible:outline-none focus-visible:ring-2 ${config.ringColor}`,
        // Pulse animation for pending status
        config.pulse && 'animate-pulse-subtle',
        className
      )}
    >
      <span
        className={cn(
          'rounded-full flex-shrink-0',
          config.dotColor,
          size === 'sm' && 'h-1.5 w-1.5',
          size === 'md' && 'h-2 w-2',
          size === 'lg' && 'h-2.5 w-2.5',
          config.pulse && 'animate-pulse'
        )}
      />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

/**
 * Compact dot-only indicator for schedule status
 */
export function ScheduleStatusDot({
  status,
  size = 'md',
  className,
}: {
  status: BookingStatus | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  if (!status) {
    return (
      <span
        className={cn(
          'rounded-full bg-muted-foreground/30',
          size === 'sm' && 'h-1.5 w-1.5',
          size === 'md' && 'h-2 w-2',
          size === 'lg' && 'h-2.5 w-2.5',
          className
        )}
        title="No dates set"
      />
    );
  }

  const config = BOOKING_STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        'rounded-full transition-transform',
        config.dotColor,
        size === 'sm' && 'h-1.5 w-1.5',
        size === 'md' && 'h-2 w-2',
        size === 'lg' && 'h-2.5 w-2.5',
        config.pulse && 'animate-pulse',
        className
      )}
      title={config.label}
    />
  );
}
