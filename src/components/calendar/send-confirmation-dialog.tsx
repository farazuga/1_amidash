'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Mail, Calendar, User } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateConfirmationRequest } from '@/hooks/queries/use-assignments';
import { BookingStatusBadge } from '@/components/calendar/booking-status-badge';
import type { CalendarEvent } from '@/types/calendar';

interface SendConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  assignments: CalendarEvent[];
  customerEmail?: string;
  customerName?: string;
  onSuccess?: () => void;
}

export function SendConfirmationDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  assignments,
  customerEmail: initialEmail = '',
  customerName: initialName = '',
  onSuccess,
}: SendConfirmationDialogProps) {
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>([]);
  const [email, setEmail] = useState(initialEmail);
  const [name, setName] = useState(initialName);
  const [isSending, setIsSending] = useState(false);

  const createConfirmation = useCreateConfirmationRequest();

  // Filter to only tentative assignments (those that can be sent for confirmation)
  const tentativeAssignments = assignments.filter(
    (a) => a.bookingStatus === 'tentative'
  );

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedAssignmentIds(tentativeAssignments.map((a) => a.assignmentId));
      setEmail(initialEmail);
      setName(initialName);
    }
  }, [open, initialEmail, initialName, tentativeAssignments.length]);

  const handleToggleAssignment = (assignmentId: string) => {
    setSelectedAssignmentIds((prev) =>
      prev.includes(assignmentId)
        ? prev.filter((id) => id !== assignmentId)
        : [...prev, assignmentId]
    );
  };

  const handleSelectAll = () => {
    if (selectedAssignmentIds.length === tentativeAssignments.length) {
      setSelectedAssignmentIds([]);
    } else {
      setSelectedAssignmentIds(tentativeAssignments.map((a) => a.assignmentId));
    }
  };

  const handleSend = async () => {
    if (selectedAssignmentIds.length === 0) {
      toast.error('Please select at least one assignment');
      return;
    }

    if (!email.trim()) {
      toast.error('Please enter a customer email');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsSending(true);

    try {
      await createConfirmation.mutateAsync({
        projectId,
        assignmentIds: selectedAssignmentIds,
        sendToEmail: email.trim(),
        sendToName: name.trim() || undefined,
      });

      toast.success('Confirmation request sent', {
        description: `Email sent to ${email}`,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send confirmation');
    } finally {
      setIsSending(false);
    }
  };

  // Group assignments by user (engineer)
  const assignmentsByEngineer = tentativeAssignments.reduce((acc, assignment) => {
    const key = assignment.userId || 'unknown';
    if (!acc[key]) {
      acc[key] = {
        name: assignment.userName || 'Unknown',
        assignments: [],
      };
    }
    acc[key].assignments.push(assignment);
    return acc;
  }, {} as Record<string, { name: string; assignments: CalendarEvent[] }>);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Confirmation Request
          </DialogTitle>
          <DialogDescription>
            Send a confirmation email to the customer for {projectName}. They will be able to confirm or decline the scheduled dates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Customer email input */}
          <div className="space-y-2">
            <Label htmlFor="email">Customer Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="customer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSending}
            />
          </div>

          {/* Customer name input */}
          <div className="space-y-2">
            <Label htmlFor="name">Customer Name (optional)</Label>
            <Input
              id="name"
              type="text"
              placeholder="John Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSending}
            />
          </div>

          {/* Assignment selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Assignments to Include</Label>
              {tentativeAssignments.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={isSending}
                >
                  {selectedAssignmentIds.length === tentativeAssignments.length
                    ? 'Deselect All'
                    : 'Select All'}
                </Button>
              )}
            </div>

            {tentativeAssignments.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg text-center">
                No tentative assignments available. Only assignments with &quot;Tentative&quot; status can be sent for confirmation.
              </div>
            ) : (
              <ScrollArea className="h-[200px] border rounded-lg p-2">
                <div className="space-y-3">
                  {Object.entries(assignmentsByEngineer).map(([engineerId, { name: engineerName, assignments: engAssignments }]) => (
                    <div key={engineerId} className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <User className="h-4 w-4" />
                        {engineerName}
                      </div>
                      {engAssignments.map((assignment) => (
                        <div
                          key={assignment.assignmentId}
                          className="flex items-start gap-3 pl-6"
                        >
                          <Checkbox
                            id={assignment.assignmentId}
                            checked={selectedAssignmentIds.includes(assignment.assignmentId)}
                            onCheckedChange={() => handleToggleAssignment(assignment.assignmentId)}
                            disabled={isSending}
                          />
                          <label
                            htmlFor={assignment.assignmentId}
                            className="flex-1 cursor-pointer text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>
                                {formatDate(assignment.start.toString().split('T')[0])}
                                {assignment.start !== assignment.end && (
                                  <> - {formatDate(assignment.end.toString().split('T')[0])}</>
                                )}
                              </span>
                              <BookingStatusBadge status={assignment.bookingStatus} size="sm" />
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Info note */}
          <p className="text-xs text-muted-foreground">
            Selected assignments will be changed to &quot;Pending Confirm&quot; status until the customer responds. The confirmation link will expire in 7 days.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || selectedAssignmentIds.length === 0 || !email.trim()}
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send Confirmation Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
