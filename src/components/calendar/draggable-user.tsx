'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { getUserInitials } from '@/lib/calendar/utils';

interface DraggableUserProps {
  user: {
    id: string;
    email: string;
    full_name: string | null;
  };
}

export function DraggableUser({ user }: DraggableUserProps) {
  const draggableId = `user-${user.id}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    data: {
      type: 'user',
      userId: user.id,
      userName: user.full_name,
    },
  });

  // Log when drag state changes
  if (isDragging) {
    console.log('[DRAGGABLE] Dragging user:', { id: draggableId, userId: user.id, userName: user.full_name });
  }

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border w-full text-left',
        'hover:bg-accent hover:text-accent-foreground transition-colors',
        'cursor-grab active:cursor-grabbing touch-none',
        isDragging && 'opacity-50 ring-2 ring-primary'
      )}
    >
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
        {getUserInitials(user.full_name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{user.full_name || 'Unknown'}</p>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
      </div>
    </div>
  );
}

export function DraggingUserOverlay({
  userName,
}: {
  userName: string | null;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-background shadow-lg">
      <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-sm font-medium text-primary-foreground">
        {getUserInitials(userName)}
      </div>
      <span className="text-sm font-medium">{userName || 'Unknown'}</span>
    </div>
  );
}
