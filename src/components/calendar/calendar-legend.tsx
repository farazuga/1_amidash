'use client';

import { BOOKING_STATUS_CONFIG } from '@/lib/calendar/constants';
import type { BookingStatus } from '@/types/calendar';

export function CalendarLegend() {
  const statuses: BookingStatus[] = ['draft', 'tentative', 'pending_confirm', 'confirmed', 'complete'];

  return (
    <div className="flex items-center gap-4 text-sm">
      {statuses.map((status) => {
        const config = BOOKING_STATUS_CONFIG[status];
        return (
          <div key={status} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-full ${config.dotColor}`} />
            <span className="text-muted-foreground">{config.label}</span>
          </div>
        );
      })}
    </div>
  );
}
