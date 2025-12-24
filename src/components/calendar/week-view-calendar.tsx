'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { format, startOfWeek, addWeeks, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AssignmentCard } from './assignment-card';
import {
  WEEKDAYS_WORK,
  getWeeksInRange,
  getEventsForDay,
  sortEventsByStatus,
  isToday,
  isDateInRange,
} from '@/lib/calendar/utils';
import type { CalendarEvent } from '@/types/calendar';

// Droppable day cell for week view
function WeekDayCell({
  date,
  events,
  projectStartDate,
  projectEndDate,
  onEventClick,
  onStatusClick,
  onEditClick,
  isUpdatingAssignment,
  showEditButton,
  enableDragDrop,
}: {
  date: Date;
  events: CalendarEvent[];
  projectStartDate: string;
  projectEndDate: string;
  onEventClick?: (event: CalendarEvent) => void;
  onStatusClick?: (assignmentId: string) => void;
  onEditClick?: (event: CalendarEvent) => void;
  isUpdatingAssignment?: string | null;
  showEditButton?: boolean;
  enableDragDrop?: boolean;
}) {
  const droppableId = `day-${format(date, 'yyyy-MM-dd')}`;
  const { isOver, setNodeRef } = useDroppable({
    id: droppableId,
    data: {
      type: 'day',
      date: date,
    },
    disabled: !enableDragDrop,
  });

  // Debug logging for drop zone
  useEffect(() => {
    if (isOver) {
      console.log('[DROPPABLE-WEEK] Hovering over:', droppableId);
    }
  }, [isOver, droppableId]);

  const dayEvents = sortEventsByStatus(getEventsForDay(date, events));
  const today = isToday(date);
  const inProjectRange = isDateInRange(date, projectStartDate, projectEndDate);

  return (
    <div
      ref={enableDragDrop ? setNodeRef : undefined}
      className={cn(
        'min-h-[120px] p-2 border-r border-b last:border-r-0',
        'bg-background',
        inProjectRange && 'bg-primary/5',
        today && 'bg-blue-50 dark:bg-blue-950/30',
        enableDragDrop && 'touch-none',
        isOver && 'bg-primary/10 ring-2 ring-primary ring-inset'
      )}
    >
      {/* Day header */}
      <div className="flex items-center justify-between mb-2">
        <span
          className={cn(
            'text-sm font-medium h-7 w-7 flex items-center justify-center rounded-full',
            today && 'bg-primary text-primary-foreground'
          )}
        >
          {format(date, 'd')}
        </span>
        <div className="flex items-center gap-1">
          {isOver && (
            <span className="text-xs text-primary font-medium">Drop here</span>
          )}
          <span className="text-xs text-muted-foreground">
            {format(date, 'EEE')}
          </span>
        </div>
      </div>

      {/* Events */}
      <div className="space-y-1">
        {dayEvents.map((event) => (
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
      </div>
    </div>
  );
}

interface WeekViewCalendarProps {
  events: CalendarEvent[];
  projectStartDate: string;
  projectEndDate: string;
  onEventClick?: (event: CalendarEvent) => void;
  onStatusClick?: (assignmentId: string) => void;
  onEditClick?: (event: CalendarEvent) => void;
  isUpdatingAssignment?: string | null;
  showEditButton?: boolean;
  enableDragDrop?: boolean;
}

export function WeekViewCalendar({
  events,
  projectStartDate,
  projectEndDate,
  onEventClick,
  onStatusClick,
  onEditClick,
  isUpdatingAssignment,
  showEditButton = true,
  enableDragDrop = false,
}: WeekViewCalendarProps) {
  // Get all weeks in the project range
  const weeks = useMemo(
    () => getWeeksInRange(projectStartDate, projectEndDate),
    [projectStartDate, projectEndDate]
  );

  // Current week index for navigation
  const [currentWeekIndex, setCurrentWeekIndex] = useState(() => {
    // Start at the first week that contains today, or first week
    const today = new Date();
    const todayWeekIndex = weeks.findIndex((week) =>
      week.some((day) => isSameDay(day, today))
    );
    return todayWeekIndex >= 0 ? todayWeekIndex : 0;
  });

  const currentWeek = weeks[currentWeekIndex] || [];
  const totalWeeks = weeks.length;

  const handlePreviousWeek = useCallback(() => {
    setCurrentWeekIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNextWeek = useCallback(() => {
    setCurrentWeekIndex((prev) => Math.min(totalWeeks - 1, prev + 1));
  }, [totalWeeks]);

  const handleToday = useCallback(() => {
    const today = new Date();
    const todayWeekIndex = weeks.findIndex((week) =>
      week.some((day) => isSameDay(day, today))
    );
    if (todayWeekIndex >= 0) {
      setCurrentWeekIndex(todayWeekIndex);
    }
  }, [weeks]);

  // Week range label
  const weekRangeLabel = useMemo(() => {
    if (currentWeek.length === 0) return '';
    const firstDay = currentWeek[0];
    const lastDay = currentWeek[currentWeek.length - 1];
    return `${format(firstDay, 'MMM d')} - ${format(lastDay, 'd, yyyy')}`;
  }, [currentWeek]);

  if (weeks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No weekdays in the project date range.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={handlePreviousWeek}
            disabled={currentWeekIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={handleNextWeek}
            disabled={currentWeekIndex === totalWeeks - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-base font-medium min-w-[180px]">
            {weekRangeLabel}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={handleToday}
          >
            Today
          </Button>
        </div>
        <span className="text-sm text-muted-foreground">
          Week {currentWeekIndex + 1} of {totalWeeks}
        </span>
      </div>

      {/* Week grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-5 bg-muted">
          {WEEKDAYS_WORK.map((day) => (
            <div
              key={day}
              className="p-2 text-center text-sm font-medium border-r last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Week days */}
        <div className="grid grid-cols-5">
          {/* Fill empty slots if week starts mid-week */}
          {currentWeek.length < 5 &&
            Array.from({ length: 5 - currentWeek.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="min-h-[120px] border-r border-b bg-muted/20"
              />
            ))}
          {currentWeek.map((date) => (
            <WeekDayCell
              key={date.toISOString()}
              date={date}
              events={events}
              projectStartDate={projectStartDate}
              projectEndDate={projectEndDate}
              onEventClick={onEventClick}
              onStatusClick={onStatusClick}
              onEditClick={onEditClick}
              isUpdatingAssignment={isUpdatingAssignment}
              showEditButton={showEditButton}
              enableDragDrop={enableDragDrop}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
