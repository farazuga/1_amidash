'use client';

import { useState } from 'react';
import { Pencil, Trash2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  useComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
} from '@/hooks/queries/use-l10-comments';
import { useUser } from '@/contexts/user-context';
import { toast } from 'sonner';
import type { CommentEntityType, CommentWithUser } from '@/types/l10';
import { cn } from '@/lib/utils';

interface L10CommentsProps {
  entityType: CommentEntityType;
  entityId: string;
}

function getRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function L10Comments({ entityType, entityId }: L10CommentsProps) {
  const { user } = useUser();
  const { data: comments, isLoading } = useComments(entityType, entityId);
  const createComment = useCreateComment();
  const [newComment, setNewComment] = useState('');

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    try {
      await createComment.mutateAsync({
        entityType,
        entityId,
        content: newComment.trim(),
      });
      setNewComment('');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="h-12 animate-pulse rounded-md bg-muted" />
      ) : comments && comments.length > 0 ? (
        <div className="space-y-2">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} isOwn={comment.user_id === user?.id} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No comments yet.</p>
      )}

      <div className="flex gap-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          rows={2}
          className="text-sm resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <Button
          size="icon"
          className="shrink-0 h-9 w-9"
          onClick={handleSubmit}
          disabled={!newComment.trim() || createComment.isPending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function CommentItem({ comment, isOwn }: { comment: CommentWithUser; isOwn: boolean }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();

  const handleSave = async () => {
    if (!editValue.trim()) return;
    setEditing(false);
    try {
      await updateComment.mutateAsync({ id: comment.id, content: editValue.trim() });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteComment.mutateAsync(comment.id);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className={cn('group rounded-md border p-2.5 text-sm', isOwn && 'bg-muted/30')}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-xs">
            {comment.profiles?.full_name || comment.profiles?.email || 'Unknown'}
          </span>
          <span className="text-xs text-muted-foreground">
            {getRelativeTime(comment.created_at)}
          </span>
        </div>
        {isOwn && !editing && (
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                setEditValue(comment.content);
                setEditing(true);
              }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={2}
            className="text-sm resize-none"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={!editValue.trim()}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm">{comment.content}</p>
      )}
    </div>
  );
}
