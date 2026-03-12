'use client';

import { useL10MeetingStore } from '@/lib/stores/l10-meeting-store';
import { SEGMENT_DURATIONS } from '@/types/l10';
import type { MeetingSegment } from '@/types/l10';
import { cn } from '@/lib/utils';

function formatTime(seconds: number): string {
  const mins = Math.floor(Math.abs(seconds) / 60);
  const secs = Math.abs(seconds) % 60;
  const sign = seconds < 0 ? '-' : '';
  return `${sign}${mins}:${secs.toString().padStart(2, '0')}`;
}

interface MeetingTimerProps {
  segment: MeetingSegment;
}

export function MeetingTimer({ segment }: MeetingTimerProps) {
  const { elapsedSeconds, segmentElapsedSeconds } = useL10MeetingStore();

  const segmentDuration = SEGMENT_DURATIONS[segment];
  const segmentRemaining = segmentDuration - segmentElapsedSeconds;
  const isOvertime = segmentRemaining < 0;

  return (
    <div className="flex items-center gap-3 text-sm font-mono">
      <span className="text-muted-foreground" title="Total meeting time">
        {formatTime(elapsedSeconds)}
      </span>
      <span className="text-muted-foreground">/</span>
      <span
        className={cn(
          'font-semibold',
          isOvertime ? 'text-destructive animate-pulse' : 'text-foreground'
        )}
        title={isOvertime ? 'Segment overtime!' : 'Segment remaining'}
      >
        {formatTime(segmentRemaining)}
      </span>
    </div>
  );
}
