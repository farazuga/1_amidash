'use client';

import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { AssignmentCard } from './assignment-card';
import { isToday, isCurrentMonth } from '@/lib/calendar/utils';
import type { CalendarEvent } from '@/types/calendar';

interface CalendarDayCellProps {
  date: Date;
  currentMonth: Date;
  events: CalendarEvent[];
  isSelected?: boolean;
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  maxEventsVisible?: number;
}

export function CalendarDayCell({
  date,
  currentMonth,
  events,
  isSelected = false,
  onDateClick,
  onEventClick,
  maxEventsVisible = 3,
}: CalendarDayCellProps) {
  const today = isToday(date);
  const inCurrentMonth = isCurrentMonth(date, currentMonth);
  const hasMoreEvents = events.length > maxEventsVisible;
  const visibleEvents = events.slice(0, maxEventsVisible);
  const hiddenCount = events.length - maxEventsVisible;

  return (
    <div
      className={cn(
        'min-h-[100px] border-r border-b p-1 transition-colors',
        !inCurrentMonth && 'bg-muted/30',
        isSelected && 'bg-accent',
        'hover:bg-accent/50 cursor-pointer'
      )}
      onClick={() => onDateClick?.(date)}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            'text-sm font-medium h-6 w-6 flex items-center justify-center rounded-full',
            today && 'bg-primary text-primary-foreground',
            !inCurrentMonth && 'text-muted-foreground'
          )}
        >
          {format(date, 'd')}
        </span>
      </div>

      <div className="space-y-1">
        {visibleEvents.map((event) => (
          <AssignmentCard
            key={event.id}
            event={event}
            compact
            onClick={(e) => {
              e?.stopPropagation?.();
              onEventClick?.(event);
            }}
          />
        ))}

        {hasMoreEvents && (
          <button
            className="text-xs text-muted-foreground hover:text-foreground px-1"
            onClick={(e) => {
              e.stopPropagation();
              // Could show a popover with all events
            }}
          >
            +{hiddenCount} more
          </button>
        )}
      </div>
    </div>
  );
}
