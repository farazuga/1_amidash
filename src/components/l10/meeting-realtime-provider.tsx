'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { L10_MEETING_KEY, L10_ACTIVE_MEETING_KEY } from '@/hooks/queries/use-l10-meetings';
import { L10_ISSUES_KEY } from '@/hooks/queries/use-l10-issues';
import { L10_TODOS_KEY } from '@/hooks/queries/use-l10-todos';

interface MeetingRealtimeProviderProps {
  meetingId: string;
  children: React.ReactNode;
}

export function MeetingRealtimeProvider({ meetingId, children }: MeetingRealtimeProviderProps) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    const channelName = `l10-meeting-${meetingId}`;

    const channel = supabase.channel(channelName)
      // Meeting state changes (segment, status)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'l10_meetings',
          filter: `id=eq.${meetingId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: [...L10_MEETING_KEY, meetingId] });
          queryClient.invalidateQueries({ queryKey: L10_ACTIVE_MEETING_KEY });
        }
      )
      // Attendee changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'l10_meeting_attendees',
          filter: `meeting_id=eq.${meetingId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: [...L10_MEETING_KEY, meetingId] });
        }
      )
      // Rating submissions
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'l10_meeting_ratings',
          filter: `meeting_id=eq.${meetingId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: [...L10_MEETING_KEY, meetingId] });
        }
      )
      // Issue changes (for IDS)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'l10_issues',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: L10_ISSUES_KEY });
        }
      )
      // Todo changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'l10_todos',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: L10_TODOS_KEY });
        }
      )
      // Headline changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'l10_headlines',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['l10', 'headlines'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetingId, queryClient]);

  return <>{children}</>;
}
