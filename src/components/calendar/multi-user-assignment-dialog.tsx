'use client';

import { useState, useMemo, useEffect } from 'react';
import { format, eachDayOfInterval, parseISO, isWeekend } from 'date-fns';
import { Users, Loader2, Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useProjectAssignments,
  useAddAssignmentDays,
  useRemoveAssignmentDays,
} from '@/hooks/queries/use-assignments';
import type { AssignmentDay } from '@/types/calendar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MultiUserAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  projectStartDate: string;
  projectEndDate: string;
}

type ChangeAction = 'add' | 'remove';
type ChangeMap = Map<string, Map<string, ChangeAction>>; // assignmentId -> dateStr -> action

export function MultiUserAssignmentDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  projectStartDate,
  projectEndDate,
}: MultiUserAssignmentDialogProps) {
  const { data: assignments = [], isLoading, refetch } = useProjectAssignments(projectId);
  const addDays = useAddAssignmentDays();
  const removeDays = useRemoveAssignmentDays();

  // Track pending changes before saving
  const [pendingChanges, setPendingChanges] = useState<ChangeMap>(new Map());
  const [isSaving, setIsSaving] = useState(false);

  // Reset changes when dialog opens
  useEffect(() => {
    if (open) {
      setPendingChanges(new Map());
      refetch();
    }
  }, [open, refetch]);

  // Generate all project dates
  const projectDates = useMemo(() => {
    if (!projectStartDate || !projectEndDate) return [];
    try {
      return eachDayOfInterval({
        start: parseISO(projectStartDate),
        end: parseISO(projectEndDate),
      });
    } catch {
      return [];
    }
  }, [projectStartDate, projectEndDate]);

  // Build a map of existing days: assignmentId -> Set<dateStr>
  const existingDaysMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const assignment of assignments) {
      const days = (assignment as unknown as { days?: AssignmentDay[] }).days || [];
      const dateSet = new Set<string>();
      for (const day of days) {
        dateSet.add(day.work_date);
      }
      map.set(assignment.id, dateSet);
    }
    return map;
  }, [assignments]);

  // Build a map of day IDs: assignmentId -> dateStr -> dayId
  const dayIdMap = useMemo(() => {
    const map = new Map<string, Map<string, string>>();
    for (const assignment of assignments) {
      const days = (assignment as unknown as { days?: AssignmentDay[] }).days || [];
      const dayMap = new Map<string, string>();
      for (const day of days) {
        dayMap.set(day.work_date, day.id);
      }
      map.set(assignment.id, dayMap);
    }
    return map;
  }, [assignments]);

  // Check if a date is scheduled for an assignment (considering pending changes)
  const isDateScheduled = (assignmentId: string, dateStr: string): boolean => {
    const existingDays = existingDaysMap.get(assignmentId) || new Set();
    const hasExisting = existingDays.has(dateStr);

    const pendingAction = pendingChanges.get(assignmentId)?.get(dateStr);
    if (pendingAction === 'add') return true;
    if (pendingAction === 'remove') return false;
    return hasExisting;
  };

  // Toggle a date for an assignment
  const toggleDate = (assignmentId: string, dateStr: string) => {
    const existingDays = existingDaysMap.get(assignmentId) || new Set();
    const hasExisting = existingDays.has(dateStr);
    const currentPendingAction = pendingChanges.get(assignmentId)?.get(dateStr);

    setPendingChanges((prev) => {
      const newChanges = new Map(prev);
      const assignmentChanges = new Map(newChanges.get(assignmentId) || new Map());

      if (hasExisting) {
        // Currently scheduled - toggle to remove or clear pending
        if (currentPendingAction === 'remove') {
          // Was pending remove, clear it (back to scheduled)
          assignmentChanges.delete(dateStr);
        } else {
          // Schedule for removal
          assignmentChanges.set(dateStr, 'remove');
        }
      } else {
        // Currently not scheduled - toggle to add or clear pending
        if (currentPendingAction === 'add') {
          // Was pending add, clear it (back to not scheduled)
          assignmentChanges.delete(dateStr);
        } else {
          // Schedule for addition
          assignmentChanges.set(dateStr, 'add');
        }
      }

      if (assignmentChanges.size === 0) {
        newChanges.delete(assignmentId);
      } else {
        newChanges.set(assignmentId, assignmentChanges);
      }
      return newChanges;
    });
  };

  // Count pending changes
  const pendingChangeCount = useMemo(() => {
    let count = 0;
    for (const changes of pendingChanges.values()) {
      count += changes.size;
    }
    return count;
  }, [pendingChanges]);

  // Save all pending changes
  const handleSave = async () => {
    if (pendingChangeCount === 0) {
      onOpenChange(false);
      return;
    }

    setIsSaving(true);
    let addCount = 0;
    let removeCount = 0;

    try {
      // Process all changes
      for (const [assignmentId, changes] of pendingChanges) {
        const toAdd: string[] = [];
        const toRemove: string[] = [];

        for (const [dateStr, action] of changes) {
          if (action === 'add') {
            toAdd.push(dateStr);
          } else if (action === 'remove') {
            const dayId = dayIdMap.get(assignmentId)?.get(dateStr);
            if (dayId) {
              toRemove.push(dayId);
            }
          }
        }

        // Add days
        if (toAdd.length > 0) {
          await addDays.mutateAsync({
            assignmentId,
            days: toAdd.map((date) => ({
              date,
              startTime: '08:00:00',
              endTime: '17:00:00',
            })),
          });
          addCount += toAdd.length;
        }

        // Remove days
        if (toRemove.length > 0) {
          await removeDays.mutateAsync(toRemove);
          removeCount += toRemove.length;
        }
      }

      const messages: string[] = [];
      if (addCount > 0) messages.push(`${addCount} day${addCount !== 1 ? 's' : ''} added`);
      if (removeCount > 0) messages.push(`${removeCount} day${removeCount !== 1 ? 's' : ''} removed`);

      toast.success('Schedule updated', {
        description: messages.join(', '),
      });

      setPendingChanges(new Map());
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to save changes', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Manage Team Schedule
          </DialogTitle>
          <DialogDescription>
            {projectName} - Select which days each team member is scheduled
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No team members assigned to this project yet.</p>
            <p className="text-sm">Use drag-and-drop or the assignment dialog to add team members first.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Info bar */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{assignments.length} team member{assignments.length !== 1 ? 's' : ''} assigned</span>
              {pendingChangeCount > 0 && (
                <span className="text-primary font-medium">
                  {pendingChangeCount} pending change{pendingChangeCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Schedule grid */}
            <ScrollArea className="h-[400px] border rounded-lg">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-background z-10">
                  <tr>
                    <th className="sticky left-0 bg-background p-2 border-b border-r text-left font-medium min-w-[140px]">
                      Date
                    </th>
                    {assignments.map((assignment) => (
                      <th
                        key={assignment.id}
                        className="p-2 border-b text-center font-medium min-w-[100px]"
                      >
                        <div className="truncate">
                          {assignment.user?.full_name || 'Unknown'}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projectDates.map((date) => {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const isWeekendDay = isWeekend(date);

                    return (
                      <tr
                        key={dateStr}
                        className={cn(
                          'hover:bg-muted/50',
                          isWeekendDay && 'bg-muted/30'
                        )}
                      >
                        <td className="sticky left-0 bg-background p-2 border-b border-r">
                          <span className="font-medium">
                            {format(date, 'EEE, MMM d')}
                          </span>
                          {isWeekendDay && (
                            <span className="text-xs text-muted-foreground ml-1">
                              (weekend)
                            </span>
                          )}
                        </td>
                        {assignments.map((assignment) => {
                          const isScheduled = isDateScheduled(assignment.id, dateStr);
                          const pendingAction = pendingChanges.get(assignment.id)?.get(dateStr);
                          const hasPendingChange = !!pendingAction;

                          return (
                            <td
                              key={assignment.id}
                              className={cn(
                                'p-2 border-b text-center',
                                hasPendingChange && 'bg-primary/10'
                              )}
                            >
                              <Checkbox
                                checked={isScheduled}
                                onCheckedChange={() => toggleDate(assignment.id, dateStr)}
                                className={cn(
                                  hasPendingChange && 'border-primary'
                                )}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>

            {/* Action buttons */}
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setPendingChanges(new Map());
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || pendingChangeCount === 0}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                    {pendingChangeCount > 0 && ` (${pendingChangeCount})`}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
