'use client';

import { useState, useTransition } from 'react';
import { CalendarDays } from 'lucide-react';
import { ScheduleStatusSelect } from './schedule-status-select';
import { ScheduleStatusBadge } from './schedule-status-badge';
import { updateProjectScheduleStatus } from '@/app/(dashboard)/projects/actions';
import { toast } from 'sonner';
import type { BookingStatus } from '@/types/calendar';

interface ProjectScheduleStatusProps {
  projectId: string;
  currentStatus: BookingStatus | null;
  hasProjectDates: boolean;
}

/**
 * Client component for changing a project's schedule status
 * Wraps ScheduleStatusSelect with the server action
 */
export function ProjectScheduleStatus({
  projectId,
  currentStatus,
  hasProjectDates,
}: ProjectScheduleStatusProps) {
  const [status, setStatus] = useState<BookingStatus | null>(currentStatus);
  const [isPending, startTransition] = useTransition();

  const handleChange = (newStatus: BookingStatus) => {
    const oldStatus = status;
    setStatus(newStatus); // Optimistic update

    startTransition(async () => {
      const result = await updateProjectScheduleStatus({
        projectId,
        scheduleStatus: newStatus,
      });

      if (!result.success) {
        setStatus(oldStatus); // Revert on error
        toast.error(result.error || 'Failed to update schedule status');
      } else {
        toast.success('Schedule status updated');
      }
    });
  };

  if (!hasProjectDates) {
    return (
      <div className="flex items-center gap-3">
        <CalendarDays className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-sm text-muted-foreground">Schedule Status</p>
          <p className="text-sm text-muted-foreground italic">
            Set project dates first
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <CalendarDays className="h-5 w-5 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-sm text-muted-foreground mb-1">Schedule Status</p>
        <ScheduleStatusSelect
          value={status}
          onChange={handleChange}
          disabled={isPending}
          hasProjectDates={hasProjectDates}
        />
      </div>
    </div>
  );
}

/**
 * Read-only display of schedule status for non-editors
 */
export function ProjectScheduleStatusDisplay({
  status,
  hasProjectDates,
}: {
  status: BookingStatus | null;
  hasProjectDates: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <CalendarDays className="h-5 w-5 text-muted-foreground" />
      <div>
        <p className="text-sm text-muted-foreground">Schedule Status</p>
        {hasProjectDates ? (
          <ScheduleStatusBadge status={status} />
        ) : (
          <p className="text-sm text-muted-foreground italic">No dates set</p>
        )}
      </div>
    </div>
  );
}
