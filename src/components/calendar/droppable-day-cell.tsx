'use client';

import { useDroppable } from '@dnd-kit/core';
import { format, isSameDay, isSameMonth, isToday, isWeekend } from 'date-fns';
import { cn } from '@/lib/utils';
import { AssignmentCard } from './assignment-card';
import type { CalendarEvent } from '@/types/calendar';

interface DroppableDayCellProps {
  date: Date;
  currentMonth: Date;
  events: CalendarEvent[];
  onDayClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  maxEventsToShow?: number;
  selectedDate?: Date | null;
}

export function DroppableDayCell({
  date,
  currentMonth,
  events,
  onDayClick,
  onEventClick,
  maxEventsToShow = 2,
  selectedDate,
}: DroppableDayCellProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `day-${format(date, 'yyyy-MM-dd')}`,
    data: {
      type: 'day',
      date: date,
    },
  });

  const isCurrentMonth = isSameMonth(date, currentMonth);
  const isSelected = selectedDate && isSameDay(date, selectedDate);
  const visibleEvents = events.slice(0, maxEventsToShow);
  const hiddenCount = events.length - maxEventsToShow;
  const hasMoreEvents = hiddenCount > 0;

  return (
    <div
      ref={setNodeRef}
      onClick={() => onDayClick?.(date)}
      className={cn(
        'min-h-[100px] p-1 border-b border-r cursor-pointer transition-colors',
        !isCurrentMonth && 'bg-muted/30',
        isCurrentMonth && 'bg-background',
        isWeekend(date) && 'bg-muted/10',
        isToday(date) && 'bg-blue-50 dark:bg-blue-950/30',
        isSelected && 'ring-2 ring-primary ring-inset',
        isOver && 'bg-primary/10 ring-2 ring-primary ring-inset',
        'hover:bg-accent/50'
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            'text-sm font-medium h-6 w-6 flex items-center justify-center rounded-full',
            !isCurrentMonth && 'text-muted-foreground',
            isToday(date) && 'bg-primary text-primary-foreground'
          )}
        >
          {format(date, 'd')}
        </span>
        {isOver && (
          <span className="text-xs text-primary font-medium">Drop here</span>
        )}
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
