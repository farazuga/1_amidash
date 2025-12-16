'use client';

import { useState } from 'react';
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
import { useOverrideConflict } from '@/hooks/queries/use-assignments';
import { toast } from 'sonner';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { BookingConflict } from '@/types/calendar';

interface ConflictWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflict: BookingConflict | null;
  onSuccess?: () => void;
}

export function ConflictWarningDialog({
  open,
  onOpenChange,
  conflict,
  onSuccess,
}: ConflictWarningDialogProps) {
  const [reason, setReason] = useState('');

  const overrideConflict = useOverrideConflict();

  const handleOverride = async () => {
    if (!conflict || !reason.trim()) return;

    try {
      await overrideConflict.mutateAsync({
        conflictId: conflict.id,
        reason: reason.trim(),
      });

      toast.success('Conflict override recorded');
      setReason('');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to override conflict');
    }
  };

  if (!conflict) return null;

  const conflictDate = format(parseISO(conflict.conflict_date), 'MMMM d, yyyy');
  const userName = conflict.user?.full_name || conflict.user?.email || 'User';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <DialogTitle>Booking Conflict Detected</DialogTitle>
          </div>
          <DialogDescription>
            {userName} is already scheduled on {conflictDate}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-sm">
            <p className="font-medium text-amber-800">Conflicting Projects:</p>
            <ul className="mt-2 space-y-1 text-amber-700">
              {conflict.assignment1?.project && (
                <li>• {conflict.assignment1.project.client_name}</li>
              )}
              {conflict.assignment2?.project && (
                <li>• {conflict.assignment2.project.client_name}</li>
              )}
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="override-reason">
              Override Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="override-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this double-booking is acceptable..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              A reason is required to acknowledge and allow this conflict.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleOverride}
            disabled={!reason.trim() || overrideConflict.isPending}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {overrideConflict.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Override Conflict
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
