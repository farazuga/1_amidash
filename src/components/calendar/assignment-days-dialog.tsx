'use client';

import { useState, useMemo, useEffect } from 'react';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { CalendarDays, Plus, Trash2, Clock, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DayTimeEditor } from './day-time-editor';
import {
  useAssignmentDays,
  useAddAssignmentDays,
  useRemoveAssignmentDays,
} from '@/hooks/queries/use-assignments';
import type { AssignmentDay } from '@/types/calendar';
import { toast } from 'sonner';

interface AssignmentDaysDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignmentId: string;
  userName: string;
  projectName: string;
  projectStartDate: string;
  projectEndDate: string;
}

export function AssignmentDaysDialog({
  open,
  onOpenChange,
  assignmentId,
  userName,
  projectName,
  projectStartDate,
  projectEndDate,
}: AssignmentDaysDialogProps) {
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [defaultStartTime, setDefaultStartTime] = useState('08:30');
  const [defaultEndTime, setDefaultEndTime] = useState('16:30');

  const { data: existingDays = [], isLoading, refetch } = useAssignmentDays(assignmentId);
  const addDays = useAddAssignmentDays();
  const removeDays = useRemoveAssignmentDays();

  // Reset state when assignment changes
  useEffect(() => {
    setSelectedDates(new Set());
    setDefaultStartTime('08:30');
    setDefaultEndTime('16:30');
  }, [assignmentId]);

  // Reset selection and refetch when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedDates(new Set());
      if (assignmentId) {
        refetch();
      }
    }
  }, [open, assignmentId, refetch]);

  // Generate all possible dates in project range
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

  // Map existing days by date for quick lookup
  const existingDaysByDate = useMemo(() => {
    const map = new Map<string, AssignmentDay>();
    for (const day of existingDays) {
      map.set(day.work_date, day);
    }
    return map;
  }, [existingDays]);

  // Toggle date selection
  const toggleDate = (dateStr: string) => {
    const newSelected = new Set(selectedDates);
    if (newSelected.has(dateStr)) {
      newSelected.delete(dateStr);
    } else {
      newSelected.add(dateStr);
    }
    setSelectedDates(newSelected);
  };

  // Select all unscheduled dates
  const selectAllUnscheduled = () => {
    const newSelected = new Set<string>();
    for (const date of projectDates) {
      const dateStr = format(date, 'yyyy-MM-dd');
      if (!existingDaysByDate.has(dateStr)) {
        newSelected.add(dateStr);
      }
    }
    setSelectedDates(newSelected);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedDates(new Set());
  };

  // Add selected dates
  const handleAddDays = async () => {
    if (selectedDates.size === 0) {
      toast.error('No dates selected');
      return;
    }

    if (defaultEndTime <= defaultStartTime) {
      toast.error('Invalid times', {
        description: 'End time must be after start time',
      });
      return;
    }

    try {
      const days = Array.from(selectedDates).map((date) => ({
        date,
        startTime: `${defaultStartTime}:00`,
        endTime: `${defaultEndTime}:00`,
      }));

      await addDays.mutateAsync({
        assignmentId,
        days,
      });

      toast.success(`Added ${days.length} day${days.length !== 1 ? 's' : ''}`);
      setSelectedDates(new Set());
    } catch (error) {
      toast.error('Failed to add days', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    }
  };

  // Remove selected scheduled dates
  const handleRemoveDays = async () => {
    const dayIdsToRemove: string[] = [];
    for (const dateStr of selectedDates) {
      const day = existingDaysByDate.get(dateStr);
      if (day) {
        dayIdsToRemove.push(day.id);
      }
    }

    if (dayIdsToRemove.length === 0) {
      toast.error('No scheduled days selected');
      return;
    }

    try {
      await removeDays.mutateAsync(dayIdsToRemove);
      toast.success(`Removed ${dayIdsToRemove.length} day${dayIdsToRemove.length !== 1 ? 's' : ''}`);
      setSelectedDates(new Set());
    } catch (error) {
      toast.error('Failed to remove days', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    }
  };

  const isProcessing = addDays.isPending || removeDays.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Manage Scheduled Days
          </DialogTitle>
          <DialogDescription>
            {userName} on {projectName}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Default times for new days */}
            <div className="flex items-end gap-4 p-3 bg-muted rounded-lg">
              <div className="flex-1 space-y-1.5">
                <Label>Default Start Time</Label>
                <Input
                  type="time"
                  value={defaultStartTime}
                  onChange={(e) => setDefaultStartTime(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label>Default End Time</Label>
                <Input
                  type="time"
                  value={defaultEndTime}
                  onChange={(e) => setDefaultEndTime(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            {/* Selection actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllUnscheduled}
              >
                Select All Unscheduled
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearSelection}
              >
                Clear Selection
              </Button>
              <span className="text-sm text-muted-foreground ml-auto">
                {selectedDates.size} selected
              </span>
            </div>

            {/* Date list */}
            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="divide-y">
                {projectDates.map((date) => {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const existingDay = existingDaysByDate.get(dateStr);
                  const isSelected = selectedDates.has(dateStr);
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                  return (
                    <div
                      key={dateStr}
                      className={`flex items-center gap-3 px-3 py-2 ${
                        isWeekend ? 'bg-muted/50' : ''
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleDate(dateStr)}
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium">
                          {format(date, 'EEEE, MMM d')}
                        </span>
                        {isWeekend && (
                          <span className="text-xs text-muted-foreground ml-2">
                            (weekend)
                          </span>
                        )}
                      </div>
                      {existingDay ? (
                        <div className="flex items-center gap-2">
                          <DayTimeEditor
                            day={existingDay}
                            trigger={
                              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                                <Clock className="h-3 w-3" />
                                {existingDay.start_time.slice(0, 5)} - {existingDay.end_time.slice(0, 5)}
                              </Button>
                            }
                          />
                          <span className="text-xs text-green-600 font-medium">
                            Scheduled
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Not scheduled
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Action buttons */}
            <div className="flex justify-between">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRemoveDays}
                disabled={isProcessing || selectedDates.size === 0}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Remove Selected
              </Button>
              <Button
                size="sm"
                onClick={handleAddDays}
                disabled={isProcessing || selectedDates.size === 0}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Selected
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
