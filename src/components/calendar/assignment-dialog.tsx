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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { BookingStatusBadge } from './booking-status-badge';
import { useAdminUsers, useCreateAssignment } from '@/hooks/queries/use-assignments';
import type { BookingStatus } from '@/types/calendar';
import type { Project } from '@/types';
import { BOOKING_STATUS_CONFIG } from '@/lib/calendar/constants';
import { toast } from 'sonner';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface AssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  onSuccess?: () => void;
}

export function AssignmentDialog({
  open,
  onOpenChange,
  project,
  onSuccess,
}: AssignmentDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [bookingStatus, setBookingStatus] = useState<BookingStatus>('draft');
  const [notes, setNotes] = useState('');

  const { data: adminUsers, isLoading: isLoadingUsers } = useAdminUsers();
  const createAssignment = useCreateAssignment();

  const handleSubmit = async () => {
    if (!project || !selectedUserId) return;

    try {
      const result = await createAssignment.mutateAsync({
        projectId: project.id,
        userId: selectedUserId,
        bookingStatus,
        notes: notes.trim() || undefined,
      });

      if (result.conflicts?.hasConflicts) {
        toast.warning('Assignment created with conflicts', {
          description: `User has ${result.conflicts.conflicts.length} conflicting assignment(s). You may need to resolve these.`,
        });
      } else {
        toast.success('Assignment created successfully');
      }

      // Reset form
      setSelectedUserId('');
      setBookingStatus('draft');
      setNotes('');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create assignment');
    }
  };

  const statuses: BookingStatus[] = ['draft', 'tentative', 'confirmed'];

  if (!project) return null;

  const hasDates = project.start_date && project.end_date;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Assign User to Project</DialogTitle>
          <DialogDescription>
            Add a team member to {project.client_name}
          </DialogDescription>
        </DialogHeader>

        {!hasDates ? (
          <div className="flex items-center gap-2 p-4 bg-amber-50 text-amber-800 rounded-md">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">
              This project needs start and end dates before users can be assigned.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="user">Team Member</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger id="user">
                  <SelectValue placeholder="Select a team member" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingUsers ? (
                    <div className="flex items-center justify-center p-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : (
                    adminUsers?.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Booking Status</Label>
              <Select
                value={bookingStatus}
                onValueChange={(v) => setBookingStatus(v as BookingStatus)}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      <div className="flex items-center gap-2">
                        <BookingStatusBadge status={status} size="sm" />
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {BOOKING_STATUS_CONFIG[bookingStatus].label}:{' '}
                {bookingStatus === 'draft' && 'Internal draft, only visible to admin/editor'}
                {bookingStatus === 'tentative' && 'Shared externally, awaiting confirmation'}
                {bookingStatus === 'confirmed' && 'Finalized and committed booking'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this assignment..."
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!hasDates || !selectedUserId || createAssignment.isPending}
          >
            {createAssignment.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Add Assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
