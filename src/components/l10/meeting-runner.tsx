'use client';

import { useEffect, useRef } from 'react';
import { ChevronRight, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdvanceSegment, useEndMeeting } from '@/hooks/queries/use-l10-meetings';
import { useL10MeetingStore } from '@/lib/stores/l10-meeting-store';
import { MeetingTimer } from './meeting-timer';
import { MeetingSegmentNav } from './meeting-segment-nav';
import { MeetingSegmentContent } from './meeting-segment-content';
import { MeetingRealtimeProvider } from './meeting-realtime-provider';
import { toast } from 'sonner';
import type { MeetingWithDetails, MeetingSegment } from '@/types/l10';
import { SEGMENT_ORDER, SEGMENT_LABELS } from '@/types/l10';

interface MeetingRunnerProps {
  meeting: MeetingWithDetails;
  teamId: string;
}

export function MeetingRunner({ meeting, teamId }: MeetingRunnerProps) {
  const advanceSegment = useAdvanceSegment();
  const endMeetingMut = useEndMeeting();
  const {
    currentSegment,
    isTimerRunning,
    setCurrentSegment,
    tickTimer,
    clearActiveMeeting,
  } = useL10MeetingStore();

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer tick
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => tickTimer(), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, tickTimer]);

  // Sync segment from server
  useEffect(() => {
    if (meeting.current_segment && meeting.current_segment !== currentSegment) {
      setCurrentSegment(meeting.current_segment);
    }
  }, [meeting.current_segment, currentSegment, setCurrentSegment]);

  const segment = currentSegment || meeting.current_segment || 'segue';
  const segmentIndex = SEGMENT_ORDER.indexOf(segment);
  const isLastSegment = segmentIndex === SEGMENT_ORDER.length - 1;

  const handleNext = async () => {
    if (isLastSegment) return;
    const nextSegment = SEGMENT_ORDER[segmentIndex + 1];
    try {
      await advanceSegment.mutateAsync({
        meetingId: meeting.id,
        segment: nextSegment,
      });
      setCurrentSegment(nextSegment);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleEndMeeting = async () => {
    if (!confirm('End this meeting? Make sure everyone has rated.')) return;
    try {
      await endMeetingMut.mutateAsync(meeting.id);
      clearActiveMeeting();
      toast.success('Meeting ended');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <MeetingRealtimeProvider meetingId={meeting.id}>
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">{meeting.title}</h3>
          <MeetingTimer segment={segment} />
        </div>
        <div className="flex gap-2">
          {!isLastSegment ? (
            <Button onClick={handleNext} disabled={advanceSegment.isPending}>
              {SEGMENT_LABELS[SEGMENT_ORDER[segmentIndex + 1] as MeetingSegment]}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button variant="destructive" onClick={handleEndMeeting} disabled={endMeetingMut.isPending}>
              <Square className="mr-2 h-4 w-4" />
              End Meeting
            </Button>
          )}
        </div>
      </div>

      {/* Segment navigation */}
      <MeetingSegmentNav
        currentSegment={segment}
        onSegmentClick={async (seg) => {
          try {
            await advanceSegment.mutateAsync({
              meetingId: meeting.id,
              segment: seg,
            });
            setCurrentSegment(seg);
          } catch (error) {
            toast.error((error as Error).message);
          }
        }}
      />

      {/* Segment content */}
      <MeetingSegmentContent
        segment={segment}
        meeting={meeting}
        teamId={teamId}
      />
    </div>
    </MeetingRealtimeProvider>
  );
}
