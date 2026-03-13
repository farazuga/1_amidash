'use client';

import { useState, useCallback } from 'react';
import { GripVertical, MessageSquare, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  useReorderIssues,
  useUpdateIssue,
  useSolveIssue,
} from '@/hooks/queries/use-l10-issues';
import { useTeam } from '@/hooks/queries/use-l10-teams';
import { toast } from 'sonner';
import type { IssueWithCreator } from '@/types/l10';
import { cn } from '@/lib/utils';

interface IdsSegmentProps {
  teamId: string;
}

export function IdsSegment({ teamId }: IdsSegmentProps) {
  const { data: issues, isLoading } = useIssues(teamId);
  const { data: team } = useTeam(teamId);
  const reorderIssues = useReorderIssues();
  const updateIssue = useUpdateIssue();
  const solveIssueMut = useSolveIssue();
  const [solvingId, setSolvingId] = useState<string | null>(null);
  const [todoTitle, setTodoTitle] = useState('');
  const [todoOwnerId, setTodoOwnerId] = useState('');

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
      try {
        await reorderIssues.mutateAsync(
          reordered.map((issue, idx) => ({ id: issue.id, priority_rank: idx + 1 }))
        );
      } catch (error) {
        toast.error((error as Error).message);
      }
    },
    [issues, reorderIssues]
  );

  const handleStartSolving = async (issue: IssueWithCreator) => {
    try {
      await updateIssue.mutateAsync({ id: issue.id, status: 'solving' });
      setSolvingId(issue.id);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleSolve = async (withTodo: boolean) => {
    if (!solvingId) return;
    try {
      await solveIssueMut.mutateAsync({
        id: solvingId,
        todoTitle: withTodo ? todoTitle.trim() || undefined : undefined,
        todoOwnerId: withTodo ? todoOwnerId || undefined : undefined,
      });
      toast.success('Issue solved');
      setSolvingId(null);
      setTodoTitle('');
      setTodoOwnerId('');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-md bg-muted" />;
  }

  const solvingIssue = issues?.find((i) => i.id === solvingId);
  const members = team?.team_members || [];

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div>
        <h4 className="font-semibold">IDS - Identify, Discuss, Solve</h4>
        <p className="text-sm text-muted-foreground">Drag to prioritize. Select top issue to solve.</p>
      </div>

      {/* Solving panel */}
      {solvingIssue && (
        <div className="rounded-md border-2 border-primary bg-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Solving: {solvingIssue.title}</span>
          </div>
          <p className="text-xs text-muted-foreground">Discuss the root cause, then create a to-do or mark as solved.</p>
          <div className="flex gap-2">
            <Input value={todoTitle} onChange={(e) => setTodoTitle(e.target.value)} placeholder="To-Do from this issue..." className="flex-1" />
            {todoTitle && (
              <Select value={todoOwnerId} onValueChange={setTodoOwnerId}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Owner..." /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.profiles.full_name || m.profiles.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setSolvingId(null); setTodoTitle(''); setTodoOwnerId(''); }}>
              Cancel
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleSolve(false)} disabled={solveIssueMut.isPending}>
              Solve (no to-do)
            </Button>
            {todoTitle.trim() && (
              <Button size="sm" onClick={() => handleSolve(true)} disabled={solveIssueMut.isPending}>
                Solve with To-Do
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Issue list */}
      {!issues || issues.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No open issues.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {issues.map((issue, idx) => (
                <SortableIssue
                  key={issue.id}
                  issue={issue}
                  rank={idx + 1}
                  isSolving={issue.id === solvingId}
                  onStartSolving={() => handleStartSolving(issue)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableIssue({
  issue,
  rank,
  isSolving,
  onStartSolving,
}: {
  issue: IssueWithCreator;
  rank: number;
  isSolving: boolean;
  onStartSolving: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: issue.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-md border p-2',
        isSolving && 'border-primary bg-primary/5'
      )}
    >
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-xs font-mono text-muted-foreground w-5">#{rank}</span>
      <span className="flex-1 text-sm">{issue.title}</span>
      {issue.status === 'solving' ? (
        <Badge>Solving</Badge>
      ) : (
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onStartSolving}>
          <CheckCircle className="mr-1 h-3 w-3" />
          Solve
        </Button>
      )}
    </div>
  );
}
