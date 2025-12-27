'use client';

import { cn } from '@/lib/utils';
import { BookingStatusDot } from './booking-status-badge';
import { BOOKING_STATUS_CONFIG } from '@/lib/calendar/constants';
import { getUserInitials } from '@/lib/calendar/utils';
import { Pencil, Loader2 } from 'lucide-react';
import type { CalendarEvent } from '@/types/calendar';

interface AssignmentCardProps {
  event: CalendarEvent;
  compact?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onStatusClick?: (assignmentId: string) => void;
  onEditClick?: (event: CalendarEvent) => void;
  isUpdating?: boolean;
  showEditButton?: boolean;
  className?: string;
}

export function AssignmentCard({
  event,
  compact = false,
  onClick,
  onStatusClick,
  onEditClick,
  isUpdating = false,
  showEditButton = true,
  className,
}: AssignmentCardProps) {
  const config = BOOKING_STATUS_CONFIG[event.bookingStatus];

  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isUpdating && onStatusClick) {
      onStatusClick(event.assignmentId);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEditClick?.(event);
  };

  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => e.key === 'Enter' && onClick?.(e as unknown as React.MouseEvent)}
        className={cn(
          'flex items-center gap-1 px-1.5 py-0.5 rounded text-xs truncate w-full text-left group cursor-pointer',
          config.bgColor,
          config.textColor,
          'hover:opacity-80 transition-opacity',
          isUpdating && 'opacity-50',
          className
        )}
        title={`${event.projectName} - ${event.userName}${onStatusClick ? ' • Click dot to change status' : ''}`}
      >
        {isUpdating ? (
          <Loader2 className="h-2 w-2 animate-spin flex-shrink-0" />
        ) : (
          <button
            onClick={onStatusClick ? handleStatusClick : undefined}
            className={cn(
              'flex-shrink-0',
              onStatusClick && 'hover:scale-125 transition-transform cursor-pointer'
            )}
            title={onStatusClick ? 'Click to change status' : undefined}
          >
            <BookingStatusDot status={event.bookingStatus} size="sm" />
          </button>
        )}
        <span className="truncate flex-1">{event.userName}</span>
        {showEditButton && onEditClick && (
          <button
            onClick={handleEditClick}
            className={cn(
              'flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100',
              'hover:bg-black/10 transition-opacity',
              'focus:outline-none focus:opacity-100'
            )}
            title="Edit days & times"
          >
            <Pencil className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.(e as unknown as React.MouseEvent)}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded-md border w-full text-left group cursor-pointer',
        config.bgColor,
        config.textColor,
        config.borderColor,
        'hover:opacity-90 transition-opacity',
        isUpdating && 'opacity-50',
        className
      )}
    >
      <div
        className={cn(
          'flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium',
          config.dotColor,
          'text-white'
        )}
      >
        {getUserInitials(event.userName)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{event.projectName}</p>
        <p className="text-xs opacity-75 truncate">{event.userName}</p>
      </div>
      {isUpdating ? (
        <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
      ) : (
        <button
          onClick={onStatusClick ? handleStatusClick : undefined}
          className={cn(
            'flex-shrink-0',
            onStatusClick && 'hover:scale-110 transition-transform cursor-pointer'
          )}
          title={onStatusClick ? 'Click to change status' : undefined}
        >
          <BookingStatusDot status={event.bookingStatus} size="md" />
        </button>
      )}
      {showEditButton && onEditClick && (
        <button
          onClick={handleEditClick}
          className={cn(
            'flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100',
            'hover:bg-black/10 transition-opacity',
            'focus:outline-none focus:opacity-100'
          )}
          title="Edit days & times"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
