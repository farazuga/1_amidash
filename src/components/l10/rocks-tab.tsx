'use client';

import { useState, useMemo } from 'react';
import { Plus, ArrowRightLeft, Trash2, Archive, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  useRocks,
  useCreateRock,
  useUpdateRock,
  useDeleteRock,
  useToggleRockStatus,
  useDropRockToIssue,
  useArchiveRock,
} from '@/hooks/queries/use-l10-rocks';
import { useTeam } from '@/hooks/queries/use-l10-teams';
import { useUser } from '@/contexts/user-context';
import { toast } from 'sonner';
import type { RockWithOwner, RockStatus, RockMilestone } from '@/types/l10';
import { cn } from '@/lib/utils';
import { RockMilestones } from './rock-milestones';

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
  const { user } = useUser();
  const [quarter, setQuarter] = useState(getCurrentQuarter());
  const [showArchived, setShowArchived] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editingRock, setEditingRock] = useState<RockWithOwner | null>(null);
  const [expandedRockId, setExpandedRockId] = useState<string | null>(null);
  const { data: rocks, isLoading } = useRocks(teamId, quarter, showArchived);
  const { data: team } = useTeam(teamId);
  const toggleStatus = useToggleRockStatus();
  const dropToIssue = useDropRockToIssue();
  const deleteRock = useDeleteRock();
  const archiveRock = useArchiveRock();

  // Check if current user is admin/facilitator
  const currentMember = team?.team_members?.find((m) => m.user_id === user?.id);
  const isAdmin = currentMember?.role === 'admin' || currentMember?.role === 'facilitator';

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

  const handleArchive = async (id: string) => {
    try {
      await archiveRock.mutateAsync(id);
      toast.success('Rock archived');
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
        <div className="flex items-center gap-3">
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Switch checked={showArchived} onCheckedChange={setShowArchived} id="show-archived" />
              <Label htmlFor="show-archived" className="text-sm">Show Archived</Label>
            </div>
          )}
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Rock
          </Button>
        </div>
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
                <th className="px-4 py-2 text-left font-medium w-28">Progress</th>
                <th className="px-4 py-2 text-left font-medium w-32">Owner</th>
                <th className="px-4 py-2 text-left font-medium w-24">Due</th>
                <th className="px-4 py-2 text-left font-medium w-28">Status</th>
                <th className="px-4 py-2 text-right font-medium w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rocks.map((rock) => {
                const badge = STATUS_BADGES[rock.status];
                const milestones = (rock.milestones || []) as RockMilestone[];
                const total = milestones.length;
                const complete = milestones.filter((m) => m.is_complete).length;
                const progressValue = total > 0 ? (complete / total) * 100 : 0;
                const isExpanded = expandedRockId === rock.id;
                const isDue = rock.due_date && new Date(rock.due_date + 'T00:00:00') < new Date();

                return (
                  <>
                    <tr
                      key={rock.id}
                      className={cn(
                        'border-b hover:bg-muted/30 cursor-pointer',
                        rock.is_archived && 'opacity-50'
                      )}
                      onClick={() => setExpandedRockId(isExpanded ? null : rock.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium truncate">{rock.title}</p>
                            {rock.description && (
                              <p className="text-xs text-muted-foreground truncate">{rock.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {total > 0 ? (
                          <div className="flex items-center gap-2">
                            <Progress value={progressValue} className="h-1.5 w-16" />
                            <span className="text-xs text-muted-foreground">{complete}/{total}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {rock.profiles?.full_name?.split(' ')[0] || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {rock.due_date ? (
                          <span className={cn(
                            'text-xs',
                            isDue && rock.status !== 'complete' ? 'text-destructive font-medium' : 'text-muted-foreground'
                          )}>
                            {new Date(rock.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={badge.variant}
                          className={cn('cursor-pointer', rock.status === 'on_track' && 'bg-green-600 hover:bg-green-700')}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggle(rock.id);
                          }}
                        >
                          {badge.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setEditingRock(rock)}
                            title="Edit Rock"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleDropToIssue(rock)}
                            title="Drop to Issues"
                          >
                            <ArrowRightLeft className="h-3 w-3" />
                          </Button>
                          {isAdmin && !rock.is_archived && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleArchive(rock.id)}
                              title="Archive"
                            >
                              <Archive className="h-3 w-3" />
                            </Button>
                          )}
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
                    {isExpanded && (
                      <tr key={`${rock.id}-milestones`} className="border-b bg-muted/10">
                        <td colSpan={6} className="px-8 py-2">
                          <RockMilestones rockId={rock.id} />
                        </td>
                      </tr>
                    )}
                  </>
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

      {editingRock && (
        <EditRockDialog
          open={!!editingRock}
          onOpenChange={(open) => { if (!open) setEditingRock(null); }}
          rock={editingRock}
          members={team?.team_members || []}
        />
      )}
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
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const createRock = useCreateRock();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      await createRock.mutateAsync({
        teamId,
        title: title.trim(),
        description: description.trim() || undefined,
        ownerId: ownerId || undefined,
        quarter,
        dueDate: dueDate || undefined,
      });
      toast.success('Rock added');
      onOpenChange(false);
      setTitle('');
      setDescription('');
      setOwnerId('');
      setDueDate('');
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
              <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details about this rock..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label>Due Date <span className="text-muted-foreground font-normal">(defaults to quarter end)</span></Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
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

function EditRockDialog({
  open,
  onOpenChange,
  rock,
  members,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rock: RockWithOwner;
  members: { user_id: string; profiles: { id: string; full_name: string | null; email: string } }[];
}) {
  const [title, setTitle] = useState(rock.title);
  const [description, setDescription] = useState(rock.description || '');
  const [ownerId, setOwnerId] = useState(rock.owner_id || '');
  const [dueDate, setDueDate] = useState(rock.due_date || '');
  const [status, setStatus] = useState<RockStatus>(rock.status);
  const updateRock = useUpdateRock();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      await updateRock.mutateAsync({
        id: rock.id,
        title: title.trim(),
        description: description.trim() || null,
        ownerId: ownerId || null,
        dueDate: dueDate || null,
        status,
      });
      toast.success('Rock updated');
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Rock</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details about this rock..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as RockStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_BADGES).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!title.trim() || updateRock.isPending}>
              {updateRock.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
