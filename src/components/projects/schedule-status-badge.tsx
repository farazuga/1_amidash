'use client';

import { cn } from '@/lib/utils';
import { BOOKING_STATUS_CONFIG } from '@/lib/calendar/constants';
import type { BookingStatus } from '@/types/calendar';

interface ScheduleStatusBadgeProps {
  status: BookingStatus | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
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
  onClick,
  className,
}: ScheduleStatusBadgeProps) {
  if (!status) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5',
          'bg-muted/50 text-muted-foreground border-muted',
          size === 'sm' && 'text-xs px-1.5 py-0.5',
          size === 'md' && 'text-xs px-2 py-0.5',
          size === 'lg' && 'text-sm px-3 py-1',
          className
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
        {showLabel && <span>No dates</span>}
      </span>
    );
  }

  const config = BOOKING_STATUS_CONFIG[status];

  return (
    <span
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border',
        config.bgColor,
        config.textColor,
        config.borderColor,
        size === 'sm' && 'text-xs px-1.5 py-0.5',
        size === 'md' && 'text-xs px-2 py-0.5',
        size === 'lg' && 'text-sm px-3 py-1',
        onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dotColor)} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

/**
 * Compact dot-only indicator for schedule status
 */
export function ScheduleStatusDot({
  status,
  className,
}: {
  status: BookingStatus | null;
  className?: string;
}) {
  if (!status) {
    return (
      <span
        className={cn(
          'h-2 w-2 rounded-full bg-muted-foreground/30',
          className
        )}
        title="No dates set"
      />
    );
  }

  const config = BOOKING_STATUS_CONFIG[status];

  return (
    <span
      className={cn('h-2 w-2 rounded-full', config.dotColor, className)}
      title={config.label}
    />
  );
}
