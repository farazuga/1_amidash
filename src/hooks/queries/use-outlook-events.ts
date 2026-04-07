import { useQuery } from '@tanstack/react-query';
import type { OutlookEvent } from '@/lib/microsoft-graph/types';

interface UseOutlookEventsParams {
  engineerIds: string[];
  startDate: string; // YYYY-MM-DD
  endDate: string;
  enabled?: boolean;
}

export function useOutlookEvents({
  engineerIds,
  startDate,
  endDate,
  enabled = true,
}: UseOutlookEventsParams) {
  return useQuery<Record<string, OutlookEvent[]>>({
    queryKey: ['outlook-events', engineerIds.sort().join(','), startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        engineers: engineerIds.join(','),
        start: startDate,
        end: endDate,
      });
      const res = await fetch(`/api/calendar/outlook-events?${params}`);
      if (!res.ok) throw new Error('Failed to fetch Outlook events');
      const data = await res.json();
      return data.events;
    },
    enabled: enabled && engineerIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 min cache
    refetchOnWindowFocus: false,
  });
}
