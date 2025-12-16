'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CalendarHeader } from './calendar-header';
import { CalendarDayCell } from './calendar-day-cell';
import { DroppableDayCell } from './droppable-day-cell';
import { CalendarLegend } from './calendar-legend';
import { AssignmentDialog } from './assignment-dialog';
import { AssignmentSidebar } from './assignment-sidebar';
import { DraggingUserOverlay } from './draggable-user';
import { WEEKDAYS } from '@/lib/calendar/constants';
import {
  getCalendarDays,
  getMonthViewRange,
  getNextMonth,
  getPreviousMonth,
  getEventsForDay,
  sortEventsByStatus,
  convertToCalendarEvents,
} from '@/lib/calendar/utils';
import { useCalendarData, useAdminUsers, useCreateAssignment } from '@/hooks/queries/use-assignments';
import type { CalendarEvent, BookingStatus } from '@/types/calendar';
import type { Project } from '@/types';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ProjectCalendarProps {
  project?: Project;
  onEventClick?: (event: CalendarEvent) => void;
  enableDragDrop?: boolean;
}

export function ProjectCalendar({ project, onEventClick, enableDragDrop = false }: ProjectCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeDragData, setActiveDragData] = useState<{
    userId: string;
    userName: string | null;
  } | null>(null);

  const { start, end } = getMonthViewRange(currentDate);
  const days = getCalendarDays(currentDate);

  const { data: calendarAssignments, isLoading } = useCalendarData(start, end, {
    projectId: project?.id,
  });

  const { data: adminUsers = [], isLoading: isLoadingUsers } = useAdminUsers();
  const createAssignment = useCreateAssignment();

  // Convert assignments to calendar events
  const events = useMemo(() => {
    if (!calendarAssignments) return [];
    return convertToCalendarEvents(calendarAssignments, new Map());
  }, [calendarAssignments]);

  // Drag sensors for better UX
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handlePreviousMonth = () => {
    setCurrentDate(getPreviousMonth(currentDate));
  };

  const handleNextMonth = () => {
    setCurrentDate(getNextMonth(currentDate));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    if (project?.start_date && project?.end_date) {
      setAssignmentDialogOpen(true);
    }
  };

  const handleEventClick = (event: CalendarEvent) => {
    onEventClick?.(event);
  };

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'user') {
      setActiveDragData({
        userId: active.data.current.userId,
        userName: active.data.current.userName,
      });
    }
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDragData(null);

      if (!over || !project) return;

      // Check if dropped on a day cell
      if (over.data.current?.type === 'day' && active.data.current?.type === 'user') {
        const userId = active.data.current.userId;
        const userName = active.data.current.userName;

        // Check if project has dates set
        if (!project.start_date || !project.end_date) {
          toast.error('Project dates required', {
            description: 'Please set project start and end dates before assigning users.',
          });
          return;
        }

        try {
          const result = await createAssignment.mutateAsync({
            projectId: project.id,
            userId,
            bookingStatus: 'pencil' as BookingStatus,
          });

          if (result.conflicts?.hasConflicts) {
            toast.warning(`${userName} assigned with conflicts`, {
              description: `There are scheduling conflicts. Review in the assignment details.`,
            });
          } else {
            toast.success(`${userName} assigned`, {
              description: `Added to ${project.client_name}`,
            });
          }
        } catch (error) {
          toast.error('Failed to assign user', {
            description: error instanceof Error ? error.message : 'An error occurred',
          });
        }
      }
    },
    [project, createAssignment]
  );

  const renderCalendarGrid = () => (
    <div className="border rounded-lg overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 bg-muted">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="p-2 text-center text-sm font-medium border-r last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((date, index) => {
          const dayEvents = sortEventsByStatus(getEventsForDay(date, events));
          const isSelected = selectedDate
            ? date.toDateString() === selectedDate.toDateString()
            : false;

          if (enableDragDrop) {
            return (
              <DroppableDayCell
                key={index}
                date={date}
                currentMonth={currentDate}
                events={dayEvents}
                selectedDate={isSelected ? selectedDate : undefined}
                onDayClick={handleDateClick}
                onEventClick={handleEventClick}
              />
            );
          }

          return (
            <CalendarDayCell
              key={index}
              date={date}
              currentMonth={currentDate}
              events={dayEvents}
              isSelected={isSelected}
              onDateClick={handleDateClick}
              onEventClick={handleEventClick}
            />
          );
        })}
      </div>
    </div>
  );

  const calendarContent = (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <CalendarHeader
          currentDate={currentDate}
          onPreviousMonth={handlePreviousMonth}
          onNextMonth={handleNextMonth}
          onToday={handleToday}
        />
        <CalendarLegend />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-[500px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        renderCalendarGrid()
      )}

      {/* Assignment dialog */}
      <AssignmentDialog
        open={assignmentDialogOpen}
        onOpenChange={setAssignmentDialogOpen}
        project={project || null}
      />
    </div>
  );

  // If drag-drop is disabled, render simple calendar
  if (!enableDragDrop) {
    return calendarContent;
  }

  // Render calendar with drag-drop context and sidebar
  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex">
        {calendarContent}
        <AssignmentSidebar
          users={adminUsers}
          isLoading={isLoadingUsers}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      <DragOverlay>
        {activeDragData && (
          <DraggingUserOverlay userName={activeDragData.userName} />
        )}
      </DragOverlay>
    </DndContext>
  );
}
