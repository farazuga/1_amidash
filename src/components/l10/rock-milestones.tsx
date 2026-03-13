'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  useMilestones,
  useCreateMilestone,
  useUpdateMilestone,
  useToggleMilestone,
  useDeleteMilestone,
} from '@/hooks/queries/use-l10-milestones';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface RockMilestonesProps {
  rockId: string;
}

export function RockMilestones({ rockId }: RockMilestonesProps) {
  const { data: milestones, isLoading } = useMilestones(rockId);
  const toggleMilestone = useToggleMilestone();
  const updateMilestone = useUpdateMilestone();
  const deleteMilestone = useDeleteMilestone();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');

  const handleToggle = async (id: string) => {
    try {
      await toggleMilestone.mutateAsync(id);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMilestone.mutateAsync(id);
      toast.success('Milestone deleted');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const startEditing = (milestone: { id: string; title: string; due_date: string | null }) => {
    setEditingId(milestone.id);
    setEditTitle(milestone.title);
    setEditDate(milestone.due_date || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditTitle('');
    setEditDate('');
  };

  const saveTitle = async (id: string) => {
    const trimmed = editTitle.trim();
    if (!trimmed) { cancelEditing(); return; }
    try {
      await updateMilestone.mutateAsync({ id, title: trimmed });
    } catch (error) {
      toast.error((error as Error).message);
    }
    setEditingId(null);
  };

  const saveDate = async (id: string, newDate: string) => {
    try {
      await updateMilestone.mutateAsync({ id, dueDate: newDate || null });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  if (isLoading) {
    return <div className="h-16 animate-pulse rounded-md bg-muted" />;
  }

  const total = milestones?.length || 0;
  const complete = milestones?.filter((m) => m.is_complete).length || 0;
  const progressValue = total > 0 ? (complete / total) * 100 : 0;

  return (
    <div className="space-y-3 py-2">
      {total > 0 && (
        <div className="flex items-center gap-3">
          <Progress value={progressValue} className="h-2 flex-1" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {complete}/{total} milestones
          </span>
        </div>
      )}

      {milestones && milestones.length > 0 && (
        <div className="space-y-1">
          {milestones.map((milestone) => {
            const isOverdue = milestone.due_date && !milestone.is_complete &&
              new Date(milestone.due_date + 'T00:00:00') < new Date();
            const isEditing = editingId === milestone.id;

            return (
              <div
                key={milestone.id}
                className="group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/30"
              >
                <Checkbox
                  checked={milestone.is_complete}
                  onCheckedChange={() => handleToggle(milestone.id)}
                />
                {isEditing ? (
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => saveTitle(milestone.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); saveTitle(milestone.id); }
                      if (e.key === 'Escape') cancelEditing();
                    }}
                    className="h-7 text-sm flex-1"
                    autoFocus
                  />
                ) : (
                  <span
                    className={cn(
                      'flex-1 text-sm cursor-pointer rounded px-1 -mx-1 hover:bg-muted/50',
                      milestone.is_complete && 'line-through text-muted-foreground'
                    )}
                    onClick={() => startEditing(milestone)}
                  >
                    {milestone.title}
                  </span>
                )}
                {milestone.profiles?.full_name && (
                  <span className="text-xs text-muted-foreground">
                    {milestone.profiles.full_name.split(' ')[0]}
                  </span>
                )}
                {isEditing ? (
                  <Input
                    type="date"
                    value={editDate}
                    onChange={(e) => {
                      setEditDate(e.target.value);
                      saveDate(milestone.id, e.target.value);
                    }}
                    className="h-7 text-xs w-36"
                  />
                ) : milestone.due_date ? (
                  <span
                    className={cn(
                      'text-xs cursor-pointer rounded px-1 hover:bg-muted/50',
                      isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'
                    )}
                    onClick={() => startEditing(milestone)}
                  >
                    {new Date(milestone.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                ) : (
                  <span
                    className="text-xs text-muted-foreground/50 cursor-pointer rounded px-1 hover:bg-muted/50 hover:text-muted-foreground"
                    onClick={() => startEditing(milestone)}
                  >
                    + date
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 hover:opacity-100"
                  onClick={() => handleDelete(milestone.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {showAdd ? (
        <AddMilestoneForm
          rockId={rockId}
          onClose={() => setShowAdd(false)}
        />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => setShowAdd(true)}
        >
          <Plus className="mr-1 h-3 w-3" />
          Add Milestone
        </Button>
      )}
    </div>
  );
}

function AddMilestoneForm({
  rockId,
  onClose,
}: {
  rockId: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const createMilestone = useCreateMilestone();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      await createMilestone.mutateAsync({
        rockId,
        title: title.trim(),
        dueDate: dueDate || undefined,
      });
      setTitle('');
      setDueDate('');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Milestone title..."
        className="h-8 text-sm flex-1"
        autoFocus
      />
      <Input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="h-8 text-sm w-36"
      />
      <Button type="submit" size="sm" className="h-8" disabled={!title.trim() || createMilestone.isPending}>
        Add
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-8" onClick={onClose}>
        Cancel
      </Button>
    </form>
  );
}
