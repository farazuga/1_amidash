'use client';

import { format } from 'date-fns';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { AssignmentCard } from './assignment-card';
import type { CalendarEvent } from '@/types/calendar';

interface DayEventsPopoverProps {
  date: Date;
  events: CalendarEvent[];
  hiddenCount: number;
  onEventClick?: (event: CalendarEvent) => void;
  onStatusClick?: (assignmentId: string) => void;
  onEditClick?: (event: CalendarEvent) => void;
  isUpdatingAssignment?: string | null;
  showEditButton?: boolean;
}

export function DayEventsPopover({
  date,
  events,
  hiddenCount,
  onEventClick,
  onStatusClick,
  onEditClick,
  isUpdatingAssignment,
  showEditButton = true,
}: DayEventsPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="text-xs text-muted-foreground hover:text-foreground hover:underline px-1"
          onClick={(e) => e.stopPropagation()}
        >
          +{hiddenCount} more
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-2"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-medium text-sm mb-2">
          {format(date, 'EEEE, MMMM d')}
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {events.map((event) => (
            <AssignmentCard
              key={event.id}
              event={event}
              compact
              onClick={(e) => {
                e?.stopPropagation?.();
                onEventClick?.(event);
              }}
              onStatusClick={onStatusClick}
              onEditClick={onEditClick}
              isUpdating={isUpdatingAssignment === event.assignmentId}
              showEditButton={showEditButton}
            />
          ))}
        </div>
        <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
          {events.length} assignment{events.length !== 1 ? 's' : ''} total
        </div>
      </PopoverContent>
    </Popover>
  );
}
