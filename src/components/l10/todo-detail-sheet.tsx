'use client';

import { useState } from 'react';
import { Trash2, ArrowRightLeft, Mountain } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { useUpdateTodo, useDeleteTodo, useConvertTodoToIssue } from '@/hooks/queries/use-l10-todos';
import { useTeam } from '@/hooks/queries/use-l10-teams';
import { toast } from 'sonner';
import type { TodoWithOwner } from '@/types/l10';
import { cn } from '@/lib/utils';
import { L10Comments } from './l10-comments';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

interface TodoDetailSheetProps {
  todo: TodoWithOwner | null;
  onClose: () => void;
  teamId: string;
}

export function TodoDetailSheet({ todo, onClose, teamId }: TodoDetailSheetProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();
  const convertToIssue = useConvertTodoToIssue();
  const { data: team } = useTeam(teamId);

  const members = team?.team_members || [];

  const isOverdue = todo?.due_date && !todo.is_done && new Date(todo.due_date + 'T00:00:00') < new Date();
  const sourceMeta = todo?.source_issue?.source_meta as Record<string, string> | null;

  const handleTitleSave = async () => {
    if (!todo || !titleValue.trim()) return;
    setEditingTitle(false);
    if (titleValue.trim() !== todo.title) {
      try {
        await updateTodo.mutateAsync({ id: todo.id, title: titleValue.trim() });
      } catch (error) {
        toast.error((error as Error).message);
      }
    }
  };

  const handleDescSave = async () => {
    if (!todo) return;
    setEditingDesc(false);
    const newDesc = descValue.trim() || null;
    if (newDesc !== (todo.description || null)) {
      try {
        await updateTodo.mutateAsync({ id: todo.id, description: newDesc });
      } catch (error) {
        toast.error((error as Error).message);
      }
    }
  };

  const handleDelete = async () => {
    if (!todo) return;
    setDeleteConfirmOpen(false);
    onClose();
    try {
      await deleteTodo.mutateAsync(todo.id);
      toast.success('To-do deleted');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleOwnerChange = async (ownerId: string) => {
    if (!todo) return;
    try {
      await updateTodo.mutateAsync({ id: todo.id, ownerId: ownerId || null });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDueDateChange = async (dueDate: string) => {
    if (!todo) return;
    try {
      await updateTodo.mutateAsync({ id: todo.id, dueDate: dueDate || null });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleToggleDone = async () => {
    if (!todo) return;
    try {
      await updateTodo.mutateAsync({ id: todo.id, isDone: !todo.is_done });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleConvertToIssue = async () => {
    if (!todo) return;
    try {
      await convertToIssue.mutateAsync(todo.id);
      toast.success('Converted to issue');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <>
      <Sheet open={!!todo} onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {todo && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2 pr-8">
                  <Badge
                    variant={todo.is_done ? 'secondary' : 'default'}
                    className={cn('cursor-pointer', !todo.is_done && 'bg-blue-600 hover:bg-blue-700')}
                    onClick={handleToggleDone}
                  >
                    {todo.is_done ? 'Done' : 'Active'}
                  </Badge>
                  {isOverdue && (
                    <Badge variant="destructive" className="text-xs">Overdue</Badge>
                  )}
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
                      setTitleValue(todo.title);
                      setEditingTitle(true);
                    }}
                  >
                    {todo.title}
                  </SheetTitle>
                )}
                <SheetDescription className="sr-only">To-do details</SheetDescription>
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
                        setDescValue(todo.description || '');
                        setEditingDesc(true);
                      }}
                    >
                      {todo.description ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{todo.description}</ReactMarkdown>
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
                    <Select value={todo.owner_id || ''} onValueChange={handleOwnerChange}>
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
                      value={todo.due_date || ''}
                      onChange={(e) => handleDueDateChange(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>

                {/* Source Info */}
                {(todo.source_issue || todo.source_milestone) && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Source</Label>
                    <div className="rounded-md border p-3 space-y-1">
                      {todo.source_issue && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">Issue</Badge>
                          <span className="text-sm">{todo.source_issue.title}</span>
                          {sourceMeta?.clientName && sourceMeta?.salesOrder && (
                            <Link
                              href={`/projects/${sourceMeta.salesOrder}`}
                              className="text-xs text-primary hover:underline"
                            >
                              {sourceMeta.clientName}
                            </Link>
                          )}
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
                        </div>
                      )}
                      {todo.source_milestone && (
                        <div className="flex items-center gap-1">
                          <Mountain className="h-3.5 w-3.5 text-amber-600" />
                          <Badge variant="outline" className="text-xs">Milestone</Badge>
                          <span className="text-sm">{todo.source_milestone.title}</span>
                          {todo.source_milestone.rock && (
                            <span className="text-xs text-muted-foreground">
                              from {todo.source_milestone.rock.title}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Comments */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Comments</Label>
                  <L10Comments entityType="todo" entityId={todo.id} />
                </div>
              </div>

              <SheetFooter className="border-t gap-2">
                <Button variant="outline" onClick={handleConvertToIssue} disabled={convertToIssue.isPending}>
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  {convertToIssue.isPending ? 'Converting...' : 'Convert to Issue'}
                </Button>
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
            <AlertDialogTitle>Delete To-Do</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{todo?.title}&quot;. This action cannot be undone.
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
