'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { useAddExcludedDates } from '@/hooks/queries/use-assignments';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { format, parseISO, eachDayOfInterval } from 'date-fns';
import type { ProjectAssignment } from '@/types/calendar';

interface DateExclusionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: ProjectAssignment | null;
  projectStartDate?: string | null;
  projectEndDate?: string | null;
  onSuccess?: () => void;
}

export function DateExclusionDialog({
  open,
  onOpenChange,
  assignment,
  projectStartDate,
  projectEndDate,
  onSuccess,
}: DateExclusionDialogProps) {
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [reason, setReason] = useState('');

  const addExcludedDates = useAddExcludedDates();

  // Get already excluded dates
  const existingExcludedDates = useMemo(() => {
    if (!assignment?.excluded_dates) return new Set<string>();
    return new Set(assignment.excluded_dates.map((d) => d.excluded_date));
  }, [assignment?.excluded_dates]);

  // Get available date range from project
  const dateRange = useMemo(() => {
    if (!projectStartDate || !projectEndDate) return null;
    return {
      from: parseISO(projectStartDate),
      to: parseISO(projectEndDate),
    };
  }, [projectStartDate, projectEndDate]);

  const handleSubmit = async () => {
    if (!assignment || selectedDates.length === 0) return;

    const dateStrings = selectedDates.map((d) => format(d, 'yyyy-MM-dd'));

    try {
      await addExcludedDates.mutateAsync({
        assignmentId: assignment.id,
        dates: dateStrings,
        reason: reason.trim() || undefined,
      });

      toast.success(`${selectedDates.length} date(s) excluded successfully`);

      // Reset form
      setSelectedDates([]);
      setReason('');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to exclude dates');
    }
  };

  const handleDateSelect = (dates: Date[] | undefined) => {
    if (!dates) {
      setSelectedDates([]);
      return;
    }
    // Filter out already excluded dates
    const filteredDates = dates.filter(
      (d) => !existingExcludedDates.has(format(d, 'yyyy-MM-dd'))
    );
    setSelectedDates(filteredDates);
  };

  const removeDate = (dateToRemove: Date) => {
    setSelectedDates((prev) =>
      prev.filter((d) => d.toDateString() !== dateToRemove.toDateString())
    );
  };

  if (!assignment) return null;

  const userName = assignment.user?.full_name || assignment.user?.email || 'User';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Exclude Dates</DialogTitle>
          <DialogDescription>
            Select days when {userName} will not be working on this project
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex justify-center">
            <Calendar
              mode="multiple"
              selected={selectedDates}
              onSelect={handleDateSelect}
              disabled={(date) => {
                // Disable dates outside project range
                if (dateRange) {
                  if (date < dateRange.from || date > dateRange.to) return true;
                }
                // Disable already excluded dates
                return existingExcludedDates.has(format(date, 'yyyy-MM-dd'));
              }}
              numberOfMonths={1}
              className="rounded-md border"
            />
          </div>

          {selectedDates.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Dates ({selectedDates.length})</Label>
              <div className="flex flex-wrap gap-2">
                {selectedDates.map((date) => (
                  <div
                    key={date.toISOString()}
                    className="flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-sm"
                  >
                    <span>{format(date, 'MMM d, yyyy')}</span>
                    <button
                      onClick={() => removeDate(date)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., PTO, sick day, other project..."
              rows={2}
            />
          </div>

          {existingExcludedDates.size > 0 && (
            <div className="text-sm text-muted-foreground">
              {existingExcludedDates.size} date(s) already excluded
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedDates.length === 0 || addExcludedDates.isPending}
          >
            {addExcludedDates.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Exclude {selectedDates.length} Date(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
