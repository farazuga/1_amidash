'use client';

import { useState } from 'react';
import { UserScheduleView, CalendarHeader, MyScheduleCalendarView } from '@/components/calendar';
import { Button } from '@/components/ui/button';
import { LayoutGrid, List } from 'lucide-react';
import { getNextMonth, getPreviousMonth } from '@/lib/calendar/utils';

interface MyScheduleContentProps {
  userId: string;
  userName?: string;
}

export function MyScheduleContent({ userId, userName }: MyScheduleContentProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  const handlePreviousMonth = () => {
    setCurrentDate(getPreviousMonth(currentDate));
  };

  const handleNextMonth = () => {
    setCurrentDate(getNextMonth(currentDate));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with navigation */}
      <div className="flex flex-col gap-3 sm:gap-4">
        {/* Calendar navigation */}
        <CalendarHeader
          currentDate={currentDate}
          onPreviousMonth={handlePreviousMonth}
          onNextMonth={handleNextMonth}
          onToday={handleToday}
        />

        {/* View toggle - full width on mobile */}
        <div className="flex items-center gap-1 border rounded-lg p-1 w-full sm:w-auto">
          <Button
            variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 sm:h-7 gap-1 flex-1 sm:flex-none"
            onClick={() => setViewMode('calendar')}
          >
            <LayoutGrid className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            <span className="sm:inline">Calendar</span>
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 sm:h-7 gap-1 flex-1 sm:flex-none"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            <span className="sm:inline">List</span>
          </Button>
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
