'use client';

import { cn } from '@/lib/utils';
import { BookingStatusDot } from './booking-status-badge';
import { BOOKING_STATUS_CONFIG } from '@/lib/calendar/constants';
import { getUserInitials } from '@/lib/calendar/utils';
import { Pencil, Loader2, MoreVertical, Mail } from 'lucide-react';
import type { CalendarEvent } from '@/types/calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AssignmentCardProps {
  event: CalendarEvent;
  compact?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onStatusClick?: (assignmentId: string) => void;
  onEditClick?: (event: CalendarEvent) => void;
  onSendConfirmation?: (event: CalendarEvent) => void;
  isUpdating?: boolean;
  showEditButton?: boolean;
  showMenu?: boolean;
  className?: string;
}

export function AssignmentCard({
  event,
  compact = false,
  onClick,
  onStatusClick,
  onEditClick,
  onSendConfirmation,
  isUpdating = false,
  showEditButton = true,
  showMenu = false,
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

  // Left border color based on status
  const borderLeftColor = {
    draft: 'border-l-blue-500',
    tentative: 'border-l-amber-500',
    pending_confirm: 'border-l-purple-500',
    confirmed: 'border-l-green-500',
  }[event.bookingStatus];

  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => e.key === 'Enter' && onClick?.(e as unknown as React.MouseEvent)}
        className={cn(
          'group flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium truncate w-full text-left cursor-pointer',
          'border-l-2 transition-all duration-150',
          config.bgColor,
          config.textColor,
          borderLeftColor,
          // Enhanced hover state
          'hover:shadow-sm hover:-translate-y-px',
          isUpdating && 'opacity-50 pointer-events-none',
          className
        )}
        title={`${event.projectName} - ${event.userName}${onStatusClick ? ' • Click dot to change status' : ''}`}
      >
        {isUpdating ? (
          <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
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
              'hover:bg-black/10 transition-all',
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
        'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg border w-full text-left cursor-pointer',
        'shadow-sm transition-all duration-200',
        config.bgColor,
        config.textColor,
        config.borderColor,
        // Enhanced hover with lift effect
        'hover:shadow-md hover:-translate-y-0.5',
        // Shine effect overlay
        'before:absolute before:inset-0 before:rounded-lg',
        'before:bg-gradient-to-r before:from-white/0 before:via-white/10 before:to-white/0',
        'before:opacity-0 hover:before:opacity-100 before:transition-opacity',
        'before:pointer-events-none',
        isUpdating && 'opacity-50',
        className
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'relative z-10 flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold',
          config.dotColor,
          'text-white shadow-sm'
        )}
      >
        {getUserInitials(event.userName)}
      </div>
      {/* Content */}
      <div className="relative z-10 flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{event.projectName}</p>
        <p className="text-xs opacity-75 truncate">{event.userName}</p>
      </div>
      {/* Status dot */}
      {isUpdating ? (
        <Loader2 className="relative z-10 h-4 w-4 animate-spin flex-shrink-0" />
      ) : (
        <button
          onClick={onStatusClick ? handleStatusClick : undefined}
          className={cn(
            'relative z-10 flex-shrink-0',
            onStatusClick && 'hover:scale-110 transition-transform cursor-pointer'
          )}
          title={onStatusClick ? 'Click to change status' : undefined}
        >
          <BookingStatusDot status={event.bookingStatus} size="md" />
        </button>
      )}
      {/* Edit button */}
      {showEditButton && onEditClick && (
        <button
          onClick={handleEditClick}
          className={cn(
            'relative z-10 flex-shrink-0 p-1 rounded',
            'opacity-0 group-hover:opacity-100',
            'hover:bg-black/10 transition-all',
            'focus:outline-none focus:opacity-100'
          )}
          title="Edit days & times"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      {/* Menu */}
      {showMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'relative z-10 flex-shrink-0 p-1 rounded',
                'opacity-0 group-hover:opacity-100',
                'hover:bg-black/10 transition-all',
                'focus:outline-none focus:opacity-100'
              )}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {event.bookingStatus === 'tentative' && onSendConfirmation && (
              <DropdownMenuItem onClick={() => onSendConfirmation(event)}>
                <Mail className="mr-2 h-4 w-4" />
                Send to Customer
              </DropdownMenuItem>
            )}
            {onEditClick && (
              <DropdownMenuItem onClick={() => onEditClick(event)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Days & Times
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
