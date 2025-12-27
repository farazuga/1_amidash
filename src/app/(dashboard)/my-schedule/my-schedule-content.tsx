'use client';

import { useState } from 'react';
import { UserScheduleView, CalendarHeader } from '@/components/calendar';
import { Button } from '@/components/ui/button';
import { Link2, ExternalLink } from 'lucide-react';
import { useCalendarSubscriptions, useCreateCalendarSubscription } from '@/hooks/queries/use-assignments';
import { toast } from 'sonner';
import { getNextMonth, getPreviousMonth } from '@/lib/calendar/utils';

interface MyScheduleContentProps {
  userId: string;
  userName?: string;
}

export function MyScheduleContent({ userId, userName }: MyScheduleContentProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

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
      <div className="flex items-center justify-between">
        <CalendarHeader
          currentDate={currentDate}
          onPreviousMonth={handlePreviousMonth}
          onNextMonth={handleNextMonth}
          onToday={handleToday}
        />

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
      <UserScheduleView
        userId={userId}
        userName={userName}
        currentDate={currentDate}
      />
    </div>
  );
}
