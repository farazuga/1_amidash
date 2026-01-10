'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  rectIntersection,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CalendarHeader } from './calendar-header';
import { CalendarHeaderWithDates } from './calendar-header-with-dates';
import { AssignmentCard } from './assignment-card';
import { useUser } from '@/hooks/use-user';
import { CalendarDayCell } from './calendar-day-cell';
import { DroppableDayCell } from './droppable-day-cell';
import { CalendarLegend } from './calendar-legend';
import { AssignmentDialog } from './assignment-dialog';
import { AssignmentSidebar } from './assignment-sidebar';
import { DraggingUserOverlay } from './draggable-user';
import { WEEKDAYS, BOOKING_STATUS_CONFIG, DEFAULT_WORK_TIMES } from '@/lib/calendar/constants';
import {
  getCalendarDays,
  getMonthViewRange,
  getNextMonth,
  getPreviousMonth,
  getEventsForDay,
  sortEventsByStatus,
  convertToCalendarEvents,
} from '@/lib/calendar/utils';
import { useCalendarData, useAssignableUsers, useCreateAssignment, useCycleAssignmentStatus, useBulkUpdateAssignmentStatus, useMoveAssignmentDay, useAddAssignmentDays, useRemoveAssignmentDays } from '@/hooks/queries/use-assignments';
import { AssignmentDaysDialog } from './assignment-days-dialog';
import { MultiUserAssignmentDialog } from './multi-user-assignment-dialog';
import { SendConfirmationDialog } from './send-confirmation-dialog';
import { ConflictsPanel } from './conflicts-panel';
import { KeyboardShortcutsHelp } from './keyboard-shortcuts-help';
import { useUndo } from '@/hooks/use-undo';
import { useUndoStore } from '@/stores/undo-store';
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
import { Loader2, LayoutGrid, GanttChart, CalendarDays, Users, Mail, Copy } from 'lucide-react';
import { GanttCalendar } from './gantt-calendar';
import { WeekViewCalendar } from './week-view-calendar';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  // Initialize currentDate to project start date if available, otherwise today
  const [currentDate, setCurrentDate] = useState(() => {
    if (project?.start_date) {
      return new Date(project.start_date + 'T00:00:00');
    }
    return new Date();
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Auto-collapse sidebar on smaller screens
  useEffect(() => {
    if (!isLargeScreen && !sidebarCollapsed) {
      setSidebarCollapsed(true);
    }
  }, [isLargeScreen, sidebarCollapsed]);

  // Navigate to project start date when project changes
  useEffect(() => {
    if (project?.start_date) {
      setCurrentDate(new Date(project.start_date + 'T00:00:00'));
    }
  }, [project?.start_date]);

  // Smart default: week view if project has dates, month view otherwise
  const [viewMode, setViewMode] = useState<'calendar' | 'week' | 'gantt'>(() => {
    if (project?.start_date && project?.end_date) {
      return 'week';
    }
    return 'calendar';
  });
  const [activeDragData, setActiveDragData] = useState<{
    type: 'user' | 'move-assignment';
    userId: string;
    userName: string | null;
    event?: CalendarEvent;
    isCopy?: boolean;
    dayId?: string;
    originalDate?: string;
    assignmentId?: string;
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<CalendarEvent | null>(null);
  const [multiUserDialogOpen, setMultiUserDialogOpen] = useState(false);
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const [confirmationAssignment, setConfirmationAssignment] = useState<CalendarEvent | null>(null);
  const [bulkStatusDialog, setBulkStatusDialog] = useState<{
    open: boolean;
    targetStatus: BookingStatus | null;
  }>({ open: false, targetStatus: null });

  const { start, end } = getMonthViewRange(currentDate);
  const days = getCalendarDays(currentDate);

  const { data: calendarAssignments, isLoading, isError, error } = useCalendarData(start, end, {
    projectId: project?.id,
  });

  // Use assignable users instead of just admin users
  const { data: assignableUsers = [], isLoading: isLoadingUsers } = useAssignableUsers();
  const createAssignment = useCreateAssignment();
  const cycleStatus = useCycleAssignmentStatus();
  const bulkUpdateStatus = useBulkUpdateAssignmentStatus();
  const moveAssignmentDay = useMoveAssignmentDay();
  const addAssignmentDays = useAddAssignmentDays();
  const removeAssignmentDays = useRemoveAssignmentDays();

  // Undo functionality
  const { pushAction } = useUndoStore();
  useUndo(); // This registers the keyboard shortcut listener

  // Convert assignments to calendar events with scheduled days
  const events = useMemo(() => {
    if (!calendarAssignments?.data) return [];
    // Convert scheduledDaysMap Record to Map
    const scheduledDaysMap = new Map<string, string[]>(
      Object.entries(calendarAssignments.scheduledDaysMap || {})
    );
    return convertToCalendarEvents(calendarAssignments.data, new Map(), scheduledDaysMap);
  }, [calendarAssignments]);

  // Extract scheduledDaysWithIds for drag-drop support
  const scheduledDaysWithIds = calendarAssignments?.scheduledDaysWithIds || {};

  // Calculate status counts for summary bar
  const statusCounts = useMemo(() => {
    const counts: Record<BookingStatus | 'total', number> = {
      draft: 0,
      tentative: 0,
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

  // Get assigned user IDs for sidebar indicator
  const assignedUserIds = useMemo(() => {
    return new Set(events.map((e) => e.userId));
  }, [events]);

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

  // Handle Option+click to delete a day (quick delete without confirmation)
  const handleOptionClickDelete = useCallback(async (dayId: string, event: CalendarEvent, date: string) => {
    try {
      await removeAssignmentDays.mutateAsync([dayId]);

      // Record action for undo
      pushAction({
        type: 'remove-day',
        description: `Removed ${event.userName} from ${date}`,
        data: {
          assignmentId: event.assignmentId,
          date,
          startTime: DEFAULT_WORK_TIMES.startTime,
          endTime: DEFAULT_WORK_TIMES.endTime,
          userName: event.userName,
        },
      });

      toast.success('Day removed', {
        description: `Removed ${event.userName} from this day`,
      });
    } catch (error) {
      toast.error('Failed to remove day', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    }
  }, [removeAssignmentDays, pushAction]);

  const handleSendConfirmation = useCallback((event: CalendarEvent) => {
    setConfirmationAssignment(event);
    setConfirmationDialogOpen(true);
  }, []);

  // Handle bulk status click (clicking on status in summary bar)
  const handleBulkStatusClick = useCallback((status: BookingStatus) => {
    // Don't open dialog if all assignments are already at this status
    if (statusCounts[status] === statusCounts.total) return;
    setBulkStatusDialog({ open: true, targetStatus: status });
  }, [statusCounts]);

  // Confirm bulk status change
  const confirmBulkStatusChange = useCallback(async () => {
    if (!bulkStatusDialog.targetStatus || !project) return;

    // Get unique assignment IDs from events
    const assignmentIds = [...new Set(events.map(e => e.assignmentId))];
    if (assignmentIds.length === 0) return;

    try {
      const result = await bulkUpdateStatus.mutateAsync({
        assignmentIds,
        newStatus: bulkStatusDialog.targetStatus,
      });

      const statusLabel = BOOKING_STATUS_CONFIG[bulkStatusDialog.targetStatus].label;
      toast.success(`Assignments updated`, {
        description: `${result.updatedCount} assignment(s) changed to ${statusLabel}`,
      });
      setBulkStatusDialog({ open: false, targetStatus: null });
    } catch (error) {
      toast.error('Failed to update assignments', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    }
  }, [bulkStatusDialog.targetStatus, project, bulkUpdateStatus, events]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    // Check if Cmd (Mac) or Ctrl (Windows) is pressed for copy operation
    const nativeEvent = event.activatorEvent as MouseEvent | TouchEvent | KeyboardEvent;
    const isCopy = 'metaKey' in nativeEvent ? nativeEvent.metaKey || nativeEvent.ctrlKey : false;

    if (active.data.current?.type === 'user') {
      setActiveDragData({
        type: 'user',
        userId: active.data.current.userId,
        userName: active.data.current.userName,
      });
    } else if (active.data.current?.type === 'move-assignment') {
      setActiveDragData({
        type: 'move-assignment',
        userId: active.data.current.userId,
        userName: active.data.current.userName,
        event: active.data.current.event,
        isCopy,
        dayId: active.data.current.dayId,
        originalDate: active.data.current.originalDate,
        assignmentId: active.data.current.assignmentId,
      });
    }
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      const dragData = activeDragData; // Capture before clearing
      setActiveDragData(null);

      if (!over || !project) {
        return;
      }

      // Handle moving or copying an existing assignment to a new day
      if (over.data.current?.type === 'day' && active.data.current?.type === 'move-assignment') {
        const { dayId, originalDate, userName, assignmentId } = active.data.current;
        const newDate = over.data.current.date;
        const newDateStr = newDate.toISOString().split('T')[0];
        const isCopy = dragData?.isCopy || false;

        // Don't move/copy if dropped on the same day (unless copying, which would create a duplicate)
        if (originalDate === newDateStr && !isCopy) {
          return;
        }

        try {
          if (isCopy) {
            // Copy: Add a new day to the assignment
            const result = await addAssignmentDays.mutateAsync({
              assignmentId,
              days: [{
                date: newDateStr,
                startTime: DEFAULT_WORK_TIMES.startTime,
                endTime: DEFAULT_WORK_TIMES.endTime,
              }],
            });

            // Record action for undo (use the first day ID if available)
            const newDayId = result[0]?.id;
            if (newDayId) {
              pushAction({
                type: 'copy-day',
                description: `Copied ${userName} to ${newDateStr}`,
                data: {
                  assignmentId,
                  dayId: newDayId,
                  date: newDateStr,
                  userName: userName ?? 'Unknown',
                },
              });
            }

            toast.success('Assignment copied', {
              description: `${userName} copied to ${newDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
            });
          } else {
            // Move: Change the existing day's date
            await moveAssignmentDay.mutateAsync({
              dayId,
              newDate: newDateStr,
            });

            // Record action for undo
            pushAction({
              type: 'move-day',
              description: `Moved ${userName} from ${originalDate} to ${newDateStr}`,
              data: {
                dayId,
                originalDate,
                newDate: newDateStr,
                userName: userName ?? 'Unknown',
              },
            });

            toast.success('Assignment moved', {
              description: `${userName} moved to ${newDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
            });
          }
        } catch (error) {
          toast.error(`Failed to ${isCopy ? 'copy' : 'move'} assignment`, {
            description: error instanceof Error ? error.message : 'An error occurred',
          });
        }
        return;
      }

      // Handle assigning a new user from the sidebar
      if (over.data.current?.type === 'day' && active.data.current?.type === 'user') {
        const userId = active.data.current.userId;
        const userName = active.data.current.userName;
        const droppedDate = over.data.current.date;
        const droppedDateStr = droppedDate.toISOString().split('T')[0];

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
            bookingStatus: 'draft' as BookingStatus,
          });

          // Add the dropped date as a scheduled day so it appears on the calendar
          if (result.assignment) {
            try {
              await addAssignmentDays.mutateAsync({
                assignmentId: result.assignment.id,
                days: [{
                  date: droppedDateStr,
                  startTime: DEFAULT_WORK_TIMES.startTime,
                  endTime: DEFAULT_WORK_TIMES.endTime,
                }],
              });
            } catch (dayError) {
              // Log but don't fail - assignment was created successfully
              console.error('Failed to add initial scheduled day:', dayError);
            }
          }

          if (result.conflicts?.hasConflicts) {
            toast.warning(`${userName} assigned with conflicts`, {
              description: `There are scheduling conflicts. Review in the assignment details.`,
            });
          } else {
            toast.success(`${userName} assigned`, {
              description: `Added to ${project.client_name} on ${droppedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
            });
          }
        } catch (error) {
          toast.error('Failed to assign user', {
            description: error instanceof Error ? error.message : 'An error occurred',
          });
        }
      }
    },
    [project, createAssignment, moveAssignmentDay, addAssignmentDays, activeDragData, pushAction]
  );

  const renderCalendarGrid = () => (
    <div className="border rounded-lg overflow-hidden">
      {/* Weekday headers (Mon-Fri only) */}
      <div className="grid grid-cols-5 bg-muted">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="p-2 text-center text-sm font-medium border-r last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid (weekdays only) */}
      <div className="grid grid-cols-5">
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
                onOptionClickDelete={isAdmin ? handleOptionClickDelete : undefined}
                isUpdatingAssignment={cycleStatus.isPending ? cycleStatus.variables : null}
                showEditButton={!isMobile}
                projectStartDate={project?.start_date}
                projectEndDate={project?.end_date}
                enableDragMove={isAdmin}
                scheduledDaysWithIds={scheduledDaysWithIds}
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

  // Status summary bar component - clickable to bulk change status
  const statusSummaryBar = statusCounts.total > 0 && (
    <div className="flex items-center gap-2 text-sm bg-muted/50 p-2 rounded-lg">
      {(['draft', 'tentative', 'pending_confirm', 'confirmed'] as const).map((status) => {
        const config = BOOKING_STATUS_CONFIG[status];
        const count = statusCounts[status];
        const isCurrentStatus = count === statusCounts.total;
        return (
          <button
            key={status}
            onClick={() => isAdmin && project && handleBulkStatusClick(status)}
            disabled={!isAdmin || !project || isCurrentStatus}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
              isAdmin && project && !isCurrentStatus
                ? 'hover:bg-muted cursor-pointer'
                : 'cursor-default'
            } ${isCurrentStatus ? 'opacity-50' : ''}`}
            title={isAdmin && project ? `Change all to ${config.label}` : undefined}
          >
            <span className={`h-3 w-3 rounded-full ${config.dotColor}`} />
            <span className="font-medium">{count}</span>
            <span className="text-muted-foreground">{config.label}</span>
          </button>
        );
      })}
      <span className="text-muted-foreground ml-auto">
        {statusCounts.total} total assignment{statusCounts.total !== 1 ? 's' : ''}
      </span>
    </div>
  );

  const calendarContent = (
    <div className="flex-1 space-y-4">
      {/* Row 1: Navigation + Views on left, Status filter on right */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
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
          {/* Keyboard shortcuts help - only shown when drag drop is enabled */}
          {enableDragDrop && isAdmin && <KeyboardShortcutsHelp />}
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as BookingStatus | 'all')}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-gray-400" />
                Draft Only
              </div>
            </SelectItem>
            <SelectItem value="tentative">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Tentative Only
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
      </div>

      {/* Row 2: Action buttons on left, Status summary on right */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
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
          {/* Send to Customer button - admin only, when there are tentative assignments */}
          {isAdmin && project && statusCounts.tentative > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setConfirmationAssignment(events.find(e => e.bookingStatus === 'tentative') || null);
                setConfirmationDialogOpen(true);
              }}
              className="gap-2"
            >
              <Mail className="h-4 w-4" />
              Send to Customer ({statusCounts.tentative})
            </Button>
          )}
          {/* Conflicts Panel - admin only */}
          {isAdmin && <ConflictsPanel />}
        </div>
        {statusSummaryBar}
      </div>

      {isError ? (
        <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground">
          <p className="text-destructive font-medium">Failed to load calendar data</p>
          <p className="text-sm mt-1">{error instanceof Error ? error.message : 'An error occurred'}</p>
        </div>
      ) : viewMode === 'gantt' && project ? (
        <GanttCalendar
          projectId={project.id}
          projectName={project.client_name}
          projectStartDate={project.start_date}
          projectEndDate={project.end_date}
        />
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
            enableDragDrop={enableDragDrop}
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

      {/* Send confirmation dialog */}
      {project && confirmationAssignment && (
        <SendConfirmationDialog
          open={confirmationDialogOpen}
          onOpenChange={setConfirmationDialogOpen}
          projectId={project.id}
          projectName={project.client_name}
          assignments={events.filter(e => e.bookingStatus === 'tentative')}
          customerEmail={project.poc_email || undefined}
          customerName={project.poc_name || undefined}
        />
      )}

      {/* Bulk status change confirmation dialog */}
      <AlertDialog
        open={bulkStatusDialog.open}
        onOpenChange={(open) => !open && setBulkStatusDialog({ open: false, targetStatus: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change all assignments?</AlertDialogTitle>
            <AlertDialogDescription>
              This will change {statusCounts.total} assignment{statusCounts.total !== 1 ? 's' : ''} to &quot;{bulkStatusDialog.targetStatus && BOOKING_STATUS_CONFIG[bulkStatusDialog.targetStatus].label}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkStatusChange}
              disabled={bulkUpdateStatus.isPending}
            >
              {bulkUpdateStatus.isPending ? 'Updating...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
      collisionDetection={rectIntersection}
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
            assignedUserIds={assignedUserIds}
          />
        )}
      </div>

      <DragOverlay>
        {activeDragData?.type === 'user' && (
          <DraggingUserOverlay userName={activeDragData.userName} />
        )}
        {activeDragData?.type === 'move-assignment' && activeDragData.event && (
          <div className="relative opacity-80 pointer-events-none">
            <AssignmentCard
              event={activeDragData.event}
              compact
            />
            {activeDragData.isCopy && (
              <div className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                <Copy className="h-3 w-3" />
              </div>
            )}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
