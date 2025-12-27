'use client';

import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { AssignmentCard } from './assignment-card';
import { DayEventsPopover } from './day-events-popover';
import { isToday, isCurrentMonth, isDateInRange } from '@/lib/calendar/utils';
import type { CalendarEvent } from '@/types/calendar';

interface CalendarDayCellProps {
  date: Date;
  currentMonth: Date;
  events: CalendarEvent[];
  isSelected?: boolean;
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onStatusClick?: (assignmentId: string) => void;
  onEditClick?: (event: CalendarEvent) => void;
  onAddClick?: (date: Date) => void;
  isUpdatingAssignment?: string | null;
  showEditButton?: boolean;
  showAddButton?: boolean;
  maxEventsVisible?: number;
  projectStartDate?: string | null;
  projectEndDate?: string | null;
}

export function CalendarDayCell({
  date,
  currentMonth,
  events,
  isSelected = false,
  onDateClick,
  onEventClick,
  onStatusClick,
  onEditClick,
  onAddClick,
  isUpdatingAssignment,
  showEditButton = true,
  showAddButton = false,
  maxEventsVisible = 3,
  projectStartDate,
  projectEndDate,
}: CalendarDayCellProps) {
  const today = isToday(date);
  const inCurrentMonth = isCurrentMonth(date, currentMonth);
  const hasMoreEvents = events.length > maxEventsVisible;
  const visibleEvents = events.slice(0, maxEventsVisible);
  const hiddenCount = events.length - maxEventsVisible;
  const inProjectRange = isDateInRange(date, projectStartDate ?? null, projectEndDate ?? null);

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddClick?.(date);
  };

  return (
    <div
      className={cn(
        'min-h-[100px] border-r border-b p-1 transition-colors relative group',
        !inCurrentMonth && 'bg-muted/30',
        inProjectRange && inCurrentMonth && 'bg-primary/5',
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

        {/* Add button - always visible on mobile, hover on desktop */}
        {showAddButton && inProjectRange && inCurrentMonth && (
          <button
            onClick={handleAddClick}
            className={cn(
              'h-6 w-6 flex items-center justify-center rounded-full',
              'bg-primary/10 hover:bg-primary/20 text-primary',
              'transition-opacity',
              // Always visible on mobile (touch devices), hover on desktop
              'opacity-100 md:opacity-0 md:group-hover:opacity-100',
              // Larger touch target on mobile
              'touch-manipulation'
            )}
            aria-label="Add assignment"
          >
            <Plus className="h-4 w-4" />
          </button>
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
            onStatusClick={onStatusClick}
            onEditClick={onEditClick}
            isUpdating={isUpdatingAssignment === event.assignmentId}
            showEditButton={showEditButton}
          />
        ))}

        {hasMoreEvents && (
          <DayEventsPopover
            date={date}
            events={events}
            hiddenCount={hiddenCount}
            onEventClick={onEventClick}
            onStatusClick={onStatusClick}
            onEditClick={onEditClick}
            isUpdatingAssignment={isUpdatingAssignment}
            showEditButton={showEditButton}
          />
        )}
      </div>
    </div>
  );
}
