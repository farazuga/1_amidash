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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Users, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { getUserInitials } from '@/lib/calendar/utils';
import { useAssignableUsers, useCreateAssignment, useProjectAssignments } from '@/hooks/queries/use-assignments';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import type { BookingStatus } from '@/types/calendar';

interface BulkAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  onSuccess?: () => void;
}

export function BulkAssignDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  onSuccess,
}: BulkAssignDialogProps) {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const { data: assignableUsers = [], isLoading } = useAssignableUsers();
  const { data: projectAssignments = [], refetch: refetchAssignments } = useProjectAssignments(projectId);
  const createAssignment = useCreateAssignment();

  // Refetch assignments when dialog opens to ensure fresh data
  useEffect(() => {
    if (open) {
      refetchAssignments();
      setSelectedUserIds([]);
      setSearchTerm('');
    }
  }, [open, refetchAssignments]);

  // Get IDs of users already assigned to this project
  const assignedUserIds = new Set(projectAssignments.map((a) => a.user_id));

  const filteredUsers = assignableUsers.filter(
    (user) =>
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  // Filter out already assigned users for selection
  const selectableUsers = filteredUsers.filter((u) => !assignedUserIds.has(u.id));

  const handleSelectAll = () => {
    if (selectedUserIds.length === selectableUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(selectableUsers.map((u) => u.id));
    }
  };

  const handleAssign = async () => {
    if (selectedUserIds.length === 0) return;

    // Filter out any users that may have been assigned since dialog opened (race condition protection)
    const usersToAssign = selectedUserIds.filter((id) => !assignedUserIds.has(id));

    if (usersToAssign.length === 0) {
      toast.info('All selected users are already assigned');
      setSelectedUserIds([]);
      return;
    }

    setIsAssigning(true);
    let successCount = 0;
    let errorCount = 0;

    for (const userId of usersToAssign) {
      try {
        await createAssignment.mutateAsync({
          projectId,
          userId,
          bookingStatus: 'pencil' as BookingStatus,
        });
        successCount++;
      } catch {
        errorCount++;
      }
    }

    setIsAssigning(false);

    if (successCount > 0 && errorCount === 0) {
      toast.success(`Assigned ${successCount} team member${successCount !== 1 ? 's' : ''}`, {
        description: `Added to ${projectName}`,
      });
    } else if (successCount > 0 && errorCount > 0) {
      toast.warning(`Assigned ${successCount}, ${errorCount} failed`, {
        description: 'Some users may already be assigned',
      });
    } else {
      toast.error('Failed to assign users', {
        description: 'Users may already be assigned to this project',
      });
    }

    setSelectedUserIds([]);
    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Assign Team Members
          </DialogTitle>
          <DialogDescription>
            Select team members to assign to {projectName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search team members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Select all */}
          <div className="flex items-center justify-between px-1">
            <Label className="text-sm text-muted-foreground">
              {selectedUserIds.length} of {selectableUsers.length} available selected
              {assignedUserIds.size > 0 && (
                <span className="ml-1">({assignedUserIds.size} already assigned)</span>
              )}
            </Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              disabled={selectableUsers.length === 0}
            >
              {selectedUserIds.length === selectableUsers.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          {/* User list */}
          <ScrollArea className="h-[300px] border rounded-md">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Users className="h-8 w-8 mb-2" />
                <p className="text-sm">No team members found</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredUsers.map((user) => {
                  const isAlreadyAssigned = assignedUserIds.has(user.id);
                  return (
                    <label
                      key={user.id}
                      className={`flex items-center gap-3 p-2 rounded-md ${
                        isAlreadyAssigned
                          ? 'opacity-60 cursor-not-allowed'
                          : 'hover:bg-accent cursor-pointer'
                      }`}
                    >
                      <Checkbox
                        checked={selectedUserIds.includes(user.id)}
                        onCheckedChange={() => handleToggleUser(user.id)}
                        disabled={isAlreadyAssigned}
                      />
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        isAlreadyAssigned ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
                      }`}>
                        {getUserInitials(user.full_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">
                            {user.full_name || 'Unknown'}
                          </p>
                          {isAlreadyAssigned && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                              Assigned
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={selectedUserIds.length === 0 || isAssigning}
          >
            {isAssigning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              `Assign ${selectedUserIds.length} Member${selectedUserIds.length !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
