'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, UserPlus } from 'lucide-react';
import {
  useTeam,
  useUpdateTeam,
  useDeleteTeam,
  useAddTeamMember,
  useRemoveTeamMember,
  useUpdateTeamMemberRole,
  useAllUsers,
} from '@/hooks/queries/use-l10-teams';
import { useL10TeamStore } from '@/lib/stores/l10-team-store';
import { useUser } from '@/contexts/user-context';
import { toast } from 'sonner';
import type { TeamMemberRole } from '@/types/l10';

interface TeamSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
}

export function TeamSettingsDialog({ open, onOpenChange, teamId }: TeamSettingsDialogProps) {
  const { data: team } = useTeam(teamId);
  const { data: allUsers } = useAllUsers();
  const { user } = useUser();
  const { setSelectedTeamId } = useL10TeamStore();

  const updateTeam = useUpdateTeam();
  const deleteTeamMutation = useDeleteTeam();
  const addMember = useAddTeamMember();
  const removeMember = useRemoveTeamMember();
  const updateRole = useUpdateTeamMemberRole();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [addUserId, setAddUserId] = useState('');

  // Initialize form when team data loads
  if (team && !initialized) {
    setName(team.name);
    setDescription(team.description || '');
    setInitialized(true);
  }

  // Reset when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) setInitialized(false);
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      await updateTeam.mutateAsync({
        id: teamId,
        name: name.trim(),
        description: description.trim() || null,
      });
      toast.success('Team updated');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this team? This cannot be undone.')) return;
    try {
      await deleteTeamMutation.mutateAsync(teamId);
      setSelectedTeamId(null);
      handleOpenChange(false);
      toast.success('Team deleted');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleAddMember = async () => {
    if (!addUserId) return;
    try {
      await addMember.mutateAsync({ teamId, userId: addUserId });
      setAddUserId('');
      toast.success('Member added');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      await removeMember.mutateAsync({ teamId, userId });
      toast.success('Member removed');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleRoleChange = async (userId: string, role: TeamMemberRole) => {
    try {
      await updateRole.mutateAsync({ teamId, userId, role });
      toast.success('Role updated');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const memberIds = new Set(team?.team_members?.map((m) => m.user_id) || []);
  const availableUsers = (allUsers || []).filter((u) => !memberIds.has(u.id));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Team Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Team info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="settings-name">Team Name</Label>
              <Input
                id="settings-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-desc">Description</Label>
              <Textarea
                id="settings-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <Button onClick={handleSave} size="sm" disabled={updateTeam.isPending}>
              Save Changes
            </Button>
          </div>

          {/* Members */}
          <div className="space-y-3">
            <Label>Members</Label>
            <div className="space-y-2">
              {team?.team_members?.map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded-md border p-2">
                  <span className="text-sm">
                    {member.profiles.full_name || member.profiles.email}
                  </span>
                  <div className="flex items-center gap-2">
                    <Select
                      value={member.role}
                      onValueChange={(role) =>
                        handleRoleChange(member.user_id, role as TeamMemberRole)
                      }
                    >
                      <SelectTrigger className="h-7 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="facilitator">Facilitator</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    {member.user_id !== user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleRemoveMember(member.user_id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add member */}
            {availableUsers.length > 0 && (
              <div className="flex gap-2">
                <Select value={addUserId} onValueChange={setAddUserId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Add member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  onClick={handleAddMember}
                  disabled={!addUserId || addMember.isPending}
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            Delete Team
          </Button>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
