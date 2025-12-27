'use client';

import { cn } from '@/lib/utils';
import type { BookingStatus } from '@/types/calendar';
import { BOOKING_STATUS_CONFIG } from '@/lib/calendar/constants';

interface BookingStatusBadgeProps {
  status: BookingStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function BookingStatusBadge({
  status,
  size = 'md',
  showLabel = true,
  className,
}: BookingStatusBadgeProps) {
  const config = BOOKING_STATUS_CONFIG[status];

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        config.bgColor,
        config.textColor,
        sizeClasses[size],
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dotColor)} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

interface BookingStatusDotProps {
  status: BookingStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function BookingStatusDot({
  status,
  size = 'md',
  className,
}: BookingStatusDotProps) {
  const config = BOOKING_STATUS_CONFIG[status];

  const sizeClasses = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-3 w-3',
  };

  return (
    <span
      className={cn('inline-block rounded-full', config.dotColor, sizeClasses[size], className)}
      title={config.label}
    />
  );
}
