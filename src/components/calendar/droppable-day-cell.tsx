'use client';

import { useDroppable } from '@dnd-kit/core';
import { format, isSameDay, isSameMonth, isToday } from 'date-fns';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AssignmentCard } from './assignment-card';
import { DraggableAssignmentCard } from './draggable-assignment-card';
import { DayEventsPopover } from './day-events-popover';
import { isDateInRange } from '@/lib/calendar/utils';
import type { CalendarEvent } from '@/types/calendar';
import type { ScheduledDayInfo } from '@/app/(dashboard)/calendar/actions';

// Constants for event display
const MIN_EVENTS_TO_SHOW = 3;
const MAX_EVENTS_TO_SHOW = 6;

interface DroppableDayCellProps {
  date: Date;
  currentMonth: Date;
  events: CalendarEvent[];
  onDayClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onStatusClick?: (assignmentId: string) => void;
  onEditClick?: (event: CalendarEvent) => void;
  onAddClick?: (date: Date) => void;
  onOptionClickDelete?: (dayId: string, event: CalendarEvent, date: string) => void;
  isUpdatingAssignment?: string | null;
  showEditButton?: boolean;
  showAddButton?: boolean;
  maxEventsToShow?: number;
  selectedDate?: Date | null;
  projectStartDate?: string | null;
  projectEndDate?: string | null;
  enableDragMove?: boolean;
  scheduledDaysWithIds?: Record<string, ScheduledDayInfo[]>;
}

export function DroppableDayCell({
  date,
  currentMonth,
  events,
  onDayClick,
  onEventClick,
  onStatusClick,
  onEditClick,
  onAddClick,
  onOptionClickDelete,
  isUpdatingAssignment,
  showEditButton = true,
  showAddButton = false,
  maxEventsToShow = MAX_EVENTS_TO_SHOW,
  selectedDate,
  projectStartDate,
  projectEndDate,
  enableDragMove = false,
  scheduledDaysWithIds,
}: DroppableDayCellProps) {
  const droppableId = `day-${format(date, 'yyyy-MM-dd')}`;
  const { isOver, setNodeRef } = useDroppable({
    id: droppableId,
    data: {
      type: 'day',
      date: date,
    },
  });

  const isCurrentMonth = isSameMonth(date, currentMonth);
  const isSelected = selectedDate && isSameDay(date, selectedDate);

  // Calculate how many events to show (auto-expand from MIN to MAX)
  const effectiveMaxEvents = Math.min(Math.max(events.length, MIN_EVENTS_TO_SHOW), maxEventsToShow);
  const visibleEvents = events.slice(0, effectiveMaxEvents);
  const hiddenCount = events.length - effectiveMaxEvents;
  const hasMoreEvents = hiddenCount > 0;
  const inProjectRange = isDateInRange(date, projectStartDate ?? null, projectEndDate ?? null);

  // Calculate minimum height based on events (28px per event + 40px for header)
  const minHeight = Math.max(MIN_EVENTS_TO_SHOW, Math.min(events.length, MAX_EVENTS_TO_SHOW)) * 28 + 40;

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddClick?.(date);
  };

  return (
    <div
      ref={setNodeRef}
      onClick={() => {
        // Don't trigger click if we're in a drag operation
        if (!isOver) {
          onDayClick?.(date);
        }
      }}
      style={{ minHeight: `${minHeight}px` }}
      className={cn(
        'p-1 border-b border-r cursor-pointer transition-colors touch-none group',
        !isCurrentMonth && 'bg-muted/30',
        isCurrentMonth && 'bg-background',
        inProjectRange && isCurrentMonth && 'bg-primary/5',
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
        {isOver ? (
          <span className="text-xs text-primary font-medium">Drop here</span>
        ) : showAddButton && inProjectRange && isCurrentMonth && (
          <button
            onClick={handleAddClick}
            className={cn(
              'h-6 w-6 flex items-center justify-center rounded-full',
              'bg-primary/10 hover:bg-primary/20 text-primary',
              'transition-opacity',
              // Always visible on mobile, hover on desktop
              'opacity-100 md:opacity-0 md:group-hover:opacity-100',
              'touch-manipulation'
            )}
            aria-label="Add assignment"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-1">
        {visibleEvents.map((event) => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const dayInfo = scheduledDaysWithIds?.[event.assignmentId]?.find(d => d.date === dateStr);
          const dayId = dayInfo?.dayId;

          if (enableDragMove && dayId) {
            return (
              <DraggableAssignmentCard
                key={`${event.id}-${dateStr}`}
                event={event}
                dayId={dayId}
                currentDate={dateStr}
                compact
                onClick={(e) => {
                  e?.stopPropagation?.();
                  onEventClick?.(event);
                }}
                onStatusClick={onStatusClick}
                onEditClick={onEditClick}
                onOptionClickDelete={onOptionClickDelete}
                isUpdating={isUpdatingAssignment === event.assignmentId}
                showEditButton={showEditButton}
                enableDrag={!isUpdatingAssignment}
              />
            );
          }

          return (
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
          );
        })}

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
