'use client';

import type { OutlookEvent } from '@/lib/microsoft-graph/types';

function formatTime(dateTime: string, timeZone: string): string {
  const date = new Date(dateTime);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone });
}

export function OutlookEventBlock({ event, timeZone = 'America/New_York' }: { event: OutlookEvent; timeZone?: string }) {
  return (
    <div className="rounded border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-500 pointer-events-none select-none">
      <span className="font-medium">{event.subject}</span>
      {!event.isAllDay && (
        <span className="ml-1 text-gray-400">
          {formatTime(event.start.dateTime, timeZone)} - {formatTime(event.end.dateTime, timeZone)}
        </span>
      )}
      <span className="ml-1 italic text-gray-400">Outlook</span>
    </div>
  );
}
