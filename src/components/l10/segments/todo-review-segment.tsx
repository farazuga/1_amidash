'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Mountain } from 'lucide-react';
import { useTodos, useToggleTodo } from '@/hooks/queries/use-l10-todos';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TodoReviewSegmentProps {
  teamId: string;
}

export function TodoReviewSegment({ teamId }: TodoReviewSegmentProps) {
  const { data: todos, isLoading } = useTodos(teamId, true); // show all including done
  const toggleTodo = useToggleTodo();

  const handleToggle = async (id: string) => {
    try {
      await toggleTodo.mutateAsync(id);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-md bg-muted" />;
  }

  const allTodos = todos || [];
  const doneCount = allTodos.filter((t) => t.is_done).length;
  const completionRate = allTodos.length > 0 ? Math.round((doneCount / allTodos.length) * 100) : 0;

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold">To-Do Review</h4>
          <p className="text-sm text-muted-foreground">Check off completed to-dos from last week.</p>
        </div>
        <div className="text-right">
          <p className={cn(
            'text-2xl font-bold',
            completionRate >= 90 ? 'text-green-600' : completionRate >= 70 ? 'text-amber-600' : 'text-red-600'
          )}>
            {completionRate}%
          </p>
          <p className="text-xs text-muted-foreground">{doneCount}/{allTodos.length} done</p>
        </div>
      </div>

      {allTodos.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No to-dos to review.</p>
      ) : (
        <div className="space-y-1">
          {allTodos.map((todo) => (
            <div key={todo.id} className="flex items-center gap-3 rounded-md border p-3">
              <Checkbox checked={todo.is_done} onCheckedChange={() => handleToggle(todo.id)} />
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm', todo.is_done && 'line-through text-muted-foreground')}>
                  {todo.title}
                </p>
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
                <span className="text-xs text-muted-foreground">
                  {new Date(todo.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
