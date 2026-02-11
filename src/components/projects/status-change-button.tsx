'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { updateProjectStatus } from '@/app/(dashboard)/projects/actions';

// Use a flexible type that works with both old and new Status shapes
interface StatusItem {
  id: string;
  name: string;
  require_note?: boolean | null;
  is_internal_only?: boolean | null;
}

interface StatusChangeButtonProps {
  projectId: string;
  currentStatusId: string | null;
  statuses: StatusItem[];
  pocEmail: string | null;
  clientName: string;
  clientToken: string | null;
  projectTypeId: string | null;
  projectTypeStatuses: { project_type_id: string; status_id: string }[];
}

export function StatusChangeButton({
  projectId,
  currentStatusId,
  statuses,
  pocEmail,
  clientName,
  clientToken,
  projectTypeId,
  projectTypeStatuses,
}: StatusChangeButtonProps) {
  // Filter statuses to only show those available for this project type
  // If no statuses are mapped for this project type, show all active statuses as fallback
  const allowedStatusIds = projectTypeId
    ? projectTypeStatuses
        .filter(pts => pts.project_type_id === projectTypeId)
        .map(pts => pts.status_id)
    : [];

  const availableStatuses = projectTypeId && allowedStatusIds.length > 0
    ? statuses.filter(s => allowedStatusIds.includes(s.id))
    : statuses;
  const [open, setOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [note, setNote] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const currentStatus = availableStatuses.find((s) => s.id === currentStatusId);
  const newStatus = availableStatuses.find((s) => s.id === selectedStatus);

  const handleStatusChange = async () => {
    if (!selectedStatus) {
      toast.error('Please select a status');
      return;
    }

    if (newStatus?.require_note && !note.trim()) {
      toast.error(`A note is required for "${newStatus.name}" status`);
      return;
    }

    startTransition(async () => {
      // Use server action for status update (avoids browser Supabase client issues)
      const result = await updateProjectStatus({
        projectId,
        newStatusId: selectedStatus,
        note: note.trim() || undefined,
        currentStatusName: currentStatus?.name,
        newStatusName: newStatus?.name,
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to update status');
        return;
      }

      // Send email notification if POC has email (fire-and-forget with timeout)
      // Skip email for internal-only statuses - they should not be visible to clients
      if (pocEmail && newStatus && !newStatus.is_internal_only) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        fetch('/api/email/status-change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: pocEmail,
            clientName,
            clientToken,
            newStatus: newStatus.name,
            previousStatus: currentStatus?.name,
            note: note.trim() || undefined,
            projectId,
          }),
          signal: controller.signal,
        })
          .catch((error) => {
            console.error('Failed to send email:', error);
          })
          .finally(() => {
            clearTimeout(timeoutId);
          });
        // Don't await - email is fire-and-forget
      }

      toast.success(`Status changed to "${newStatus?.name}"`);
      setOpen(false);
      setSelectedStatus('');
      setNote('');
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <RefreshCw className="mr-2 h-4 w-4" />
          Change Status
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Project Status</DialogTitle>
          <DialogDescription>
            Select a new status for this project. The client will be notified via
            email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Current Status</Label>
            <p className="text-sm font-medium">
              {currentStatus?.name || 'No status'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-status">New Status</Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select new status" />
              </SelectTrigger>
              <SelectContent>
                {availableStatuses.map((status) => (
                  <SelectItem
                    key={status.id}
                    value={status.id}
                    disabled={status.id === currentStatusId}
                  >
                    {status.name}
                    {status.require_note && ' *'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {newStatus?.require_note && (
              <p className="text-xs text-muted-foreground">
                * A note is required for this status
              </p>
            )}
          </div>

          {newStatus?.require_note ? (
            <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
              <Label htmlFor="note" className="text-amber-900 font-semibold flex items-center gap-2">
                <span className="text-amber-600">*</span>
                Note Required for &quot;{newStatus.name}&quot;
              </Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Please provide a note explaining this status change..."
                rows={3}
                className="border-amber-300 focus:border-amber-500"
                required
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="note" className="text-muted-foreground">
                Note (optional)
              </Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note about this status change..."
                rows={3}
              />
            </div>
          )}

          {pocEmail && (
            <p className="text-sm text-muted-foreground">
              An email notification will be sent to {pocEmail}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleStatusChange} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
