'use client';

import { cn } from '@/lib/utils';
import {
  BOOKING_STATUS_COLORS,
  BOOKING_STATUS_LABELS,
  type BookingStatus,
  type AssignmentBlock,
} from '@/types/calendar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface GanttBarProps {
  assignmentId: string;
  userName: string;
  bookingStatus: BookingStatus;
  block: AssignmentBlock;
  startColumn: number;
  endColumn: number;
  onClick?: () => void;
  isLoading?: boolean;
}

export function GanttBar({
  assignmentId,
  userName,
  bookingStatus,
  block,
  startColumn,
  endColumn,
  onClick,
  isLoading,
}: GanttBarProps) {
  const colors = BOOKING_STATUS_COLORS[bookingStatus];
  const statusLabel = BOOKING_STATUS_LABELS[bookingStatus];
  const spanDays = endColumn - startColumn + 1;

  // Format time for display
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            disabled={isLoading}
            className={cn(
              'absolute top-1 bottom-1 rounded-md border-2 px-2 py-0.5',
              'flex items-center justify-start overflow-hidden',
              'cursor-pointer transition-all duration-150',
              'hover:brightness-95 hover:shadow-sm',
              'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-ring',
              'disabled:cursor-not-allowed disabled:opacity-50',
              colors.bg,
              colors.text,
              colors.border
            )}
            style={{
              gridColumnStart: startColumn,
              gridColumnEnd: endColumn + 1,
              left: '4px',
              right: '4px',
            }}
            title={`${userName} - ${statusLabel} (click to change status)`}
          >
            <span className="truncate text-xs font-medium">
              {userName}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <div className="font-semibold">{userName}</div>
            <div className="text-xs text-muted-foreground">
              Status: <span className={colors.text}>{statusLabel}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {spanDays} day{spanDays !== 1 ? 's' : ''}: {block.startDate} to {block.endDate}
            </div>
            {block.days.length > 0 && (
              <div className="text-xs border-t pt-1 mt-1">
                <div className="font-medium mb-1">Times:</div>
                {block.days.slice(0, 3).map((day) => (
                  <div key={day.id} className="flex justify-between gap-2">
                    <span>{new Date(day.work_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    <span>{formatTime(day.start_time)} - {formatTime(day.end_time)}</span>
                  </div>
                ))}
                {block.days.length > 3 && (
                  <div className="text-muted-foreground mt-1">
                    +{block.days.length - 3} more day{block.days.length - 3 !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )}
            <div className="text-xs text-muted-foreground pt-1 border-t mt-1">
              Click to cycle status
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
