'use client';

import { useState, useCallback } from 'react';
import { Plus, GripVertical, Trash2, CheckCircle } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  useIssues,
  useCreateIssue,
  useDeleteIssue,
  useReorderIssues,
  useSolveIssue,
} from '@/hooks/queries/use-l10-issues';
import { useTeam } from '@/hooks/queries/use-l10-teams';
import { toast } from 'sonner';
import type { IssueWithCreator } from '@/types/l10';

interface IssuesTabProps {
  teamId: string;
}

export function IssuesTab({ teamId }: IssuesTabProps) {
  const { data: issues, isLoading } = useIssues(teamId);
  const [addOpen, setAddOpen] = useState(false);
  const [solveOpen, setSolveOpen] = useState(false);
  const [solvingIssue, setSolvingIssue] = useState<IssueWithCreator | null>(null);
  const reorderIssues = useReorderIssues();
  const deleteIssueMut = useDeleteIssue();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !issues) return;

      const oldIndex = issues.findIndex((i) => i.id === active.id);
      const newIndex = issues.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(issues, oldIndex, newIndex);
      const updates = reordered.map((issue, idx) => ({
        id: issue.id,
        priority_rank: idx + 1,
      }));

      try {
        await reorderIssues.mutateAsync(updates);
      } catch (error) {
        toast.error((error as Error).message);
      }
    },
    [issues, reorderIssues]
  );

  const handleSolve = (issue: IssueWithCreator) => {
    setSolvingIssue(issue);
    setSolveOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteIssueMut.mutateAsync(id);
      toast.success('Issue deleted');
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
        <h3 className="text-lg font-semibold">Issues (IDS)</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Issue
        </Button>
      </div>

      {!issues || issues.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
          <p>No open issues. Drag to prioritize during IDS.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={issues.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {issues.map((issue, idx) => (
                <SortableIssueCard
                  key={issue.id}
                  issue={issue}
                  rank={idx + 1}
                  onSolve={() => handleSolve(issue)}
                  onDelete={() => handleDelete(issue.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AddIssueDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        teamId={teamId}
      />

      {solvingIssue && (
        <SolveIssueDialog
          open={solveOpen}
          onOpenChange={setSolveOpen}
          issue={solvingIssue}
          teamId={teamId}
        />
      )}
    </div>
  );
}

function SortableIssueCard({
  issue,
  rank,
  onSolve,
  onDelete,
}: {
  issue: IssueWithCreator;
  rank: number;
  onSolve: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: issue.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border bg-background p-3 hover:bg-muted/30"
    >
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-xs font-mono text-muted-foreground w-6">#{rank}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{issue.title}</p>
        {issue.description && (
          <p className="text-xs text-muted-foreground truncate">{issue.description}</p>
        )}
      </div>
      {issue.source_type && (
        <Badge variant="outline" className="text-xs">
          {issue.source_type}
        </Badge>
      )}
      <Badge variant={issue.status === 'solving' ? 'default' : 'secondary'} className="text-xs">
        {issue.status}
      </Badge>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSolve} title="Solve">
          <CheckCircle className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete} title="Delete">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function AddIssueDialog({
  open,
  onOpenChange,
  teamId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const createIssue = useCreateIssue();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      await createIssue.mutateAsync({
        teamId,
        title: title.trim(),
        description: description.trim() || undefined,
      });
      toast.success('Issue added');
      onOpenChange(false);
      setTitle('');
      setDescription('');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Issue</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's the issue?" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="More context..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!title.trim() || createIssue.isPending}>
              {createIssue.isPending ? 'Adding...' : 'Add Issue'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SolveIssueDialog({
  open,
  onOpenChange,
  issue,
  teamId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: IssueWithCreator;
  teamId: string;
}) {
  const [todoTitle, setTodoTitle] = useState('');
  const [todoOwnerId, setTodoOwnerId] = useState('');
  const { data: team } = useTeam(teamId);
  const solveIssue = useSolveIssue();

  const handleSolve = async (withTodo: boolean) => {
    try {
      await solveIssue.mutateAsync({
        id: issue.id,
        todoTitle: withTodo ? todoTitle.trim() || undefined : undefined,
        todoOwnerId: withTodo ? todoOwnerId || undefined : undefined,
      });
      toast.success('Issue solved');
      onOpenChange(false);
      setTodoTitle('');
      setTodoOwnerId('');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const members = team?.team_members || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solve: {issue.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Create a to-do from this issue, or mark as solved without a to-do.
          </p>
          <div className="space-y-2">
            <Label>To-Do Title (optional)</Label>
            <Input
              value={todoTitle}
              onChange={(e) => setTodoTitle(e.target.value)}
              placeholder="Action item..."
            />
          </div>
          {todoTitle && (
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select value={todoOwnerId} onValueChange={setTodoOwnerId}>
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
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="secondary" onClick={() => handleSolve(false)} disabled={solveIssue.isPending}>
            Solve (no to-do)
          </Button>
          {todoTitle.trim() && (
            <Button onClick={() => handleSolve(true)} disabled={solveIssue.isPending}>
              Solve with To-Do
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
