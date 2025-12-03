'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
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
import type { Status } from '@/types';

interface StatusChangeButtonProps {
  projectId: string;
  currentStatusId: string | null;
  statuses: Status[];
  pocEmail: string | null;
  clientName: string;
}

export function StatusChangeButton({
  projectId,
  currentStatusId,
  statuses,
  pocEmail,
  clientName,
}: StatusChangeButtonProps) {
  const [open, setOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [note, setNote] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  const currentStatus = statuses.find((s) => s.id === currentStatusId);
  const newStatus = statuses.find((s) => s.id === selectedStatus);

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
      const { data: { user } } = await supabase.auth.getUser();

      // Update project status
      const { error: updateError } = await supabase
        .from('projects')
        .update({ current_status_id: selectedStatus })
        .eq('id', projectId);

      if (updateError) {
        toast.error('Failed to update status');
        console.error(updateError);
        return;
      }

      // Add to status history
      await supabase.from('status_history').insert({
        project_id: projectId,
        status_id: selectedStatus,
        note: note.trim() || null,
        changed_by: user?.id,
      });

      // Add to audit log
      await supabase.from('audit_logs').insert({
        project_id: projectId,
        user_id: user?.id,
        action: 'update',
        field_name: 'status',
        old_value: currentStatus?.name || null,
        new_value: newStatus?.name || null,
      });

      // Send email notification if POC has email
      if (pocEmail && newStatus) {
        try {
          await fetch('/api/email/status-change', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: pocEmail,
              clientName,
              projectId,
              newStatus: newStatus.name,
              progressPercent: newStatus.progress_percent,
            }),
          });
        } catch (error) {
          console.error('Failed to send email:', error);
          // Don't fail the whole operation if email fails
        }
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
              {currentStatus && ` (${currentStatus.progress_percent}%)`}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-status">New Status</Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select new status" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((status) => (
                  <SelectItem
                    key={status.id}
                    value={status.id}
                    disabled={status.id === currentStatusId}
                  >
                    {status.name} ({status.progress_percent}%)
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

          <div className="space-y-2">
            <Label htmlFor="note">
              Note {newStatus?.require_note ? '*' : '(optional)'}
            </Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note about this status change..."
              rows={3}
            />
          </div>

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
