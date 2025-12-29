'use client';

import { useState } from 'react';
import { UserScheduleView, CalendarHeader, MyScheduleCalendarView } from '@/components/calendar';
import { Button } from '@/components/ui/button';
import { Link2, ExternalLink, LayoutGrid, List } from 'lucide-react';
import { useCalendarSubscriptions, useCreateCalendarSubscription } from '@/hooks/queries/use-assignments';
import { toast } from 'sonner';
import { getNextMonth, getPreviousMonth } from '@/lib/calendar/utils';

interface MyScheduleContentProps {
  userId: string;
  userName?: string;
}

export function MyScheduleContent({ userId, userName }: MyScheduleContentProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  const { data: subscriptions } = useCalendarSubscriptions();
  const createSubscription = useCreateCalendarSubscription();

  const handlePreviousMonth = () => {
    setCurrentDate(getPreviousMonth(currentDate));
  };

  const handleNextMonth = () => {
    setCurrentDate(getNextMonth(currentDate));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleGetICalLink = async () => {
    try {
      const result = await createSubscription.mutateAsync({
        feedType: 'personal',
      });

      await navigator.clipboard.writeText(result.url);
      toast.success('Personal calendar link copied!', {
        description: 'Paste this URL in your calendar app to subscribe',
      });
    } catch (error) {
      toast.error('Failed to generate calendar link');
    }
  };

  const existingPersonalSub = subscriptions?.find(s => s.feed_type === 'personal');

  return (
    <div className="space-y-6">
      {/* Header with navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <CalendarHeader
            currentDate={currentDate}
            onPreviousMonth={handlePreviousMonth}
            onNextMonth={handleNextMonth}
            onToday={handleToday}
          />

          {/* View toggle */}
          <div className="flex items-center gap-1 border rounded-lg p-1">
            <Button
              variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 gap-1"
              onClick={() => setViewMode('calendar')}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Calendar
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 gap-1"
              onClick={() => setViewMode('list')}
            >
              <List className="h-3.5 w-3.5" />
              List
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {existingPersonalSub ? (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
                const url = `${baseUrl}/api/calendar/ical/${existingPersonalSub.token}`;
                await navigator.clipboard.writeText(url);
                toast.success('Personal calendar link copied!');
              }}
            >
              <Link2 className="mr-2 h-4 w-4" />
              Copy iCal Link
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGetICalLink}
              disabled={createSubscription.isPending}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Get Calendar Link
            </Button>
          )}
        </div>
      </div>

      {/* Schedule view */}
      {viewMode === 'calendar' ? (
        <MyScheduleCalendarView
          userId={userId}
          userName={userName}
          currentDate={currentDate}
        />
      ) : (
        <UserScheduleView
          userId={userId}
          userName={userName}
          currentDate={currentDate}
        />
      )}
    </div>
  );
}
