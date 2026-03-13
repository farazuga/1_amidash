'use client';

import { SEGMENT_ORDER, SEGMENT_LABELS } from '@/types/l10';
import type { MeetingSegment } from '@/types/l10';
import { cn } from '@/lib/utils';

interface MeetingSegmentNavProps {
  currentSegment: MeetingSegment;
  onSegmentClick: (segment: MeetingSegment) => void;
}

export function MeetingSegmentNav({ currentSegment, onSegmentClick }: MeetingSegmentNavProps) {
  const currentIndex = SEGMENT_ORDER.indexOf(currentSegment);

  return (
    <div className="flex gap-1">
      {SEGMENT_ORDER.map((segment, idx) => {
        const isActive = segment === currentSegment;
        const isCompleted = idx < currentIndex;

        return (
          <button
            key={segment}
            onClick={() => onSegmentClick(segment)}
            className={cn(
              'flex-1 rounded-md px-2 py-2 text-xs font-medium transition-colors text-center',
              isActive && 'bg-primary text-primary-foreground',
              isCompleted && !isActive && 'bg-primary/20 text-primary',
              !isActive && !isCompleted && 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {SEGMENT_LABELS[segment]}
          </button>
        );
      })}
    </div>
  );
}
