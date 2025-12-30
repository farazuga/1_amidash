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
