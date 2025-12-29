'use client';

import { useDraggable } from '@dnd-kit/core';
import { AssignmentCard } from './assignment-card';
import type { CalendarEvent } from '@/types/calendar';
import { cn } from '@/lib/utils';

interface DraggableAssignmentCardProps {
  event: CalendarEvent;
  dayId: string;
  currentDate: string; // YYYY-MM-DD format
  compact?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onStatusClick?: (assignmentId: string) => void;
  onEditClick?: (event: CalendarEvent) => void;
  onSendConfirmation?: (event: CalendarEvent) => void;
  onOptionClickDelete?: (dayId: string, event: CalendarEvent, date: string) => void;
  isUpdating?: boolean;
  showEditButton?: boolean;
  showMenu?: boolean;
  className?: string;
  enableDrag?: boolean;
}

export function DraggableAssignmentCard({
  event,
  dayId,
  currentDate,
  enableDrag = true,
  onClick,
  onOptionClickDelete,
  ...cardProps
}: DraggableAssignmentCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `move-${event.assignmentId}-${currentDate}`,
    data: {
      type: 'move-assignment',
      assignmentId: event.assignmentId,
      dayId,
      originalDate: currentDate,
      userId: event.userId,
      userName: event.userName,
      event,
    },
    disabled: !enableDrag,
  });

  const handleClick = (e: React.MouseEvent) => {
    // Option+click (Mac) or Alt+click (Windows) to delete this day
    if (e.altKey && onOptionClickDelete) {
      e.stopPropagation();
      e.preventDefault();
      onOptionClickDelete(dayId, event, currentDate);
      return;
    }
    onClick?.(e);
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'touch-none',
        isDragging && 'opacity-50 cursor-grabbing',
        enableDrag && !isDragging && 'cursor-grab'
      )}
    >
      <AssignmentCard event={event} onClick={handleClick} {...cardProps} />
    </div>
  );
}
