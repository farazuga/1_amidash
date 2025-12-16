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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Users, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { getUserInitials } from '@/lib/calendar/utils';
import { useAdminUsers, useCreateAssignment } from '@/hooks/queries/use-assignments';
import { toast } from 'sonner';
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

  const { data: adminUsers = [], isLoading } = useAdminUsers();
  const createAssignment = useCreateAssignment();

  const filteredUsers = adminUsers.filter(
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

  const handleSelectAll = () => {
    if (selectedUserIds.length === filteredUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredUsers.map((u) => u.id));
    }
  };

  const handleAssign = async () => {
    if (selectedUserIds.length === 0) return;

    setIsAssigning(true);
    let successCount = 0;
    let errorCount = 0;

    for (const userId of selectedUserIds) {
      try {
        await createAssignment.mutateAsync({
          projectId,
          userId,
          bookingStatus: 'pencil' as BookingStatus,
        });
        successCount++;
      } catch (error) {
        errorCount++;
        console.error('Failed to assign user:', error);
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
              {selectedUserIds.length} of {filteredUsers.length} selected
            </Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedUserIds.length === filteredUsers.length ? 'Deselect All' : 'Select All'}
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
                {filteredUsers.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedUserIds.includes(user.id)}
                      onCheckedChange={() => handleToggleUser(user.id)}
                    />
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                      {getUserInitials(user.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {user.full_name || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                  </label>
                ))}
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
