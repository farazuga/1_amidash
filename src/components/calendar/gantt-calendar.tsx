'use client';

import { useState, useMemo, useCallback } from 'react';
import { format, addDays, startOfWeek, addWeeks, subWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight, Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GanttRow } from './gantt-row';
import { CalendarLegend } from './calendar-legend';
import { AssignmentDaysDialog } from './assignment-days-dialog';
import { cn } from '@/lib/utils';
import { useProjectGanttData, useCycleAssignmentStatus } from '@/hooks/queries/use-assignments';
import type { GanttAssignment } from '@/types/calendar';
import { toast } from 'sonner';

interface GanttCalendarProps {
  projectId: string;
  projectName?: string;
  projectStartDate?: string | null;
  projectEndDate?: string | null;
}

export function GanttCalendar({ projectId, projectName, projectStartDate, projectEndDate }: GanttCalendarProps) {
  // View state - start at project date if available, otherwise current week
  const [viewStartDate, setViewStartDate] = useState(() => {
    if (projectStartDate) {
      const startDate = new Date(projectStartDate + 'T00:00:00');
      return startOfWeek(startDate, { weekStartsOn: 1 }); // Start on Monday of project week
    }
    const today = new Date();
    return startOfWeek(today, { weekStartsOn: 1 }); // Start on Monday
  });

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<GanttAssignment | null>(null);

  const viewEndDate = useMemo(() => {
    return addDays(viewStartDate, 13); // 2 weeks (14 days)
  }, [viewStartDate]);

  const totalDays = 14;

  // Fetch Gantt data
  const { data: ganttAssignments = [], isLoading, refetch } = useProjectGanttData(projectId);
  const cycleStatus = useCycleAssignmentStatus();

  // Group assignments by user for display
  const assignmentsByUser = useMemo(() => {
    const grouped = new Map<string, GanttAssignment[]>();
    for (const assignment of ganttAssignments) {
      const existing = grouped.get(assignment.userId) || [];
      existing.push(assignment);
      grouped.set(assignment.userId, existing);
    }
    return grouped;
  }, [ganttAssignments]);

  // Generate day headers
  const dayHeaders = useMemo(() => {
    const headers: { date: Date; label: string; dayOfWeek: string; isToday: boolean; isWeekend: boolean }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < totalDays; i++) {
      const date = addDays(viewStartDate, i);
      const dayOfWeek = date.getDay();
      headers.push({
        date,
        label: format(date, 'd'),
        dayOfWeek: format(date, 'EEE'),
        isToday: date.getTime() === today.getTime(),
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      });
    }
    return headers;
  }, [viewStartDate, totalDays]);

  // Navigation handlers
  const handlePrevWeek = useCallback(() => {
    setViewStartDate((prev) => subWeeks(prev, 1));
  }, []);

  const handleNextWeek = useCallback(() => {
    setViewStartDate((prev) => addWeeks(prev, 1));
  }, []);

  const handleToday = useCallback(() => {
    setViewStartDate(startOfWeek(new Date(), { weekStartsOn: 1 }));
  }, []);

  // Status cycle handler
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

  // Edit days handler
  const handleEditClick = useCallback((assignment: GanttAssignment) => {
    setSelectedAssignment(assignment);
    setEditDialogOpen(true);
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">
            {format(viewStartDate, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handlePrevWeek}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={handleToday}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleNextWeek}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CalendarLegend />
      </div>

      {/* Gantt Chart */}
      <div className="border rounded-lg overflow-hidden">
        {/* Day headers */}
        <div
          className="grid bg-muted border-b"
          style={{
            gridTemplateColumns: `150px repeat(${totalDays}, minmax(0, 1fr))`,
          }}
        >
          {/* User column header */}
          <div className="flex items-center gap-2 px-3 py-2 border-r font-medium text-sm">
            <Users className="h-4 w-4" />
            Assigned
          </div>

          {/* Day headers */}
          {dayHeaders.map((day, i) => (
            <div
              key={i}
              className={cn(
                'px-1 py-2 text-center border-r last:border-r-0',
                day.isWeekend && 'bg-muted-foreground/5',
                day.isToday && 'bg-primary/10'
              )}
            >
              <div className="text-xs text-muted-foreground">{day.dayOfWeek}</div>
              <div
                className={cn(
                  'text-sm font-medium',
                  day.isToday && 'text-primary'
                )}
              >
                {day.label}
              </div>
            </div>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : assignmentsByUser.size === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            No assignments yet. Drag users from the sidebar to assign them.
          </div>
        ) : (
          <div className="divide-y">
            {Array.from(assignmentsByUser.entries()).map(([userId, assignments]) => {
              const userName = assignments[0]?.userName || 'Unknown';

              return (
                <div
                  key={userId}
                  className="grid"
                  style={{
                    gridTemplateColumns: `150px 1fr`,
                  }}
                >
                  {/* User name */}
                  <div className="flex items-center px-3 py-2 border-r bg-background">
                    <span className="text-sm font-medium truncate" title={userName}>
                      {userName}
                    </span>
                  </div>

                  {/* Assignment row(s) for this user */}
                  <div className="relative">
                    {assignments.map((assignment) => (
                      <GanttRow
                        key={assignment.assignmentId}
                        assignment={assignment}
                        viewStartDate={viewStartDate}
                        viewEndDate={viewEndDate}
                        totalDays={totalDays}
                        onStatusClick={handleStatusClick}
                        onEditClick={handleEditClick}
                        isUpdating={cycleStatus.isPending}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Help text */}
      <p className="text-xs text-muted-foreground">
        Click bar to cycle status • Hover and click pencil icon to edit days & times
      </p>

      {/* Edit Days Dialog */}
      {selectedAssignment && (
        <AssignmentDaysDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          assignmentId={selectedAssignment.assignmentId}
          userName={selectedAssignment.userName}
          projectName={selectedAssignment.projectName}
          projectStartDate={selectedAssignment.projectStartDate || ''}
          projectEndDate={selectedAssignment.projectEndDate || ''}
        />
      )}
    </div>
  );
}
