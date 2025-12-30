'use client';

import { useState, useTransition } from 'react';
import { ScheduleStatusBadge } from '@/components/projects/schedule-status-badge';
import { CascadeStatusDialog } from '@/components/calendar/cascade-status-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BOOKING_STATUS_CONFIG, BOOKING_STATUS_ORDER } from '@/lib/calendar/constants';
import {
  getProjectAssignmentsForCascade,
  updateProjectScheduleStatus,
  cascadeStatusToAssignments,
  type AssignmentForCascade,
} from '@/app/(dashboard)/calendar/actions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { BookingStatus } from '@/types/calendar';

interface ScheduleStatusWithCascadeProps {
  projectId: string;
  projectName: string;
  currentStatus: BookingStatus | null;
  hasProjectDates: boolean;
}

export function ScheduleStatusWithCascade({
  projectId,
  projectName,
  currentStatus,
  hasProjectDates,
}: ScheduleStatusWithCascadeProps) {
  const [status, setStatus] = useState<BookingStatus | null>(currentStatus);
  const [pendingStatus, setPendingStatus] = useState<BookingStatus | null>(null);
  const [assignments, setAssignments] = useState<AssignmentForCascade[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isCascading, setIsCascading] = useState(false);

  if (!hasProjectDates) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Schedule Status:</span>
        <span className="text-sm text-muted-foreground italic">Set project dates first</span>
      </div>
    );
  }

  const handleStatusChange = async (newStatus: BookingStatus) => {
    if (newStatus === status) return;

    // Fetch assignments first
    startTransition(async () => {
      const result = await getProjectAssignmentsForCascade(projectId);

      if (!result.success) {
        toast.error(result.error || 'Failed to fetch assignments');
        return;
      }

      setPendingStatus(newStatus);
      setAssignments(result.data?.assignments || []);
      setDialogOpen(true);
    });
  };

  const handleDialogClose = (open: boolean) => {
    if (!open && !isCascading) {
      // User cancelled - don't update anything
      setPendingStatus(null);
      setAssignments([]);
    }
    setDialogOpen(open);
  };

  const handleSkip = async () => {
    // Update only the project status, not user statuses
    if (!pendingStatus) return;

    setIsCascading(true);
    try {
      const result = await updateProjectScheduleStatus({
        projectId,
        newStatus: pendingStatus,
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to update schedule status');
        return;
      }

      setStatus(pendingStatus);
      toast.success('Schedule status updated (engineers unchanged)');
    } finally {
      setIsCascading(false);
      setDialogOpen(false);
      setPendingStatus(null);
      setAssignments([]);
    }
  };

  const handleCascade = async (selectedAssignmentIds: string[]) => {
    if (!pendingStatus) return;

    setIsCascading(true);
    try {
      // First update the project status
      const projectResult = await updateProjectScheduleStatus({
        projectId,
        newStatus: pendingStatus,
      });

      if (!projectResult.success) {
        toast.error(projectResult.error || 'Failed to update schedule status');
        return;
      }

      // Then cascade to selected assignments
      if (selectedAssignmentIds.length > 0) {
        const cascadeResult = await cascadeStatusToAssignments({
          projectId,
          newStatus: pendingStatus,
          assignmentIds: selectedAssignmentIds,
        });

        if (!cascadeResult.success) {
          toast.error(cascadeResult.error || 'Failed to update engineer statuses');
          return;
        }

        toast.success(
          `Updated schedule status and ${cascadeResult.data?.updatedCount} engineer${
            cascadeResult.data?.updatedCount !== 1 ? 's' : ''
          }`
        );
      } else {
        toast.success('Schedule status updated');
      }

      setStatus(pendingStatus);
    } finally {
      setIsCascading(false);
      setDialogOpen(false);
      setPendingStatus(null);
      setAssignments([]);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Schedule Status:</span>
        <Select
          value={status || undefined}
          onValueChange={(v) => handleStatusChange(v as BookingStatus)}
          disabled={isPending || isCascading}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select status">
              {status ? (
                <ScheduleStatusBadge status={status} size="sm" />
              ) : (
                <span className="text-muted-foreground">Select status</span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {BOOKING_STATUS_ORDER.map((s) => {
              const config = BOOKING_STATUS_CONFIG[s];
              return (
                <SelectItem key={s} value={s}>
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 rounded-full', config.dotColor)} />
                    <span>{config.label}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {pendingStatus && (
        <CascadeStatusDialog
          open={dialogOpen}
          onOpenChange={handleDialogClose}
          projectName={projectName}
          newStatus={pendingStatus}
          assignments={assignments}
          onConfirm={handleCascade}
          onSkip={handleSkip}
          isLoading={isCascading}
        />
      )}
    </>
  );
}
