'use client';

import { cn } from '@/lib/utils';
import { BookingStatusDot } from './booking-status-badge';
import { BOOKING_STATUS_CONFIG } from '@/lib/calendar/constants';
import { getUserInitials } from '@/lib/calendar/utils';
import { Pencil, Loader2, MoreVertical, Mail, Calendar, Users, Target } from 'lucide-react';
import type { CalendarEvent, BookingStatus } from '@/types/calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';

// Extended project info for hover display
export interface ProjectHoverInfo {
  goalCompletionDate?: string | null;
  currentStatus?: string | null;
  otherEngineers?: string[];
  salesOrderNumber?: string | null;
}

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
  showHoverInfo?: boolean;
  projectInfo?: ProjectHoverInfo;
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
  showHoverInfo = false,
  projectInfo,
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

  // Render hover content for project summary
  const renderHoverContent = () => {
    if (!showHoverInfo) return null;

    const statusConfig = BOOKING_STATUS_CONFIG[event.bookingStatus];
    const completionDate = projectInfo?.goalCompletionDate
      ? new Date(projectInfo.goalCompletionDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null;

    return (
      <HoverCardContent className="w-72" side="top" align="start">
        <div className="space-y-2">
          {/* Project name and status */}
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-sm">{event.projectName}</p>
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap',
              statusConfig.bgColor,
              statusConfig.textColor
            )}>
              {statusConfig.label}
            </span>
          </div>

          {/* Engineer name */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{event.userName}</span>
          </div>

          {/* Completion date */}
          {completionDate && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Target className="h-3.5 w-3.5" />
              <span>Completion: {completionDate}</span>
            </div>
          )}

          {/* Current status */}
          {projectInfo?.currentStatus && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>Project Status: {projectInfo.currentStatus}</span>
            </div>
          )}

          {/* Other engineers */}
          {projectInfo?.otherEngineers && projectInfo.otherEngineers.length > 0 && (
            <div className="pt-1 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Other Engineers:
              </p>
              <div className="flex flex-wrap gap-1">
                {projectInfo.otherEngineers.map((engineer, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-muted px-1.5 py-0.5 rounded"
                  >
                    {engineer}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </HoverCardContent>
    );
  };

  // Card content for compact view
  const compactCardContent = (
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
      title={showHoverInfo ? undefined : `${event.projectName} - ${event.userName}${onStatusClick ? ' • Click dot to change status' : ''}`}
    >
      {isUpdating ? (
        <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
      ) : (
        <button
          onClick={onStatusClick ? handleStatusClick : undefined}
          onPointerDown={(e) => {
            // Stop pointer down from reaching drag listeners so clicks work
            if (onStatusClick) {
              e.stopPropagation();
            }
          }}
          className={cn(
            'flex-shrink-0 -m-1 p-1 rounded-full relative z-10',
            onStatusClick && 'hover:scale-110 hover:bg-black/10 transition-all cursor-pointer'
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
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            'flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 relative z-10',
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

  if (compact) {
    // Wrap in HoverCard if showHoverInfo is enabled
    if (showHoverInfo) {
      return (
        <HoverCard openDelay={300} closeDelay={100}>
          <HoverCardTrigger asChild>
            {compactCardContent}
          </HoverCardTrigger>
          {renderHoverContent()}
        </HoverCard>
      );
    }
    return compactCardContent;
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
          onPointerDown={(e) => {
            if (onStatusClick) {
              e.stopPropagation();
            }
          }}
          className={cn(
            'relative z-10 flex-shrink-0 -m-1 p-1 rounded-full',
            onStatusClick && 'hover:scale-110 hover:bg-black/10 transition-all cursor-pointer'
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
          onPointerDown={(e) => e.stopPropagation()}
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
              onPointerDown={(e) => e.stopPropagation()}
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
