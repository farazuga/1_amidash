'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookingStatusBadge } from './booking-status-badge';
import { useUserSchedule } from '@/hooks/queries/use-assignments';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { Loader2, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserScheduleResult, BookingStatus } from '@/types/calendar';
import Link from 'next/link';

interface UserScheduleViewProps {
  userId: string;
  userName?: string;
  currentDate: Date;
}

export function UserScheduleView({ userId, userName, currentDate }: UserScheduleViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const { data: schedule, isLoading } = useUserSchedule(userId, monthStart, monthEnd);

  // Group schedule by date
  const scheduleByDate = useMemo(() => {
    if (!schedule) return new Map<string, UserScheduleResult[]>();

    const grouped = new Map<string, UserScheduleResult[]>();
    schedule.forEach((item) => {
      const dateKey = item.schedule_date;
      const existing = grouped.get(dateKey) || [];
      grouped.set(dateKey, [...existing, item]);
    });

    return grouped;
  }, [schedule]);

  // Get days with assignments in the current month
  const daysWithAssignments = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    return days.filter((day) => {
      const dateKey = format(day, 'yyyy-MM-dd');
      return scheduleByDate.has(dateKey);
    });
  }, [scheduleByDate, monthStart, monthEnd]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (daysWithAssignments.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-medium">No assignments this month</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {userName || 'You'} {userName ? 'has' : 'have'} no scheduled projects for{' '}
            {format(currentDate, 'MMMM yyyy')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {userName ? `${userName}'s Schedule` : 'My Schedule'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {daysWithAssignments.length} day(s) scheduled
        </p>
      </div>

      <div className="space-y-3">
        {daysWithAssignments.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const daySchedule = scheduleByDate.get(dateKey) || [];
          const isToday = isSameDay(day, new Date());

          return (
            <Card
              key={dateKey}
              className={cn(isToday && 'border-primary ring-1 ring-primary')}
            >
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {isToday && (
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  )}
                  {format(day, 'EEEE, MMMM d, yyyy')}
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 px-4">
                <div className="space-y-2">
                  {daySchedule.map((item, index) => (
                    <Link
                      key={`${item.assignment_id}-${index}`}
                      href={`/projects/${item.project_id}`}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors"
                    >
                      <span className="font-medium">{item.project_name}</span>
                      <BookingStatusBadge
                        status={item.booking_status as BookingStatus}
                        size="sm"
                      />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
