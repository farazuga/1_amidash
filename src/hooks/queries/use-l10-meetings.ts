import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMeeting,
  getActiveMeeting,
  getMeetingHistory,
  startMeeting,
  advanceMeetingSegment,
  endMeeting,
  joinMeeting,
  submitRating,
} from '@/app/(dashboard)/l10/actions';
import type { MeetingSegment } from '@/types/l10';

export const L10_MEETING_KEY = ['l10', 'meeting'];
export const L10_MEETING_HISTORY_KEY = ['l10', 'meeting-history'];
export const L10_ACTIVE_MEETING_KEY = ['l10', 'active-meeting'];

const TEN_SECONDS = 10 * 1000;
const THIRTY_SECONDS = 30 * 1000;

export function useMeetingQuery(meetingId: string | null) {
  return useQuery({
    queryKey: [...L10_MEETING_KEY, meetingId],
    queryFn: async () => {
      if (!meetingId) return null;
      const result = await getMeeting(meetingId);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    staleTime: TEN_SECONDS,
    enabled: !!meetingId,
  });
}

export function useActiveMeeting(teamId: string | null) {
  return useQuery({
    queryKey: [...L10_ACTIVE_MEETING_KEY, teamId],
    queryFn: async () => {
      if (!teamId) return null;
      const result = await getActiveMeeting(teamId);
      if (!result.success) throw new Error(result.error);
      return result.data || null;
    },
    staleTime: TEN_SECONDS,
    enabled: !!teamId,
  });
}

export function useMeetingHistory(teamId: string | null) {
  return useQuery({
    queryKey: [...L10_MEETING_HISTORY_KEY, teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const result = await getMeetingHistory(teamId);
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    staleTime: THIRTY_SECONDS,
    enabled: !!teamId,
  });
}

export function useStartMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { teamId: string; title?: string }) => {
      const result = await startMeeting(data);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...L10_ACTIVE_MEETING_KEY, variables.teamId] });
      queryClient.invalidateQueries({ queryKey: L10_MEETING_HISTORY_KEY });
    },
  });
}

export function useAdvanceSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { meetingId: string; segment: MeetingSegment }) => {
      const result = await advanceMeetingSegment(data);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [...L10_MEETING_KEY, data.id] });
      queryClient.invalidateQueries({ queryKey: L10_ACTIVE_MEETING_KEY });
    },
  });
}

export function useEndMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (meetingId: string) => {
      const result = await endMeeting(meetingId);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_MEETING_KEY });
      queryClient.invalidateQueries({ queryKey: L10_ACTIVE_MEETING_KEY });
      queryClient.invalidateQueries({ queryKey: L10_MEETING_HISTORY_KEY });
    },
  });
}

export function useJoinMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (meetingId: string) => {
      const result = await joinMeeting(meetingId);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_MEETING_KEY });
    },
  });
}

export function useSubmitRating() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      meetingId: string;
      userId?: string;
      rating: number;
      explanation?: string;
    }) => {
      const result = await submitRating(data);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_MEETING_KEY });
      queryClient.invalidateQueries({ queryKey: L10_ACTIVE_MEETING_KEY });
    },
  });
}
