'use client';

import { useState } from 'react';
import { Trash2, ExternalLink, Mountain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUser } from '@/contexts/user-context';
import { useMyTodos, useToggleTodo, useDeleteTodo } from '@/hooks/queries/use-l10-todos';
import { useTeams } from '@/hooks/queries/use-l10-teams';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { MyTodoWithTeam } from '@/app/(dashboard)/l10/todos-actions';

export function MyTodosPage() {
  const { user } = useUser();
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const { data: teams } = useTeams();
  const { data: allTodos, isLoading } = useMyTodos(
    user?.id ?? null,
    teamFilter !== 'all' ? teamFilter : undefined
  );
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
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">My To-Dos</h1>
        <div className="h-64 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  // Split into my todos and team todos
  const myTodos = allTodos?.filter((t) => t.owner_id === user?.id) || [];
  const teamTodos = allTodos?.filter((t) => t.owner_id !== user?.id) || [];

  const myActive = myTodos.filter((t) => !t.is_done);
  const myDone = myTodos.filter((t) => t.is_done);

  // Per-person completion stats for team todos
  const personStats = new Map<string, { name: string; done: number; total: number }>();
  for (const todo of teamTodos) {
    const ownerId = todo.owner_id || 'unassigned';
    const name = todo.profiles?.full_name || todo.profiles?.email || 'Unassigned';
    if (!personStats.has(ownerId)) {
      personStats.set(ownerId, { name, done: 0, total: 0 });
    }
    const stats = personStats.get(ownerId)!;
    stats.total++;
    if (todo.is_done) stats.done++;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My To-Dos</h1>
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Teams" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teams</SelectItem>
            {(teams || []).map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* My To-Dos section */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">My To-Dos</h2>
          {myTodos.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {myDone.length}/{myTodos.length} ({myTodos.length > 0 ? Math.round((myDone.length / myTodos.length) * 100) : 0}%)
            </span>
          )}
        </div>

        {myActive.length === 0 && myDone.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No to-dos assigned to you.</p>
        ) : (
          <div className="space-y-1">
            {myActive.map((todo) => (
              <TodoRow key={todo.id} todo={todo} onToggle={handleToggle} onDelete={handleDelete} />
            ))}
            {myDone.length > 0 && myActive.length > 0 && (
              <div className="border-t my-2" />
            )}
            {myDone.map((todo) => (
              <TodoRow key={todo.id} todo={todo} onToggle={handleToggle} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </section>

      {/* Team To-Dos section */}
      {teamTodos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Team To-Dos</h2>
          {/* Per-person stats */}
          <div className="flex flex-wrap gap-2">
            {Array.from(personStats.values()).map((stats) => (
              <Badge key={stats.name} variant="outline" className="text-xs">
                {stats.name}: {stats.done}/{stats.total} ({stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0}%)
              </Badge>
            ))}
          </div>
          <div className="space-y-1">
            {teamTodos.filter((t) => !t.is_done).map((todo) => (
              <TodoRow key={todo.id} todo={todo} onToggle={handleToggle} onDelete={handleDelete} emphasized />
            ))}
            {teamTodos.filter((t) => t.is_done).length > 0 && teamTodos.filter((t) => !t.is_done).length > 0 && (
              <div className="border-t my-2" />
            )}
            {teamTodos.filter((t) => t.is_done).map((todo) => (
              <TodoRow key={todo.id} todo={todo} onToggle={handleToggle} onDelete={handleDelete} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TodoRow({
  todo,
  onToggle,
  onDelete,
  emphasized,
}: {
  todo: MyTodoWithTeam;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  emphasized?: boolean;
}) {
  const isOverdue = todo.due_date && !todo.is_done && new Date(todo.due_date + 'T00:00:00') < new Date();
  const sourceMeta = todo.source_issue?.source_meta as Record<string, string> | null;
  const isMilestoneTodo = !!todo.source_milestone;

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-md border p-3 hover:bg-muted/30',
      emphasized && 'border-l-4 border-l-primary bg-primary/5',
      isMilestoneTodo && 'border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20'
    )}>
      <Checkbox
        checked={todo.is_done}
        onCheckedChange={() => onToggle(todo.id)}
      />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm', todo.is_done && 'line-through text-muted-foreground')}>
          {todo.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {todo.team_name && (
            <span className="text-xs text-muted-foreground">{todo.team_name}</span>
          )}
          {sourceMeta?.clientName && sourceMeta?.salesOrder ? (
            <Link
              href={`/projects/${sourceMeta.salesOrder}`}
              className="text-xs text-primary hover:underline"
            >
              {sourceMeta.clientName}
            </Link>
          ) : todo.source_issue ? (
            <span className="text-xs text-muted-foreground">↳ {todo.source_issue.title}</span>
          ) : null}
          {sourceMeta?.salesOrderUrl && (
            <a
              href={sourceMeta.salesOrderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              {sourceMeta.salesOrder || 'Odoo'}
            </a>
          )}
          {todo.source_milestone && (
            <div className="flex items-center gap-1">
              <Mountain className="h-3.5 w-3.5 text-amber-600" />
              <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
                {todo.source_milestone.rock?.title ? `↳ ${todo.source_milestone.rock.title}` : todo.source_milestone.title}
              </span>
            </div>
          )}
        </div>
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
