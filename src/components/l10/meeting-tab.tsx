'use client';

import { useEffect } from 'react';
import { Play, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useActiveMeeting, useMeetingHistory, useStartMeeting } from '@/hooks/queries/use-l10-meetings';
import { useL10MeetingStore } from '@/lib/stores/l10-meeting-store';
import { MeetingRunner } from './meeting-runner';
import { toast } from 'sonner';
import type { Meeting } from '@/types/l10';

interface MeetingTabProps {
  teamId: string;
}

export function MeetingTab({ teamId }: MeetingTabProps) {
  const { data: activeMeeting, isLoading: loadingActive } = useActiveMeeting(teamId);
  const { data: history, isLoading: loadingHistory } = useMeetingHistory(teamId);
  const startMeeting = useStartMeeting();
  const { activeMeetingId, setActiveMeeting } = useL10MeetingStore();

  // Sync active meeting to store
  useEffect(() => {
    if (activeMeeting && activeMeeting.id !== activeMeetingId) {
      setActiveMeeting(activeMeeting.id, activeMeeting.current_segment || 'segue');
    }
  }, [activeMeeting, activeMeetingId, setActiveMeeting]);

  const handleStart = async () => {
    try {
      const meeting = await startMeeting.mutateAsync({ teamId });
      setActiveMeeting(meeting.id, 'segue');
      toast.success('Meeting started');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  if (loadingActive) {
    return <div className="h-64 animate-pulse rounded-md bg-muted" />;
  }

  // Active meeting - show runner
  if (activeMeeting) {
    return <MeetingRunner meeting={activeMeeting} teamId={teamId} />;
  }

  // No active meeting - show start button + history
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center gap-4 py-12 rounded-md border bg-muted/30">
        <h3 className="text-lg font-semibold">Ready to meet?</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Start a 90-minute L10 meeting with your team. All team members will be added as attendees automatically.
        </p>
        <Button size="lg" onClick={handleStart} disabled={startMeeting.isPending}>
          <Play className="mr-2 h-5 w-5" />
          {startMeeting.isPending ? 'Starting...' : 'Start Meeting'}
        </Button>
      </div>

      {/* Meeting History */}
      {!loadingHistory && history && history.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-medium">Meeting History</h4>
          </div>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">Date</th>
                  <th className="px-4 py-2 text-left font-medium">Title</th>
                  <th className="px-4 py-2 text-center font-medium">Rating</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((meeting: Meeting) => (
                  <tr key={meeting.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-2">
                      {meeting.started_at
                        ? new Date(meeting.started_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-2">{meeting.title}</td>
                    <td className="px-4 py-2 text-center">
                      {meeting.average_rating !== null ? (
                        <Badge variant={meeting.average_rating >= 8 ? 'default' : 'secondary'}>
                          {meeting.average_rating.toFixed(1)}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={meeting.status === 'completed' ? 'secondary' : 'outline'}>
                        {meeting.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
