'use client';

import { cn } from '@/lib/utils';
import { BookingStatusDot } from './booking-status-badge';
import { BOOKING_STATUS_CONFIG } from '@/lib/calendar/constants';
import { getUserInitials } from '@/lib/calendar/utils';
import type { CalendarEvent } from '@/types/calendar';

interface AssignmentCardProps {
  event: CalendarEvent;
  compact?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

export function AssignmentCard({
  event,
  compact = false,
  onClick,
  className,
}: AssignmentCardProps) {
  const config = BOOKING_STATUS_CONFIG[event.bookingStatus];

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={cn(
          'flex items-center gap-1 px-1.5 py-0.5 rounded text-xs truncate w-full text-left',
          config.bgColor,
          config.textColor,
          'hover:opacity-80 transition-opacity',
          className
        )}
        title={`${event.projectName} - ${event.userName}`}
      >
        <BookingStatusDot status={event.bookingStatus} size="sm" />
        <span className="truncate">{event.userName}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded-md border w-full text-left',
        config.bgColor,
        config.textColor,
        config.borderColor,
        'hover:opacity-90 transition-opacity',
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
      <BookingStatusDot status={event.bookingStatus} size="md" />
    </button>
  );
}
