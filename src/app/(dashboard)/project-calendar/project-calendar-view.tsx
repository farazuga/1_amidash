'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  addDays,
  isToday,
  isSameMonth,
  isWeekend,
  parseISO,
  differenceInCalendarDays,
} from 'date-fns';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDraggable,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Loader2, Filter, X, AlertTriangle, GripVertical, Printer, Download, CheckSquare, CalendarDays, LayoutList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
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
import { ScheduleStatusBadge } from '@/components/projects/schedule-status-badge';
import { BOOKING_STATUS_CONFIG, BOOKING_STATUS_ORDER } from '@/lib/calendar/constants';
import { cn } from '@/lib/utils';
import { useProjectsWithDates, useProjectEngineers, useAllTags, type ProjectWithDetails } from './use-projects-with-dates';
import { useUpdateProjectDates } from './use-update-project-dates';
import { useBulkUpdateScheduleStatus } from './use-bulk-update-status';
import { ProjectCalendarMonthView } from './project-calendar-month-view';
import type { BookingStatus } from '@/types/calendar';

type ViewType = 'timeline' | 'month';

// Number of months to show
const MONTHS_TO_DISPLAY = 3;

// Draggable project bar component
interface DraggableProjectBarProps {
  project: ProjectWithDetails;
  position: {
    startIndex: number;
    endIndex: number;
    width: number;
    isClippedStart: boolean;
    isClippedEnd: boolean;
  };
  config: {
    bgColor: string;
    borderColor: string;
    textColor: string;
  };
  hasConflict: boolean;
  totalWeekdays: number;
}

function DraggableProjectBar({
  project,
  position,
  config,
  hasConflict,
  totalWeekdays,
}: DraggableProjectBarProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `project-${project.id}`,
    data: {
      type: 'project',
      project,
      originalPosition: position,
    },
  });

  const style = {
    left: `${(position.startIndex / totalWeekdays) * 100}%`,
    width: `${(position.width / totalWeekdays) * 100}%`,
    transform: transform
      ? `translate3d(${transform.x}px, 0, 0)`
      : undefined,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'absolute top-2 bottom-2 rounded-md',
        'border shadow-sm transition-all duration-150',
        // Depth effect with gradient overlay
        'before:absolute before:inset-0 before:rounded-md',
        'before:bg-gradient-to-b before:from-white/20 before:to-transparent',
        'before:pointer-events-none',
        config.bgColor,
        config.borderColor,
        // Enhanced hover state
        'hover:shadow-md hover:scale-[1.02] hover:-translate-y-0.5',
        position.isClippedStart && 'rounded-l-none before:rounded-l-none',
        position.isClippedEnd && 'rounded-r-none before:rounded-r-none',
        hasConflict && 'ring-2 ring-amber-500 ring-offset-1',
        isDragging && 'shadow-lg opacity-90 z-50'
      )}
      style={style}
      title={`${project.client_name}: ${project.start_date} to ${project.end_date}${hasConflict ? ' (has scheduling conflicts)' : ''} - Drag to move`}
    >
      <div className={cn(
        'relative z-10 px-2 py-1 text-xs font-medium truncate flex items-center gap-1',
        config.textColor
      )}>
        <GripVertical className="h-3 w-3 flex-shrink-0 opacity-50 print:hidden" />
        {hasConflict && <AlertTriangle className="h-3 w-3 flex-shrink-0 text-amber-600 print:hidden" />}
        {project.client_name}
      </div>
    </div>
  );
}

export function ProjectCalendarView() {
  const [startMonth, setStartMonth] = useState(() => startOfMonth(new Date()));
  const [viewType, setViewType] = useState<ViewType>('timeline');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string | 'all'>('all');
  const [engineerFilter, setEngineerFilter] = useState<string | 'all'>('all');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [newBulkStatus, setNewBulkStatus] = useState<BookingStatus>('draft');
  const timelineContainerRef = useRef<HTMLDivElement>(null);

  const { data: projects, isLoading, error } = useProjectsWithDates();
  const { data: engineers = [] } = useProjectEngineers();
  const { data: tags = [] } = useAllTags();
  const updateProjectDates = useUpdateProjectDates();
  const bulkUpdateStatus = useBulkUpdateScheduleStatus();

  // Configure drag sensors
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 5, // 5px before drag starts
    },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 200,
      tolerance: 5,
    },
  });
  const sensors = useSensors(mouseSensor, touchSensor);

  // Generate array of months to display
  const months = useMemo(() => {
    const monthArray = [];
    for (let i = 0; i < MONTHS_TO_DISPLAY; i++) {
      monthArray.push(addMonths(startMonth, i));
    }
    return monthArray;
  }, [startMonth]);

  // Generate weekdays for all months
  const allWeekdays = useMemo(() => {
    const firstMonth = months[0];
    const lastMonth = months[months.length - 1];
    const allDays = eachDayOfInterval({
      start: startOfMonth(firstMonth),
      end: endOfMonth(lastMonth),
    });
    return allDays.filter(day => !isWeekend(day));
  }, [months]);

  // Calculate position for a project bar
  const getProjectPosition = (startDate: string, endDate: string) => {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const rangeStart = allWeekdays[0];
    const rangeEnd = allWeekdays[allWeekdays.length - 1];

    // Check if project is visible in current range
    if (end < rangeStart || start > rangeEnd) {
      return null;
    }

    // Clamp to visible range
    const visibleStart = start < rangeStart ? rangeStart : start;
    const visibleEnd = end > rangeEnd ? rangeEnd : end;

    // Find indices in weekday array
    const startIndex = allWeekdays.findIndex(d =>
      d >= visibleStart && !isWeekend(d)
    );
    const endIndex = allWeekdays.findIndex(d =>
      d >= visibleEnd && !isWeekend(d)
    );

    if (startIndex === -1) return null;

    const actualEndIndex = endIndex === -1 ? allWeekdays.length - 1 : endIndex;

    return {
      startIndex,
      endIndex: actualEndIndex,
      width: actualEndIndex - startIndex + 1,
      isClippedStart: start < rangeStart,
      isClippedEnd: end > rangeEnd,
    };
  };

  const handlePrevious = () => setStartMonth(prev => subMonths(prev, 1));
  const handleNext = () => setStartMonth(prev => addMonths(prev, 1));
  const handleToday = () => setStartMonth(startOfMonth(new Date()));

  // Filter projects
  const filteredProjects = useMemo(() => {
    let result = (projects || []).filter(p => p.start_date && p.end_date);

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(p => (p.schedule_status || 'draft') === statusFilter);
    }

    // Filter by tag
    if (tagFilter !== 'all') {
      result = result.filter(p =>
        p.tags?.some(tag => tag.id === tagFilter)
      );
    }

    // Filter by engineer
    if (engineerFilter !== 'all') {
      result = result.filter(p =>
        p.assignments?.some(a => a.user_id === engineerFilter)
      );
    }

    return result;
  }, [projects, statusFilter, tagFilter, engineerFilter]);

  // Count active filters
  const activeFilterCount = [statusFilter, tagFilter, engineerFilter].filter(f => f !== 'all').length;

  // Clear all filters
  const clearFilters = () => {
    setStatusFilter('all');
    setTagFilter('all');
    setEngineerFilter('all');
  };

  // Detect engineer conflicts (same engineer on overlapping projects)
  const projectConflicts = useMemo(() => {
    const conflicts = new Map<string, { dates: Set<string>; engineers: Map<string, string[]> }>();

    // Build a map: engineer -> date -> [projectIds]
    const engineerDateMap = new Map<string, Map<string, string[]>>();

    for (const project of filteredProjects) {
      if (!project.start_date || !project.end_date || !project.assignments?.length) continue;

      const start = parseISO(project.start_date);
      const end = parseISO(project.end_date);
      const projectDates = eachDayOfInterval({ start, end }).filter(d => !isWeekend(d));

      for (const assignment of project.assignments) {
        if (!assignment.user_id) continue;

        if (!engineerDateMap.has(assignment.user_id)) {
          engineerDateMap.set(assignment.user_id, new Map());
        }
        const dateMap = engineerDateMap.get(assignment.user_id)!;

        for (const date of projectDates) {
          const dateStr = format(date, 'yyyy-MM-dd');
          if (!dateMap.has(dateStr)) {
            dateMap.set(dateStr, []);
          }
          dateMap.get(dateStr)!.push(project.id);
        }
      }
    }

    // Find conflicts: dates where an engineer is on multiple projects
    for (const [engineerId, dateMap] of engineerDateMap) {
      for (const [dateStr, projectIds] of dateMap) {
        if (projectIds.length > 1) {
          // This is a conflict - mark all involved projects
          for (const projectId of projectIds) {
            if (!conflicts.has(projectId)) {
              conflicts.set(projectId, { dates: new Set(), engineers: new Map() });
            }
            const projectConflict = conflicts.get(projectId)!;
            projectConflict.dates.add(dateStr);

            // Track which engineers have conflicts
            const engineer = engineers.find(e => e.id === engineerId);
            const engineerName = engineer?.full_name || 'Unknown';
            if (!projectConflict.engineers.has(engineerId)) {
              projectConflict.engineers.set(engineerId, []);
            }
            projectConflict.engineers.get(engineerId)!.push(dateStr);
          }
        }
      }
    }

    return conflicts;
  }, [filteredProjects, engineers]);

  // Drag handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, delta } = event;
    setActiveDragId(null);

    if (!delta || Math.abs(delta.x) < 10) {
      // No significant movement
      return;
    }

    const data = active.data.current;
    if (!data || data.type !== 'project') return;

    const project = data.project as ProjectWithDetails;
    const container = timelineContainerRef.current;
    if (!container || !project.start_date || !project.end_date) return;

    // Calculate the weekday cell width
    const containerWidth = container.offsetWidth;
    const cellWidth = containerWidth / allWeekdays.length;

    // Calculate how many weekdays the drag moved
    const weekdaysMoved = Math.round(delta.x / cellWidth);

    if (weekdaysMoved === 0) return;

    // Calculate new dates by skipping weekends
    const currentStart = parseISO(project.start_date);
    const currentEnd = parseISO(project.end_date);
    const projectDuration = differenceInCalendarDays(currentEnd, currentStart);

    // Move dates, adjusting for weekends
    let newStart = currentStart;
    let daysToMove = Math.abs(weekdaysMoved);
    const direction = weekdaysMoved > 0 ? 1 : -1;

    while (daysToMove > 0) {
      newStart = addDays(newStart, direction);
      if (!isWeekend(newStart)) {
        daysToMove--;
      }
    }

    // Skip to next weekday if landed on weekend
    while (isWeekend(newStart)) {
      newStart = addDays(newStart, direction);
    }

    // Calculate new end date maintaining the same duration
    const newEnd = addDays(newStart, projectDuration);

    // Update the project dates
    updateProjectDates.mutate({
      projectId: project.id,
      startDate: format(newStart, 'yyyy-MM-dd'),
      endDate: format(newEnd, 'yyyy-MM-dd'),
    });
  }, [allWeekdays, updateProjectDates]);

  // Print handler
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Export to CSV
  const handleExportCSV = useCallback(() => {
    const headers = ['Project', 'Status', 'Start Date', 'End Date', 'Engineers', 'Tags'];
    const rows = filteredProjects.map(project => {
      const status = BOOKING_STATUS_CONFIG[(project.schedule_status as BookingStatus) || 'draft'].label;
      const engineers = project.assignments?.map(a => a.user?.full_name).filter(Boolean).join('; ') || '';
      const tags = project.tags?.map(t => t.name).join('; ') || '';
      return [
        project.client_name,
        status,
        project.start_date || '',
        project.end_date || '',
        engineers,
        tags,
      ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `project-calendar-${format(startMonth, 'yyyy-MM')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredProjects, startMonth]);

  // Toggle project selection
  const toggleProjectSelection = useCallback((projectId: string) => {
    setSelectedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  // Select all filtered projects
  const selectAllProjects = useCallback(() => {
    setSelectedProjects(new Set(filteredProjects.map(p => p.id)));
  }, [filteredProjects]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedProjects(new Set());
  }, []);

  // Handle bulk status update
  const handleBulkStatusUpdate = useCallback(() => {
    bulkUpdateStatus.mutate(
      {
        projectIds: Array.from(selectedProjects),
        scheduleStatus: newBulkStatus,
      },
      {
        onSuccess: () => {
          setBulkStatusDialogOpen(false);
          clearSelection();
        },
      }
    );
  }, [bulkUpdateStatus, selectedProjects, newBulkStatus, clearSelection]);

  // Count total conflicts
  const totalConflicts = projectConflicts.size;

  // Handle loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-[500px] text-destructive">
        Failed to load projects: {error.message}
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between print:justify-center">
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="icon" onClick={handlePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday}>
            Today
          </Button>
          <div className="h-6 w-px bg-border mx-2" />
          <div className="flex items-center rounded-md border">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewType === 'timeline' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewType('timeline')}
                  className="rounded-r-none h-8 px-3"
                  aria-label="Timeline view"
                  aria-pressed={viewType === 'timeline'}
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Timeline View</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewType === 'month' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewType('month')}
                  className="rounded-l-none h-8 px-3"
                  aria-label="Month view"
                  aria-pressed={viewType === 'month'}
                >
                  <CalendarDays className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Month View</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {viewType === 'timeline' ? (
            months.map((month, i) => (
              <span key={i} className="text-sm font-medium">
                {format(month, 'MMMM yyyy')}
              </span>
            ))
          ) : (
            <span className="text-sm font-medium">
              {format(startMonth, 'MMMM yyyy')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {totalConflicts > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-500 print:hidden">
              <AlertTriangle className="h-4 w-4" />
              <span>{totalConflicts} conflict{totalConflicts !== 1 ? 's' : ''}</span>
            </div>
          )}
          <div className="text-sm text-muted-foreground print:hidden">
            {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''} with dates
          </div>
          <div className="flex items-center gap-1 print:hidden">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={handleExportCSV} className="h-8 w-8">
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export to CSV</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={handlePrint} className="h-8 w-8">
                  <Printer className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Print calendar</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Filters - Enhanced styling, hidden when printing */}
      <div className={cn(
        "flex flex-wrap items-center gap-4 p-4",
        "bg-gradient-to-r from-muted/60 via-muted/40 to-transparent",
        "rounded-xl border border-dashed",
        "print:hidden"
      )}>
        <div className="flex items-center gap-2 text-primary">
          <Filter className="h-4 w-4" />
          <span className="text-sm font-semibold uppercase tracking-wide">Filters</span>
        </div>
        <div className="h-6 w-px bg-border" />

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as BookingStatus | 'all')}>
          <SelectTrigger className="w-full sm:w-[150px] h-8">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {BOOKING_STATUS_ORDER.map(status => {
              const config = BOOKING_STATUS_CONFIG[status];
              return (
                <SelectItem key={status} value={status}>
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 rounded-full', config.dotColor)} />
                    {config.label}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Tag Filter */}
        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger className="w-full sm:w-[150px] h-8">
            <SelectValue placeholder="All Tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tags</SelectItem>
            {tags.map(tag => (
              <SelectItem key={tag.id} value={tag.id}>
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: tag.color || '#888' }}
                  />
                  {tag.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Engineer Filter */}
        <Select value={engineerFilter} onValueChange={setEngineerFilter}>
          <SelectTrigger className="w-full sm:w-[180px] h-8">
            <SelectValue placeholder="All Engineers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Engineers</SelectItem>
            {engineers.map(engineer => (
              <SelectItem key={engineer.id} value={engineer.id}>
                {engineer.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-8 gap-1"
          >
            <X className="h-3 w-3" />
            Clear ({activeFilterCount})
          </Button>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedProjects.size > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-muted/50 border rounded-lg print:hidden">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              {selectedProjects.size} project{selectedProjects.size !== 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={newBulkStatus} onValueChange={(v) => setNewBulkStatus(v as BookingStatus)}>
              <SelectTrigger className="w-full sm:w-[150px] h-8">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {BOOKING_STATUS_ORDER.map(status => {
                  const config = BOOKING_STATUS_CONFIG[status];
                  return (
                    <SelectItem key={status} value={status}>
                      <div className="flex items-center gap-2">
                        <span className={cn('h-2 w-2 rounded-full', config.dotColor)} />
                        {config.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={() => setBulkStatusDialogOpen(true)}
              disabled={bulkUpdateStatus.isPending}
            >
              Update Status
            </Button>
          </div>
          <div className="hidden sm:block flex-1" />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={selectAllProjects} className="h-8 text-xs sm:text-sm">
              Select All ({filteredProjects.length})
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection} className="h-8 text-xs sm:text-sm">
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Legend - Interactive status filter pills */}
      <div className="flex flex-wrap items-center gap-2 bg-muted/50 rounded-lg sm:rounded-full px-3 sm:px-4 py-2 border">
        <span className="text-xs font-medium text-muted-foreground mr-2 uppercase tracking-wide">Status:</span>
        {BOOKING_STATUS_ORDER.map(status => {
          const config = BOOKING_STATUS_CONFIG[status];
          const isActive = statusFilter === status;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(isActive ? 'all' : status)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full',
                'text-xs font-medium transition-all duration-200',
                isActive
                  ? `${config.bgColor} ${config.textColor} shadow-sm ring-2 ${config.ringColor}`
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              <span className={cn(
                'h-2 w-2 rounded-full transition-transform',
                config.dotColor,
                isActive && 'scale-125'
              )} />
              <span>{config.label}</span>
            </button>
          );
        })}
      </div>

      {/* Calendar View */}
      {viewType === 'month' ? (
        <ProjectCalendarMonthView
          projects={filteredProjects}
          currentMonth={startMonth}
        />
      ) : (
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
      <div className="border rounded-lg overflow-x-auto">
        {/* Month headers */}
        <div className="flex bg-muted border-b min-w-[800px]">
          <div className="w-48 sm:w-64 flex-shrink-0 p-2 font-medium border-r">
            Project
          </div>
          <div className="flex-1 flex" ref={timelineContainerRef}>
            {months.map((month, monthIndex) => {
              const monthWeekdays = allWeekdays.filter(d => isSameMonth(d, month));
              const widthPercent = (monthWeekdays.length / allWeekdays.length) * 100;
              return (
                <div
                  key={monthIndex}
                  className="text-center text-sm font-medium py-2 border-r last:border-r-0"
                  style={{ width: `${widthPercent}%` }}
                >
                  {format(month, 'MMMM yyyy')}
                </div>
              );
            })}
          </div>
        </div>

        {/* Day headers */}
        <div className="flex bg-muted/50 border-b min-w-[800px]">
          <div className="w-48 sm:w-64 flex-shrink-0 p-1 text-xs text-muted-foreground border-r">
            &nbsp;
          </div>
          <div className="flex-1 flex">
            {allWeekdays.map((day, i) => (
              <div
                key={i}
                className={cn(
                  'flex-1 text-center text-[10px] py-1 border-r last:border-r-0',
                  isToday(day) && 'bg-primary/10 font-medium text-primary'
                )}
              >
                {format(day, 'd')}
              </div>
            ))}
          </div>
        </div>

        {/* Project rows */}
        {filteredProjects.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No projects with dates scheduled.
          </div>
        ) : (
          filteredProjects.map((project) => {
            const position = getProjectPosition(project.start_date!, project.end_date!);
            const status = (project.schedule_status as BookingStatus) || 'draft';
            const config = BOOKING_STATUS_CONFIG[status];
            const conflict = projectConflicts.get(project.id);
            const hasConflict = !!conflict;

            // Get conflict tooltip content
            const conflictTooltip = hasConflict ? (() => {
              const engineerConflicts: string[] = [];
              for (const [engineerId, dates] of conflict.engineers) {
                const engineer = engineers.find(e => e.id === engineerId);
                const name = engineer?.full_name || 'Unknown';
                engineerConflicts.push(`${name}: ${dates.length} day${dates.length > 1 ? 's' : ''}`);
              }
              return engineerConflicts.join('\n');
            })() : '';

            const isSelected = selectedProjects.has(project.id);

            return (
              <div key={project.id} className={cn(
                'flex border-b last:border-b-0 hover:bg-muted/30 min-w-[800px]',
                hasConflict && 'bg-amber-50/50 dark:bg-amber-950/20',
                isSelected && 'bg-primary/5'
              )}>
                {/* Project name */}
                <div className="w-48 sm:w-64 flex-shrink-0 p-2 border-r">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleProjectSelection(project.id)}
                      className="flex-shrink-0 print:hidden"
                    />
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-medium text-sm hover:underline truncate"
                    >
                      {project.client_name}
                    </Link>
                    {hasConflict && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex-shrink-0">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <div className="text-xs">
                            <div className="font-medium mb-1">Engineer Conflicts:</div>
                            <div className="whitespace-pre-line">{conflictTooltip}</div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <ScheduleStatusBadge status={status} size="sm" />
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(project.start_date!), 'MMM d')} - {format(new Date(project.end_date!), 'MMM d')}
                    </span>
                  </div>
                </div>

                {/* Timeline */}
                <div className="flex-1 relative h-14">
                  {/* Grid lines */}
                  <div className="absolute inset-0 flex">
                    {allWeekdays.map((day, i) => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const isConflictDate = conflict?.dates.has(dateStr);
                      return (
                        <div
                          key={i}
                          className={cn(
                            'flex-1 border-r last:border-r-0',
                            isToday(day) && 'bg-primary/5',
                            isConflictDate && 'bg-amber-200/40 dark:bg-amber-800/20'
                          )}
                        />
                      );
                    })}
                  </div>

                  {/* Today line */}
                  {allWeekdays.some(d => isToday(d)) && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-primary z-10"
                      style={{
                        left: `${((allWeekdays.findIndex(d => isToday(d)) + 0.5) / allWeekdays.length) * 100}%`,
                      }}
                    />
                  )}

                  {/* Project bar - draggable */}
                  {position && (
                    <DraggableProjectBar
                      project={project}
                      position={position}
                      config={config}
                      hasConflict={hasConflict}
                      totalWeekdays={allWeekdays.length}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      </DndContext>
      )}
    </div>

    {/* Bulk Status Update Confirmation Dialog */}
    <AlertDialog open={bulkStatusDialogOpen} onOpenChange={setBulkStatusDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Update Schedule Status</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to change the schedule status of{' '}
            <strong>{selectedProjects.size} project{selectedProjects.size !== 1 ? 's' : ''}</strong>{' '}
            to <strong>{BOOKING_STATUS_CONFIG[newBulkStatus].label}</strong>?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleBulkStatusUpdate}
            disabled={bulkUpdateStatus.isPending}
          >
            {bulkUpdateStatus.isPending ? 'Updating...' : 'Update Status'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </TooltipProvider>
  );
}
