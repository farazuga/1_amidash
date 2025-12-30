'use client';

import { useState, useCallback } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BOOKING_STATUS_CONFIG } from '@/lib/calendar/constants';
import { BookingStatusBadge } from './booking-status-badge';
import type { BookingStatus } from '@/types/calendar';
import type { AssignmentForCascade } from '@/app/(dashboard)/calendar/actions';

interface CascadeStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  newStatus: BookingStatus;
  assignments: AssignmentForCascade[];
  onConfirm: (selectedAssignmentIds: string[]) => Promise<void>;
  isLoading?: boolean;
}

/**
 * Dialog to confirm cascading project schedule status to assigned engineers
 */
export function CascadeStatusDialog({
  open,
  onOpenChange,
  projectName,
  newStatus,
  assignments,
  onConfirm,
  isLoading = false,
}: CascadeStatusDialogProps) {
  // Start with all assignments selected
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(assignments.map((a) => a.id))
  );

  const config = BOOKING_STATUS_CONFIG[newStatus];

  const handleToggle = useCallback((assignmentId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(assignmentId);
      } else {
        next.delete(assignmentId);
      }
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    if (selectedIds.size === assignments.length) {
      // Deselect all
      setSelectedIds(new Set());
    } else {
      // Select all
      setSelectedIds(new Set(assignments.map((a) => a.id)));
    }
  }, [assignments, selectedIds.size]);

  const handleConfirm = async () => {
    await onConfirm(Array.from(selectedIds));
  };

  const allSelected = selectedIds.size === assignments.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < assignments.length;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Update Engineer Statuses?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                You&apos;re changing <strong>{projectName}</strong>&apos;s schedule status to{' '}
                <span className={cn('font-medium', config.textColor)}>{config.label}</span>.
              </p>
              <p>Would you like to update the assigned engineers as well?</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {assignments.length > 0 ? (
          <div className="space-y-3">
            {/* Select all toggle */}
            <div className="flex items-center gap-2 pb-2 border-b">
              <Checkbox
                id="select-all"
                checked={allSelected}
                onCheckedChange={handleToggleAll}
                className={someSelected ? 'data-[state=checked]:bg-primary/50' : ''}
              />
              <label
                htmlFor="select-all"
                className="text-sm font-medium cursor-pointer"
              >
                {allSelected ? 'Deselect all' : 'Select all'}
              </label>
              <span className="text-xs text-muted-foreground ml-auto">
                {selectedIds.size} of {assignments.length}
              </span>
            </div>

            {/* Assignment list */}
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center gap-3 py-1"
                >
                  <Checkbox
                    id={assignment.id}
                    checked={selectedIds.has(assignment.id)}
                    onCheckedChange={(checked) =>
                      handleToggle(assignment.id, checked as boolean)
                    }
                  />
                  <label
                    htmlFor={assignment.id}
                    className="flex-1 text-sm cursor-pointer truncate"
                  >
                    {assignment.userName}
                  </label>
                  <BookingStatusBadge
                    status={assignment.currentStatus}
                    size="sm"
                    showLabel={false}
                  />
                  <span className="text-muted-foreground">→</span>
                  <span className={cn('h-2 w-2 rounded-full', config.dotColor)} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No engineers are currently assigned to this project.
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            {assignments.length > 0 ? 'Skip' : 'Close'}
          </AlertDialogCancel>
          {assignments.length > 0 && (
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isLoading || selectedIds.size === 0}
              className="gap-2"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Update {selectedIds.size} Engineer{selectedIds.size !== 1 ? 's' : ''}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
