'use client';

import { cn } from '@/lib/utils';

interface TodayIndicatorProps {
  className?: string;
  orientation?: 'vertical' | 'horizontal';
}

/**
 * Visual indicator for "today" on calendar views
 * Can be rendered as a vertical line (for day columns) or horizontal (for Gantt rows)
 */
export function TodayIndicator({ className, orientation = 'vertical' }: TodayIndicatorProps) {
  if (orientation === 'horizontal') {
    return (
      <div
        className={cn(
          'absolute left-0 right-0 h-0.5 bg-red-500 z-20 pointer-events-none',
          className
        )}
      >
        <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-red-500" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none',
        className
      )}
    >
      <div className="absolute -top-1 -left-0.5 w-2 h-2 rounded-full bg-red-500" />
    </div>
  );
}

/**
 * Dot indicator for today in compact calendar cells
 */
export function TodayDot({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500',
        className
      )}
    />
  );
}
