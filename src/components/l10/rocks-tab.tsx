'use client';

import { useState, useMemo } from 'react';
import { Plus, ArrowRightLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useRocks,
  useCreateRock,
  useUpdateRock,
  useDeleteRock,
  useToggleRockStatus,
  useDropRockToIssue,
} from '@/hooks/queries/use-l10-rocks';
import { useTeam } from '@/hooks/queries/use-l10-teams';
import { toast } from 'sonner';
import type { RockWithOwner, RockStatus } from '@/types/l10';
import { cn } from '@/lib/utils';

function getCurrentQuarter(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}

const STATUS_BADGES: Record<RockStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  on_track: { label: 'On Track', variant: 'default' },
  off_track: { label: 'Off Track', variant: 'destructive' },
  complete: { label: 'Complete', variant: 'secondary' },
  dropped: { label: 'Dropped', variant: 'outline' },
};

interface RocksTabProps {
  teamId: string;
}

export function RocksTab({ teamId }: RocksTabProps) {
  const [quarter, setQuarter] = useState(getCurrentQuarter());
  const [addOpen, setAddOpen] = useState(false);
  const { data: rocks, isLoading } = useRocks(teamId, quarter);
  const { data: team } = useTeam(teamId);
  const toggleStatus = useToggleRockStatus();
  const dropToIssue = useDropRockToIssue();
  const deleteRock = useDeleteRock();

  // Generate quarter options (current +/- 2)
  const quarterOptions = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const currentQ = Math.ceil((now.getMonth() + 1) / 3);
    const options: string[] = [];
    for (let offset = -2; offset <= 2; offset++) {
      let q = currentQ + offset;
      let y = year;
      while (q < 1) { q += 4; y--; }
      while (q > 4) { q -= 4; y++; }
      options.push(`${y}-Q${q}`);
    }
    return options;
  }, []);

  const handleToggle = async (id: string) => {
    try {
      await toggleStatus.mutateAsync(id);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDropToIssue = async (rock: RockWithOwner) => {
    try {
      await dropToIssue.mutateAsync(rock.id);
      toast.success(`"${rock.title}" added to Issues`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRock.mutateAsync(id);
      toast.success('Rock deleted');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-md bg-muted" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">Rocks</h3>
          <Select value={quarter} onValueChange={setQuarter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {quarterOptions.map((q) => (
                <SelectItem key={q} value={q}>{q}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Rock
        </Button>
      </div>

      {!rocks || rocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
          <p>No rocks for {quarter}. Add your quarterly goals.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Rock</th>
                <th className="px-4 py-2 text-left font-medium w-32">Owner</th>
                <th className="px-4 py-2 text-left font-medium w-28">Status</th>
                <th className="px-4 py-2 text-right font-medium w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rocks.map((rock) => {
                const badge = STATUS_BADGES[rock.status];
                return (
                  <tr key={rock.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3">{rock.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {rock.profiles?.full_name?.split(' ')[0] || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={badge.variant}
                        className={cn('cursor-pointer', rock.status === 'on_track' && 'bg-green-600 hover:bg-green-700')}
                        onClick={() => handleToggle(rock.id)}
                      >
                        {badge.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDropToIssue(rock)}
                          title="Drop to Issues"
                        >
                          <ArrowRightLeft className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDelete(rock.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AddRockDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        teamId={teamId}
        quarter={quarter}
        members={team?.team_members || []}
      />
    </div>
  );
}

function AddRockDialog({
  open,
  onOpenChange,
  teamId,
  quarter,
  members,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  quarter: string;
  members: { user_id: string; profiles: { id: string; full_name: string | null; email: string } }[];
}) {
  const [title, setTitle] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const createRock = useCreateRock();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      await createRock.mutateAsync({
        teamId,
        title: title.trim(),
        ownerId: ownerId || undefined,
        quarter,
      });
      toast.success('Rock added');
      onOpenChange(false);
      setTitle('');
      setOwnerId('');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Rock ({quarter})</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Launch new product" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Owner</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger><SelectValue placeholder="Select owner..." /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.profiles.full_name || m.profiles.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!title.trim() || createRock.isPending}>
              {createRock.isPending ? 'Adding...' : 'Add Rock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
