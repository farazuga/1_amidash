'use client';

import { ProjectCalendar } from '@/components/calendar';
import type { CalendarEvent } from '@/types/calendar';
import { useRouter } from 'next/navigation';

interface CalendarPageContentProps {
  isAdmin: boolean;
}

export function CalendarPageContent({ isAdmin }: CalendarPageContentProps) {
  const router = useRouter();

  const handleEventClick = (event: CalendarEvent) => {
    router.push(`/projects/${event.salesOrderNumber || event.projectId}`);
  };

  return (
    <div className="space-y-4">
      {/* Calendar */}
      <ProjectCalendar onEventClick={handleEventClick} />
    </div>
  );
}
