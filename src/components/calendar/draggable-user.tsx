'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { getUserInitials } from '@/lib/calendar/utils';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';

interface DraggableUserProps {
  user: {
    id: string;
    email: string;
    full_name: string | null;
  };
  isAssigned?: boolean;
}

export function DraggableUser({ user, isAssigned = false }: DraggableUserProps) {
  const draggableId = `user-${user.id}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    data: {
      type: 'user',
      userId: user.id,
      userName: user.full_name,
    },
  });

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
        isDragging && 'opacity-50 ring-2 ring-primary',
        isAssigned && 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900'
      )}
    >
      <div className={cn(
        'h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium relative',
        isAssigned ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-primary/10 text-primary'
      )}>
        {getUserInitials(user.full_name)}
        {isAssigned && (
          <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
            <Check className="h-2.5 w-2.5 text-white" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{user.full_name || 'Unknown'}</p>
          {isAssigned && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 bg-green-100 text-green-700 border-green-300 dark:bg-green-900 dark:text-green-300 dark:border-green-700">
              Assigned
            </Badge>
          )}
        </div>
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
