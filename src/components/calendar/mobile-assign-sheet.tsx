'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { createAssignment } from '@/app/(dashboard)/calendar/actions';
import { useAssignableUsers } from '@/hooks/queries/use-assignments';
import type { BookingStatus } from '@/types/calendar';
import { BOOKING_STATUS_LABELS } from '@/types/calendar';

interface MobileAssignSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  selectedDate: Date;
}

export function MobileAssignSheet({
  open,
  onOpenChange,
  projectId,
  projectName,
  selectedDate,
}: MobileAssignSheetProps) {
  const queryClient = useQueryClient();
  const { data: users = [], isLoading: usersLoading } = useAssignableUsers();

  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [bookingStatus, setBookingStatus] = useState<BookingStatus>('draft');

  const createMutation = useMutation({
    mutationFn: createAssignment,
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['calendar'] });
        queryClient.invalidateQueries({ queryKey: ['assignments'] });
        toast.success('Assignment created');
        onOpenChange(false);
        // Reset form
        setSelectedUserId('');
        setBookingStatus('draft');
      } else {
        toast.error(result.error || 'Failed to create assignment');
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create assignment');
    },
  });

  const handleSubmit = () => {
    if (!selectedUserId) {
      toast.error('Please select a team member');
      return;
    }

    createMutation.mutate({
      projectId,
      userId: selectedUserId,
      bookingStatus,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-xl">
        <SheetHeader className="text-left">
          <SheetTitle>Add Assignment</SheetTitle>
          <SheetDescription>
            {projectName} - {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Team Member Select */}
          <div className="space-y-2">
            <Label htmlFor="user" className="text-base">Team Member</Label>
            <Select
              value={selectedUserId}
              onValueChange={setSelectedUserId}
              disabled={usersLoading}
            >
              <SelectTrigger id="user" className="h-12 text-base">
                <SelectValue placeholder="Select team member..." />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem
                    key={user.id}
                    value={user.id}
                    className="h-12 text-base"
                  >
                    {user.full_name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Select */}
          <div className="space-y-2">
            <Label htmlFor="status" className="text-base">Status</Label>
            <Select
              value={bookingStatus}
              onValueChange={(v) => setBookingStatus(v as BookingStatus)}
            >
              <SelectTrigger id="status" className="h-12 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(BOOKING_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem
                    key={value}
                    value={value}
                    className="h-12 text-base"
                  >
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-12 text-base"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || !selectedUserId}
              className="flex-1 h-12 text-base"
            >
              {createMutation.isPending ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
