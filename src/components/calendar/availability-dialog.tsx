'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { createUserAvailability, updateUserAvailability, deleteUserAvailability } from '@/app/(dashboard)/calendar/actions';
import type { UserAvailability, AvailabilityType } from '@/types/calendar';
import { AVAILABILITY_TYPE_LABELS } from '@/types/calendar';

interface AvailabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  availability?: UserAvailability; // If provided, we're editing
  defaultStartDate?: string;
  defaultEndDate?: string;
}

export function AvailabilityDialog({
  open,
  onOpenChange,
  userId,
  userName,
  availability,
  defaultStartDate,
  defaultEndDate,
}: AvailabilityDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!availability;

  const [startDate, setStartDate] = useState(
    availability?.start_date || defaultStartDate || format(new Date(), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState(
    availability?.end_date || defaultEndDate || format(new Date(), 'yyyy-MM-dd')
  );
  const [availabilityType, setAvailabilityType] = useState<AvailabilityType>(
    availability?.availability_type || 'pto'
  );
  const [reason, setReason] = useState(availability?.reason || '');

  const createMutation = useMutation({
    mutationFn: createUserAvailability,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-availability'] });
      queryClient.invalidateQueries({ queryKey: ['user-availability'] });
      toast.success('Time off added successfully');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to add time off');
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateUserAvailability,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-availability'] });
      queryClient.invalidateQueries({ queryKey: ['user-availability'] });
      toast.success('Time off updated successfully');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update time off');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUserAvailability,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-availability'] });
      queryClient.invalidateQueries({ queryKey: ['user-availability'] });
      toast.success('Time off removed');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to remove time off');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (new Date(endDate) < new Date(startDate)) {
      toast.error('End date must be after start date');
      return;
    }

    if (isEditing && availability) {
      updateMutation.mutate({
        id: availability.id,
        startDate,
        endDate,
        availabilityType,
        reason: reason || undefined,
      });
    } else {
      createMutation.mutate({
        userId,
        startDate,
        endDate,
        availabilityType,
        reason: reason || undefined,
      });
    }
  };

  const handleDelete = () => {
    if (availability) {
      deleteMutation.mutate(availability.id);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Time Off' : 'Add Time Off'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update' : 'Block'} time off for {userName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={availabilityType} onValueChange={(v) => setAvailabilityType(v as AvailabilityType)}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AVAILABILITY_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Notes (optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Vacation, Doctor appointment..."
              rows={2}
            />
          </div>

          <DialogFooter className="gap-2">
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isLoading}
              >
                Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : isEditing ? 'Update' : 'Add Time Off'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
