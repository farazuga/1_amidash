'use client';

import { useState } from 'react';
import { Plus, Trash2, Mountain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Switch } from '@/components/ui/switch';
import {
  useTodos,
  useCreateTodo,
  useToggleTodo,
  useDeleteTodo,
} from '@/hooks/queries/use-l10-todos';
import { useTeam } from '@/hooks/queries/use-l10-teams';
import { useUser } from '@/contexts/user-context';
import { toast } from 'sonner';
import type { TodoWithOwner } from '@/types/l10';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

interface TodosTabProps {
  teamId: string;
}

export function TodosTab({ teamId }: TodosTabProps) {
  const [showDone, setShowDone] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const { data: todos, isLoading } = useTodos(teamId, showDone);
  const toggleTodo = useToggleTodo();
  const deleteTodo = useDeleteTodo();

  const handleToggle = async (id: string) => {
    try {
      await toggleTodo.mutateAsync(id);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTodo.mutateAsync(id);
      toast.success('To-do deleted');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-md bg-muted" />;
  }

  const doneTodos = todos?.filter((t) => t.is_done) || [];
  const activeTodos = todos?.filter((t) => !t.is_done) || [];
  const completionRate = todos && todos.length > 0
    ? Math.round((doneTodos.length / todos.length) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">To-Dos</h3>
          {showDone && todos && todos.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {completionRate}% complete ({doneTodos.length}/{todos.length})
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={showDone} onCheckedChange={setShowDone} id="show-done" />
            <Label htmlFor="show-done" className="text-sm">Show done</Label>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add To-Do
          </Button>
        </div>
      </div>

      {(!todos || (activeTodos.length === 0 && (!showDone || doneTodos.length === 0))) ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
          <p>{showDone ? 'No to-dos yet.' : 'All to-dos completed! Add new ones.'}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {activeTodos.map((todo) => (
            <TodoItem key={todo.id} todo={todo} onToggle={handleToggle} onDelete={handleDelete} />
          ))}
          {showDone && doneTodos.length > 0 && (
            <>
              {activeTodos.length > 0 && (
                <div className="border-t my-3" />
              )}
              {doneTodos.map((todo) => (
                <TodoItem key={todo.id} todo={todo} onToggle={handleToggle} onDelete={handleDelete} />
              ))}
            </>
          )}
        </div>
      )}

      <AddTodoDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        teamId={teamId}
      />
    </div>
  );
}

function TodoItem({
  todo,
  onToggle,
  onDelete,
}: {
  todo: TodoWithOwner;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isOverdue = todo.due_date && !todo.is_done && new Date(todo.due_date + 'T00:00:00') < new Date();
  const sourceMeta = todo.source_issue?.source_meta as Record<string, string> | null;

  return (
    <div className="flex items-center gap-3 rounded-md border p-3 hover:bg-muted/30">
      <Checkbox
        checked={todo.is_done}
        onCheckedChange={() => onToggle(todo.id)}
      />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm', todo.is_done && 'line-through text-muted-foreground')}>
          {todo.title}
        </p>
        {todo.source_issue && (
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {sourceMeta?.clientName && sourceMeta?.salesOrder ? (
              <Link
                href={`/projects/${sourceMeta.salesOrder}`}
                className="text-xs text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {sourceMeta.clientName}
              </Link>
            ) : (
              <span className="text-xs text-muted-foreground">↳ {todo.source_issue.title}</span>
            )}
            {sourceMeta?.salesOrderUrl && (
              <a
                href={sourceMeta.salesOrderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />
                {sourceMeta.salesOrder || 'Odoo'}
              </a>
            )}
          </div>
        )}
        {todo.source_milestone && (
          <div className="flex items-center gap-1 mt-0.5">
            <Mountain className="h-3 w-3 text-primary" />
            <span className="text-xs text-primary font-medium">
              {todo.source_milestone.rock?.title ? `↳ ${todo.source_milestone.rock.title}` : todo.source_milestone.title}
            </span>
          </div>
        )}
      </div>
      <span className="text-xs text-muted-foreground">
        {todo.profiles?.full_name?.split(' ')[0] || ''}
      </span>
      {todo.due_date && (
        <span className={cn(
          'text-xs',
          isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'
        )}>
          {new Date(todo.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-destructive"
        onClick={() => onDelete(todo.id)}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

function AddTodoDialog({
  open,
  onOpenChange,
  teamId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
}) {
  const { user } = useUser();
  const [title, setTitle] = useState('');
  const [ownerId, setOwnerId] = useState(user?.id ?? '');
  const [dueDate, setDueDate] = useState('');
  const { data: team } = useTeam(teamId);
  const createTodo = useCreateTodo();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      await createTodo.mutateAsync({
        teamId,
        title: title.trim(),
        ownerId: ownerId || undefined,
        dueDate: dueDate || undefined,
      });
      toast.success('To-do added');
      onOpenChange(false);
      setTitle('');
      setOwnerId(user?.id ?? '');
      setDueDate('');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const members = team?.team_members || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add To-Do</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Owner</Label>
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger><SelectValue placeholder="Assign to..." /></SelectTrigger>
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
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!title.trim() || createTodo.isPending}>
              {createTodo.isPending ? 'Adding...' : 'Add To-Do'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
