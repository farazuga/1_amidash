'use client';

import { useState } from 'react';
import { Trash2, Archive, ChevronDown, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUpdateRock, useDeleteRock, useArchiveRock, useRockTodos } from '@/hooks/queries/use-l10-rocks';
import { useMilestones, useToggleMilestone, useUpdateMilestone } from '@/hooks/queries/use-l10-milestones';
import { useToggleTodo } from '@/hooks/queries/use-l10-todos';
import { useTeam } from '@/hooks/queries/use-l10-teams';
import { toast } from 'sonner';
import type { RockWithOwner, RockStatus, RockMilestoneWithOwner } from '@/types/l10';
import { cn } from '@/lib/utils';
import { L10Comments } from './l10-comments';

const STATUS_BADGES: Record<RockStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  on_track: { label: 'On Track', variant: 'default' },
  off_track: { label: 'Off Track', variant: 'destructive' },
  complete: { label: 'Complete', variant: 'secondary' },
  dropped: { label: 'Dropped', variant: 'outline' },
};

interface RockDetailSheetProps {
  rock: RockWithOwner | null;
  onClose: () => void;
  teamId: string;
}

export function RockDetailSheet({ rock, onClose, teamId }: RockDetailSheetProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const updateRock = useUpdateRock();
  const deleteRock = useDeleteRock();
  const archiveRock = useArchiveRock();
  const { data: milestones } = useMilestones(rock?.id ?? null);
  const { data: linkedTodos } = useRockTodos(rock?.id ?? null);
  const toggleTodo = useToggleTodo();
  const { data: team } = useTeam(teamId);

  const members = team?.team_members || [];

  const handleTitleSave = async () => {
    if (!rock || !titleValue.trim()) return;
    setEditingTitle(false);
    if (titleValue.trim() !== rock.title) {
      try {
        await updateRock.mutateAsync({ id: rock.id, title: titleValue.trim() });
      } catch (error) {
        toast.error((error as Error).message);
      }
    }
  };

  const handleDescSave = async () => {
    if (!rock) return;
    setEditingDesc(false);
    const newDesc = descValue.trim() || null;
    if (newDesc !== (rock.description || null)) {
      try {
        await updateRock.mutateAsync({ id: rock.id, description: newDesc });
      } catch (error) {
        toast.error((error as Error).message);
      }
    }
  };

  const handleDelete = async () => {
    if (!rock) return;
    setDeleteConfirmOpen(false);
    onClose();
    try {
      await deleteRock.mutateAsync(rock.id);
      toast.success('Rock deleted');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleArchive = async () => {
    if (!rock) return;
    onClose();
    try {
      await archiveRock.mutateAsync(rock.id);
      toast.success('Rock archived');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!rock) return;
    try {
      await updateRock.mutateAsync({ id: rock.id, status });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleOwnerChange = async (ownerId: string) => {
    if (!rock) return;
    try {
      await updateRock.mutateAsync({ id: rock.id, ownerId: ownerId || null });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDueDateChange = async (dueDate: string) => {
    if (!rock) return;
    try {
      await updateRock.mutateAsync({ id: rock.id, dueDate: dueDate || null });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleToggleTodo = async (id: string) => {
    try {
      await toggleTodo.mutateAsync(id);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const total = milestones?.length || 0;
  const complete = milestones?.filter((m) => m.is_complete).length || 0;
  const progressValue = total > 0 ? (complete / total) * 100 : 0;

  const badge = rock ? STATUS_BADGES[rock.status] : null;

  return (
    <>
      <Sheet open={!!rock} onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {rock && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2 pr-8">
                  {badge && (
                    <Badge
                      variant={badge.variant}
                      className={cn(rock.status === 'on_track' && 'bg-green-600')}
                    >
                      {badge.label}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">{rock.quarter}</Badge>
                </div>
                {editingTitle ? (
                  <Input
                    value={titleValue}
                    onChange={(e) => setTitleValue(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleTitleSave();
                      if (e.key === 'Escape') setEditingTitle(false);
                    }}
                    autoFocus
                    className="text-lg font-semibold"
                  />
                ) : (
                  <SheetTitle
                    className="cursor-pointer hover:text-primary transition-colors"
                    onClick={() => {
                      setTitleValue(rock.title);
                      setEditingTitle(true);
                    }}
                  >
                    {rock.title}
                  </SheetTitle>
                )}
                <SheetDescription className="sr-only">Rock details</SheetDescription>
              </SheetHeader>

              <div className="px-4 space-y-5">
                {/* Description */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Description</Label>
                  {editingDesc ? (
                    <div className="space-y-2">
                      <Textarea
                        value={descValue}
                        onChange={(e) => setDescValue(e.target.value)}
                        rows={5}
                        placeholder="Add a description... (supports **markdown**)"
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => setEditingDesc(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleDescSave}>Save</Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="min-h-[60px] rounded-md border p-3 cursor-pointer hover:bg-muted/30 transition-colors text-sm"
                      onClick={() => {
                        setDescValue(rock.description || '');
                        setEditingDesc(true);
                      }}
                    >
                      {rock.description ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{rock.description}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic">Click to add a description...</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Owner & Due Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Owner</Label>
                    <Select value={rock.owner_id || ''} onValueChange={handleOwnerChange}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
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
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Due Date</Label>
                    <Input
                      type="date"
                      value={rock.due_date || ''}
                      onChange={(e) => handleDueDateChange(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Status</Label>
                  <Select value={rock.status} onValueChange={handleStatusChange}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_BADGES).map(([key, { label }]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Milestones */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Milestones</Label>
                  {total > 0 && (
                    <div className="flex items-center gap-3 mb-2">
                      <Progress value={progressValue} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {complete}/{total}
                      </span>
                    </div>
                  )}
                  {milestones && milestones.length > 0 ? (
                    <div className="space-y-1">
                      {milestones.map((milestone) => (
                        <MilestoneRow key={milestone.id} milestone={milestone} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No milestones yet.</p>
                  )}
                </div>

                {/* Linked Todos */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Linked To-Dos</Label>
                  {linkedTodos && linkedTodos.length > 0 ? (
                    <div className="space-y-1">
                      {linkedTodos.map((todo) => (
                        <div key={todo.id} className="flex items-center gap-2 rounded border p-2">
                          <Checkbox
                            checked={todo.is_done}
                            onCheckedChange={() => handleToggleTodo(todo.id)}
                          />
                          <span className={cn('text-sm flex-1', todo.is_done && 'line-through text-muted-foreground')}>
                            {todo.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {todo.profiles?.full_name?.split(' ')[0] || ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No linked to-dos.</p>
                  )}
                </div>

                {/* Comments */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Comments</Label>
                  <L10Comments entityType="rock" entityId={rock.id} />
                </div>
              </div>

              <SheetFooter className="border-t gap-2">
                {!rock.is_archived && (
                  <Button variant="outline" onClick={handleArchive}>
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </Button>
                )}
                <Button variant="destructive" onClick={() => setDeleteConfirmOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rock</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{rock?.title}&quot; and all its milestones. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function MilestoneRow({ milestone }: { milestone: RockMilestoneWithOwner }) {
  const [expanded, setExpanded] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState('');
  const toggleMilestone = useToggleMilestone();
  const updateMilestone = useUpdateMilestone();

  const isOverdue = milestone.due_date && !milestone.is_complete &&
    new Date(milestone.due_date + 'T00:00:00') < new Date();

  const handleToggle = async () => {
    try {
      await toggleMilestone.mutateAsync(milestone.id);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDescSave = async () => {
    setEditingDesc(false);
    const newDesc = descValue.trim() || null;
    if (newDesc !== (milestone.description || null)) {
      try {
        await updateMilestone.mutateAsync({ id: milestone.id, description: newDesc });
      } catch (error) {
        toast.error((error as Error).message);
      }
    }
  };

  return (
    <div className="rounded border">
      <div className="flex items-center gap-2 p-2">
        <Checkbox
          checked={milestone.is_complete}
          onCheckedChange={handleToggle}
        />
        <span className={cn('text-sm flex-1', milestone.is_complete && 'line-through text-muted-foreground')}>
          {milestone.title}
        </span>
        {milestone.due_date && (
          <span className={cn(
            'text-xs',
            isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'
          )}>
            {new Date(milestone.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </Button>
      </div>
      {expanded && (
        <div className="border-t px-3 py-2 space-y-3 bg-muted/10">
          {/* Milestone description */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Description</Label>
            {editingDesc ? (
              <div className="space-y-2">
                <Textarea
                  value={descValue}
                  onChange={(e) => setDescValue(e.target.value)}
                  rows={3}
                  placeholder="Add a description..."
                  autoFocus
                  className="text-sm"
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingDesc(false)}>Cancel</Button>
                  <Button size="sm" className="h-7 text-xs" onClick={handleDescSave}>Save</Button>
                </div>
              </div>
            ) : (
              <div
                className="min-h-[40px] rounded-md border p-2 cursor-pointer hover:bg-muted/30 transition-colors text-sm"
                onClick={() => {
                  setDescValue(milestone.description || '');
                  setEditingDesc(true);
                }}
              >
                {milestone.description ? (
                  <p className="text-sm whitespace-pre-wrap">{milestone.description}</p>
                ) : (
                  <p className="text-muted-foreground italic text-xs">Click to add a description...</p>
                )}
              </div>
            )}
          </div>
          {/* Milestone comments */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Comments</Label>
            <L10Comments entityType="milestone" entityId={milestone.id} />
          </div>
        </div>
      )}
    </div>
  );
}
