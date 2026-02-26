'use client';

import { useState, useCallback } from 'react';
import { Plus, GripVertical, Trash2, CheckCircle, ExternalLink, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
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
  useUpdateIssue,
  useDeleteIssue,
  useReorderIssues,
  useSolveIssue,
  useIssueTodos,
} from '@/hooks/queries/use-l10-issues';
import { useCreateTodo, useToggleTodo } from '@/hooks/queries/use-l10-todos';
import { useTeam } from '@/hooks/queries/use-l10-teams';
import { toast } from 'sonner';
import type { IssueWithCreator, TodoWithOwner } from '@/types/l10';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface IssuesTabProps {
  teamId: string;
}

function getAgeLabel(createdAt: string | null): string {
  if (!createdAt) return '';
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now.getTime() - created.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1d';
  if (diffDays < 7) return `${diffDays}d`;
  const weeks = Math.floor(diffDays / 7);
  if (weeks < 4) return `${weeks}w`;
  const months = Math.floor(diffDays / 30);
  return `${months}mo`;
}

function getAgeColor(createdAt: string | null): string {
  if (!createdAt) return 'text-muted-foreground';
  const now = new Date();
  const created = new Date(createdAt);
  const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 14) return 'text-destructive';
  if (diffDays >= 7) return 'text-yellow-600 dark:text-yellow-500';
  return 'text-muted-foreground';
}

export function IssuesTab({ teamId }: IssuesTabProps) {
  const [showArchived, setShowArchived] = useState(false);
  const { data: issues, isLoading } = useIssues(teamId, showArchived ? 'all' : undefined);
  const [addOpen, setAddOpen] = useState(false);
  const [solveOpen, setSolveOpen] = useState(false);
  const [solvingIssue, setSolvingIssue] = useState<IssueWithCreator | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<IssueWithCreator | null>(null);
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

      const activeIssues = issues.filter((i) => i.status !== 'solved');
      const oldIndex = activeIssues.findIndex((i) => i.id === active.id);
      const newIndex = activeIssues.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(activeIssues, oldIndex, newIndex);
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
      if (selectedIssue?.id === id) setSelectedIssue(null);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-md bg-muted" />;
  }

  const activeIssues = issues?.filter((i) => i.status !== 'solved') || [];
  const solvedIssues = issues?.filter((i) => i.status === 'solved') || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Issues (IDS)</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={showArchived} onCheckedChange={setShowArchived} id="show-archived" />
            <Label htmlFor="show-archived" className="text-sm">Show archived</Label>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Issue
          </Button>
        </div>
      </div>

      {activeIssues.length === 0 && (!showArchived || solvedIssues.length === 0) ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
          <p>No open issues. Drag to prioritize during IDS.</p>
        </div>
      ) : (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={activeIssues.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {activeIssues.map((issue, idx) => (
                  <SortableIssueCard
                    key={issue.id}
                    issue={issue}
                    rank={idx + 1}
                    onSolve={() => handleSolve(issue)}
                    onDelete={() => handleDelete(issue.id)}
                    onClick={() => setSelectedIssue(issue)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {showArchived && solvedIssues.length > 0 && (
            <>
              {activeIssues.length > 0 && <div className="border-t my-3" />}
              <div className="space-y-1">
                {solvedIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="flex items-center gap-2 rounded-md border bg-muted/20 p-3 opacity-60 cursor-pointer hover:opacity-80"
                    onClick={() => setSelectedIssue(issue)}
                  >
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-through text-muted-foreground truncate">{issue.title}</p>
                      {issue.resolved_at && (
                        <p className="text-xs text-muted-foreground">
                          Solved {getAgeLabel(issue.resolved_at)} ago
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs">solved</Badge>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
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

      <IssueDetailSheet
        issue={selectedIssue}
        onClose={() => setSelectedIssue(null)}
        teamId={teamId}
        onSolve={handleSolve}
        onDelete={handleDelete}
      />
    </div>
  );
}

// ============================================
// Issue Detail Sheet (Side Panel)
// ============================================

function IssueDetailSheet({
  issue,
  onClose,
  teamId,
  onSolve,
  onDelete,
}: {
  issue: IssueWithCreator | null;
  onClose: () => void;
  teamId: string;
  onSolve: (issue: IssueWithCreator) => void;
  onDelete: (id: string) => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [addTodoOpen, setAddTodoOpen] = useState(false);

  const updateIssue = useUpdateIssue();
  const { data: linkedTodos } = useIssueTodos(issue?.id ?? null);
  const toggleTodo = useToggleTodo();

  const handleTitleSave = async () => {
    if (!issue || !titleValue.trim()) return;
    setEditingTitle(false);
    if (titleValue.trim() !== issue.title) {
      try {
        await updateIssue.mutateAsync({ id: issue.id, title: titleValue.trim() });
      } catch (error) {
        toast.error((error as Error).message);
      }
    }
  };

  const handleDescSave = async () => {
    if (!issue) return;
    setEditingDesc(false);
    const newDesc = descValue.trim() || null;
    if (newDesc !== (issue.description || null)) {
      try {
        await updateIssue.mutateAsync({ id: issue.id, description: newDesc });
      } catch (error) {
        toast.error((error as Error).message);
      }
    }
  };

  const handleSolve = () => {
    if (issue) {
      onClose();
      onSolve(issue);
    }
  };

  const handleDelete = () => {
    if (issue) {
      setDeleteConfirmOpen(false);
      onClose();
      onDelete(issue.id);
    }
  };

  const handleToggleTodo = async (id: string) => {
    try {
      await toggleTodo.mutateAsync(id);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const sourceMeta = issue?.source_meta as Record<string, string> | null;

  return (
    <>
      <Sheet open={!!issue} onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {issue && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2 pr-8">
                  <Badge variant={issue.status === 'solving' ? 'default' : 'secondary'} className="text-xs shrink-0">
                    {issue.status}
                  </Badge>
                  <span className={cn('text-xs flex items-center gap-1', getAgeColor(issue.created_at))}>
                    <Clock className="h-3 w-3" />
                    {getAgeLabel(issue.created_at)}
                  </span>
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
                      setTitleValue(issue.title);
                      setEditingTitle(true);
                    }}
                  >
                    {issue.title}
                  </SheetTitle>
                )}
                <SheetDescription className="sr-only">Issue details</SheetDescription>
              </SheetHeader>

              <div className="px-4 space-y-5">
                {/* Source links */}
                {issue.source_type === 'project' && sourceMeta && (
                  <div className="flex flex-wrap gap-2">
                    {sourceMeta.clientName && sourceMeta.salesOrder && (
                      <Link
                        href={`/projects/${sourceMeta.salesOrder}`}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Project: {sourceMeta.clientName}
                      </Link>
                    )}
                    {sourceMeta.salesOrderUrl && (
                      <a
                        href={sourceMeta.salesOrderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Odoo: {sourceMeta.salesOrder || 'View'}
                      </a>
                    )}
                  </div>
                )}

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
                        setDescValue(issue.description || '');
                        setEditingDesc(true);
                      }}
                    >
                      {issue.description ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{issue.description}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic">Click to add a description...</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Linked To-Dos */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Linked To-Dos</Label>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAddTodoOpen(true)}>
                      <Plus className="mr-1 h-3 w-3" />
                      Create To-Do
                    </Button>
                  </div>
                  {linkedTodos && linkedTodos.length > 0 ? (
                    <div className="space-y-1">
                      {linkedTodos.map((todo: TodoWithOwner) => (
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
                    <p className="text-sm text-muted-foreground">No linked to-dos yet.</p>
                  )}
                </div>

                {/* Created by */}
                {issue.profiles && (
                  <p className="text-xs text-muted-foreground">
                    Created by {issue.profiles.full_name || issue.profiles.email}
                  </p>
                )}
              </div>

              <SheetFooter className="border-t gap-2">
                {issue.status !== 'solved' && (
                  <Button onClick={handleSolve} className="flex-1">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Solve
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

      {/* Quick Add Todo from Panel */}
      {issue && (
        <QuickAddTodoDialog
          open={addTodoOpen}
          onOpenChange={setAddTodoOpen}
          teamId={teamId}
          issueId={issue.id}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Issue</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{issue?.title}&quot;. This action cannot be undone.
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

// Quick Add Todo Dialog (from issue panel)
function QuickAddTodoDialog({
  open,
  onOpenChange,
  teamId,
  issueId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  issueId: string;
}) {
  const [title, setTitle] = useState('');
  const [ownerId, setOwnerId] = useState('');
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
        sourceIssueId: issueId,
      });
      toast.success('To-do created');
      onOpenChange(false);
      setTitle('');
      setOwnerId('');
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
          <DialogTitle>Create To-Do from Issue</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Action item..." autoFocus />
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
              {createTodo.isPending ? 'Creating...' : 'Create To-Do'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Sortable Issue Card
// ============================================

function SortableIssueCard({
  issue,
  rank,
  onSolve,
  onDelete,
  onClick,
}: {
  issue: IssueWithCreator;
  rank: number;
  onSolve: () => void;
  onDelete: () => void;
  onClick: () => void;
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
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
        <p className="text-sm font-medium truncate">{issue.title}</p>
        {issue.description && (
          <p className="text-xs text-muted-foreground truncate">{issue.description}</p>
        )}
      </div>
      <span className={cn('text-xs', getAgeColor(issue.created_at))}>
        {getAgeLabel(issue.created_at)}
      </span>
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

// ============================================
// Add Issue Dialog
// ============================================

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

// ============================================
// Solve Issue Dialog
// ============================================

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
