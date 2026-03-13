'use client';

import type { MeetingWithDetails } from '@/types/l10';

interface SegueSegmentProps {
  meeting: MeetingWithDetails;
  teamId: string;
}

export function SegueSegment({ meeting }: SegueSegmentProps) {
  const attendees = meeting.l10_meeting_attendees || [];

  return (
    <div className="space-y-4 rounded-md border p-6">
      <div>
        <h4 className="font-semibold">Segue</h4>
        <p className="text-sm text-muted-foreground">
          Share one personal and one professional best from the past week.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {attendees.map((a) => (
          <div
            key={a.id}
            className="rounded-md border p-3 text-center text-sm font-medium"
          >
            {a.profiles?.full_name || 'Team Member'}
          </div>
        ))}
      </div>
    </div>
  );
}
