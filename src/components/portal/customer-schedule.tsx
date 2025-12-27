'use client';

import { format, differenceInDays, isAfter, isBefore, isToday } from 'date-fns';
import { Calendar, Clock, CheckCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomerScheduleProps {
  startDate: string | null;
  endDate: string | null;
  projectName: string;
}

export function CustomerSchedule({ startDate, endDate, projectName }: CustomerScheduleProps) {
  if (!startDate || !endDate) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Schedule dates coming soon</p>
      </div>
    );
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();

  const totalDays = differenceInDays(end, start) + 1;
  const hasStarted = isAfter(today, start) || isToday(start);
  const hasEnded = isAfter(today, end);
  const daysRemaining = hasEnded ? 0 : differenceInDays(end, today) + 1;
  const daysElapsed = hasStarted ? Math.min(differenceInDays(today, start) + 1, totalDays) : 0;
  const progressPercent = hasEnded ? 100 : hasStarted ? Math.round((daysElapsed / totalDays) * 100) : 0;

  // Determine status
  const getStatus = () => {
    if (hasEnded) return { label: 'Completed', color: 'text-green-600', bg: 'bg-green-100' };
    if (hasStarted) return { label: 'In Progress', color: 'text-blue-600', bg: 'bg-blue-100' };
    return { label: 'Scheduled', color: 'text-amber-600', bg: 'bg-amber-100' };
  };

  const status = getStatus();

  return (
    <div className="space-y-4">
      {/* Status Badge */}
      <div className="flex items-center justify-between">
        <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', status.bg, status.color)}>
          {status.label}
        </span>
        <span className="text-sm text-muted-foreground">
          {totalDays} day{totalDays !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Date Range */}
      <div className="flex items-center justify-between gap-4">
        <div className="text-center flex-1">
          <p className="text-xs text-muted-foreground mb-1">Start</p>
          <p className="font-semibold text-[#023A2D]">{format(start, 'MMM d')}</p>
          <p className="text-xs text-muted-foreground">{format(start, 'yyyy')}</p>
        </div>

        <div className="flex-shrink-0 flex items-center">
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="text-center flex-1">
          <p className="text-xs text-muted-foreground mb-1">End</p>
          <p className="font-semibold text-[#023A2D]">{format(end, 'MMM d')}</p>
          <p className="text-xs text-muted-foreground">{format(end, 'yyyy')}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>{progressPercent}% complete</span>
          {!hasEnded && hasStarted && (
            <span>{daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left</span>
          )}
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              hasEnded ? 'bg-green-500' : 'bg-[#023A2D]'
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Additional Info */}
      {!hasStarted && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
          <Clock className="h-4 w-4" />
          <span>
            Starts in {differenceInDays(start, today)} day{differenceInDays(start, today) !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {hasEnded && (
        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-lg p-3">
          <CheckCircle className="h-4 w-4" />
          <span>Project schedule completed</span>
        </div>
      )}
    </div>
  );
}
