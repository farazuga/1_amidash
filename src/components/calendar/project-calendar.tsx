'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CalendarHeader } from './calendar-header';
import { CalendarHeaderWithDates } from './calendar-header-with-dates';
import { useUser } from '@/hooks/use-user';
import { CalendarDayCell } from './calendar-day-cell';
import { DroppableDayCell } from './droppable-day-cell';
import { CalendarLegend } from './calendar-legend';
import { AssignmentDialog } from './assignment-dialog';
import { AssignmentSidebar } from './assignment-sidebar';
import { DraggingUserOverlay } from './draggable-user';
import { WEEKDAYS, BOOKING_STATUS_CONFIG } from '@/lib/calendar/constants';
import {
  getCalendarDays,
  getMonthViewRange,
  getNextMonth,
  getPreviousMonth,
  getEventsForDay,
  sortEventsByStatus,
  convertToCalendarEvents,
} from '@/lib/calendar/utils';
import { useCalendarData, useAssignableUsers, useCreateAssignment, useCycleAssignmentStatus } from '@/hooks/queries/use-assignments';
import { AssignmentDaysDialog } from './assignment-days-dialog';
import { MultiUserAssignmentDialog } from './multi-user-assignment-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMediaQuery } from '@/hooks/use-media-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CalendarEvent, BookingStatus } from '@/types/calendar';
import type { Project } from '@/types';
import { Loader2, LayoutGrid, GanttChart, CalendarDays, Users } from 'lucide-react';
import { GanttCalendar } from './gantt-calendar';
import { WeekViewCalendar } from './week-view-calendar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ProjectCalendarProps {
  project?: Project;
  onEventClick?: (event: CalendarEvent) => void;
  enableDragDrop?: boolean;
}

export function ProjectCalendar({ project, onEventClick, enableDragDrop = false }: ProjectCalendarProps) {
  const isMobile = useIsMobile();
  const isLargeScreen = useMediaQuery('(min-width: 1280px)');
  const { isAdmin } = useUser();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Auto-collapse sidebar on smaller screens
  useEffect(() => {
    if (!isLargeScreen && !sidebarCollapsed) {
      setSidebarCollapsed(true);
    }
  }, [isLargeScreen, sidebarCollapsed]);

  // Smart default: week view if project has dates, month view otherwise
  const [viewMode, setViewMode] = useState<'calendar' | 'week' | 'gantt'>(() => {
    if (project?.start_date && project?.end_date) {
      return 'week';
    }
    return 'calendar';
  });
  const [activeDragData, setActiveDragData] = useState<{
    userId: string;
    userName: string | null;
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<CalendarEvent | null>(null);
  const [multiUserDialogOpen, setMultiUserDialogOpen] = useState(false);

  const { start, end } = getMonthViewRange(currentDate);
  const days = getCalendarDays(currentDate);

  const { data: calendarAssignments, isLoading } = useCalendarData(start, end, {
    projectId: project?.id,
  });

  // Use assignable users instead of just admin users
  const { data: assignableUsers = [], isLoading: isLoadingUsers } = useAssignableUsers();
  const createAssignment = useCreateAssignment();
  const cycleStatus = useCycleAssignmentStatus();

  // Convert assignments to calendar events
  const events = useMemo(() => {
    if (!calendarAssignments) return [];
    return convertToCalendarEvents(calendarAssignments, new Map());
  }, [calendarAssignments]);

  // Calculate status counts for summary bar
  const statusCounts = useMemo(() => {
    const counts = {
      pencil: 0,
      pending_confirm: 0,
      confirmed: 0,
      total: 0,
    };
    events.forEach((event) => {
      counts[event.bookingStatus]++;
      counts.total++;
    });
    return counts;
  }, [events]);

  // Filter events by status
  const filteredEvents = useMemo(() => {
    if (statusFilter === 'all') return events;
    return events.filter((e) => e.bookingStatus === statusFilter);
  }, [events, statusFilter]);

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

  // Handle status cycling (click on status dot)
  const handleStatusClick = useCallback(async (assignmentId: string) => {
    try {
      const result = await cycleStatus.mutateAsync(assignmentId);
      toast.success('Status updated', {
        description: `Changed to ${result.newStatus.replace('_', ' ')}`,
      });
    } catch (error) {
      toast.error('Failed to update status', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    }
  }, [cycleStatus]);

  // Handle edit click (pencil icon)
  const handleEditClick = useCallback((event: CalendarEvent) => {
    setSelectedAssignment(event);
    setEditDialogOpen(true);
  }, []);

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
          const dayEvents = sortEventsByStatus(getEventsForDay(date, filteredEvents));
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
                onStatusClick={handleStatusClick}
                onEditClick={!isMobile ? handleEditClick : undefined}
                isUpdatingAssignment={cycleStatus.isPending ? cycleStatus.variables : null}
                showEditButton={!isMobile}
                projectStartDate={project?.start_date}
                projectEndDate={project?.end_date}
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
              onStatusClick={handleStatusClick}
              onEditClick={!isMobile ? handleEditClick : undefined}
              isUpdatingAssignment={cycleStatus.isPending ? cycleStatus.variables : null}
              showEditButton={!isMobile}
              projectStartDate={project?.start_date}
              projectEndDate={project?.end_date}
            />
          );
        })}
      </div>
    </div>
  );

  // View toggle buttons
  // View toggle - show week view option only when project has dates
  const hasProjectDates = project?.start_date && project?.end_date;
  const viewToggle = enableDragDrop && (
    <div className="flex items-center gap-1 border rounded-lg p-1 print:hidden">
      {hasProjectDates && (
        <Button
          variant={viewMode === 'week' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 gap-1"
          onClick={() => setViewMode('week')}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Week
        </Button>
      )}
      <Button
        variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
        size="sm"
        className="h-7 gap-1"
        onClick={() => setViewMode('calendar')}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Month
      </Button>
      <Button
        variant={viewMode === 'gantt' ? 'secondary' : 'ghost'}
        size="sm"
        className="h-7 gap-1"
        onClick={() => setViewMode('gantt')}
      >
        <GanttChart className="h-3.5 w-3.5" />
        Gantt
      </Button>
    </div>
  );

  // Status summary bar component
  const statusSummaryBar = statusCounts.total > 0 && (
    <div className="flex items-center gap-4 text-sm bg-muted/50 p-2 rounded-lg">
      {(['pencil', 'pending_confirm', 'confirmed'] as const).map((status) => {
        const config = BOOKING_STATUS_CONFIG[status];
        const count = statusCounts[status];
        return (
          <div key={status} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-full ${config.dotColor}`} />
            <span className="font-medium">{count}</span>
            <span className="text-muted-foreground">{config.label}</span>
          </div>
        );
      })}
      <span className="text-muted-foreground ml-auto">
        {statusCounts.total} total assignment{statusCounts.total !== 1 ? 's' : ''}
      </span>
    </div>
  );

  const calendarContent = (
    <div className="flex-1 space-y-4">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {project ? (
            <CalendarHeaderWithDates
              currentDate={currentDate}
              onPreviousMonth={handlePreviousMonth}
              onNextMonth={handleNextMonth}
              onToday={handleToday}
              projectId={project.id}
              projectName={project.client_name}
              projectStartDate={project.start_date}
              projectEndDate={project.end_date}
              salesOrderUrl={project.sales_order_url}
              salesOrderNumber={project.sales_order_number}
              isAdmin={isAdmin}
              isMobile={isMobile}
            />
          ) : (
            <CalendarHeader
              currentDate={currentDate}
              onPreviousMonth={handlePreviousMonth}
              onNextMonth={handleNextMonth}
              onToday={handleToday}
            />
          )}
          {viewToggle}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {/* Manage Schedule button - admin only, requires project with dates */}
          {isAdmin && project?.start_date && project?.end_date && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMultiUserDialogOpen(true)}
              className="gap-2"
            >
              <Users className="h-4 w-4" />
              Manage Schedule
            </Button>
          )}
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as BookingStatus | 'all')}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pencil">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Pencil Only
                </div>
              </SelectItem>
              <SelectItem value="pending_confirm">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Pending Only
                </div>
              </SelectItem>
              <SelectItem value="confirmed">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  Confirmed Only
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          {/* Hide legend on mobile - visible in summary bar */}
          {!isMobile && <CalendarLegend />}
        </div>
      </div>

      {statusSummaryBar}

      {viewMode === 'gantt' && project ? (
        <GanttCalendar projectId={project.id} projectName={project.client_name} />
      ) : viewMode === 'week' && hasProjectDates ? (
        isLoading ? (
          <div className="flex items-center justify-center h-[500px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <WeekViewCalendar
            events={filteredEvents}
            projectStartDate={project!.start_date!}
            projectEndDate={project!.end_date!}
            onEventClick={handleEventClick}
            onStatusClick={handleStatusClick}
            onEditClick={!isMobile ? handleEditClick : undefined}
            isUpdatingAssignment={cycleStatus.isPending ? cycleStatus.variables : null}
            showEditButton={!isMobile}
          />
        )
      ) : isLoading ? (
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

      {/* Edit days dialog */}
      {selectedAssignment && project?.start_date && project?.end_date && (
        <AssignmentDaysDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          assignmentId={selectedAssignment.assignmentId}
          userName={selectedAssignment.userName}
          projectName={selectedAssignment.projectName}
          projectStartDate={project.start_date}
          projectEndDate={project.end_date}
        />
      )}

      {/* Multi-user schedule dialog */}
      {project?.start_date && project?.end_date && (
        <MultiUserAssignmentDialog
          open={multiUserDialogOpen}
          onOpenChange={setMultiUserDialogOpen}
          projectId={project.id}
          projectName={project.client_name}
          projectStartDate={project.start_date}
          projectEndDate={project.end_date}
        />
      )}
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
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4">
        <div className="flex-1 min-w-0 overflow-x-auto">
          {calendarContent}
        </div>
        {/* Hide sidebar on mobile - drag & drop not practical on touch */}
        {!isMobile && (
          <AssignmentSidebar
            users={assignableUsers}
            isLoading={isLoadingUsers}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        )}
      </div>

      <DragOverlay>
        {activeDragData && (
          <DraggingUserOverlay userName={activeDragData.userName} />
        )}
      </DragOverlay>
    </DndContext>
  );
}
