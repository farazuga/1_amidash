'use client';

import { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, isSameDay, isSameMonth } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useUserSchedule } from '@/hooks/queries/use-assignments';
import { getCalendarDays } from '@/lib/calendar/utils';
import { WEEKDAYS, BOOKING_STATUS_CONFIG } from '@/lib/calendar/constants';
import { cn } from '@/lib/utils';
import type { UserScheduleResult, BookingStatus } from '@/types/calendar';
import Link from 'next/link';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MyScheduleCalendarViewProps {
  userId: string;
  userName?: string;
  currentDate: Date;
}

/**
 * Format time string (HH:MM:SS or HH:MM) to short display format (h:mm a)
 */
function formatTime(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'p' : 'a';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;
}

/**
 * Format time range for display
 */
function formatTimeRange(startTime: string, endTime: string): string {
  if (!startTime || !endTime) return '';
  return `${formatTime(startTime)}-${formatTime(endTime)}`;
}

export function MyScheduleCalendarView({ userId, userName, currentDate }: MyScheduleCalendarViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const { data: schedule, isLoading } = useUserSchedule(userId, monthStart, monthEnd);

  const days = useMemo(() => getCalendarDays(currentDate), [currentDate]);

  // Group schedule by date
  const scheduleByDate = useMemo(() => {
    const grouped = new Map<string, UserScheduleResult[]>();
    if (!schedule) return grouped;

    schedule.forEach((item) => {
      const dateKey = item.schedule_date;
      const existing = grouped.get(dateKey) || [];
      grouped.set(dateKey, [...existing, item]);
    });

    return grouped;
  }, [schedule]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="border rounded-lg overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 bg-muted">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="p-2 text-center text-sm font-medium border-r last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {days.map((date, index) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const daySchedule = scheduleByDate.get(dateStr) || [];
            const isToday = isSameDay(date, new Date());
            const isCurrentMonth = isSameMonth(date, currentDate);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;

            return (
              <div
                key={index}
                className={cn(
                  'min-h-[100px] p-1 border-b border-r last:border-r-0',
                  !isCurrentMonth && 'bg-muted/30 text-muted-foreground',
                  isWeekend && isCurrentMonth && 'bg-muted/20',
                  isToday && 'ring-2 ring-primary ring-inset'
                )}
              >
                {/* Date number */}
                <div className={cn(
                  'text-sm font-medium mb-1 px-1',
                  isToday && 'text-primary'
                )}>
                  {format(date, 'd')}
                </div>

                {/* Assignments for this day - sorted by start time */}
                <div className="space-y-0.5">
                  {daySchedule
                    .slice()
                    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
                    .slice(0, 3)
                    .map((item, i) => {
                    const statusConfig = BOOKING_STATUS_CONFIG[item.booking_status as BookingStatus];
                    const timeRange = formatTimeRange(item.start_time, item.end_time);
                    return (
                      <Tooltip key={`${item.day_id || item.assignment_id}-${i}`}>
                        <TooltipTrigger asChild>
                          <Link
                            href={`/projects/${item.sales_order_number || item.project_id}`}
                            className={cn(
                              'block text-xs px-1.5 py-0.5 rounded truncate transition-opacity hover:opacity-80',
                              statusConfig?.bgColor || 'bg-gray-100',
                              statusConfig?.textColor || 'text-gray-800'
                            )}
                          >
                            {timeRange && <span className="font-medium">{formatTime(item.start_time)} </span>}
                            {item.project_name}
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[220px]">
                          <p className="font-medium">{item.project_name}</p>
                          {timeRange && (
                            <p className="text-xs text-muted-foreground">{timeRange}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {statusConfig?.label || item.booking_status}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                  {daySchedule.length > 3 && (
                    <div className="text-xs text-muted-foreground px-1">
                      +{daySchedule.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
