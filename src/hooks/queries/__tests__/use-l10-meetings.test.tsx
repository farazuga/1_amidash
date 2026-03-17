import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useMeetingQuery,
  useActiveMeeting,
  useMeetingHistory,
  useStartMeeting,
  useAdvanceSegment,
  useEndMeeting,
  useJoinMeeting,
  useSubmitRating,
} from '../use-l10-meetings';

vi.mock('@/app/(dashboard)/l10/actions', () => ({
  getMeeting: vi.fn(),
  getActiveMeeting: vi.fn(),
  getMeetingHistory: vi.fn(),
  startMeeting: vi.fn(),
  advanceMeetingSegment: vi.fn(),
  endMeeting: vi.fn(),
  joinMeeting: vi.fn(),
  submitRating: vi.fn(),
}));

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

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useMeetingQuery', () => {
  const mockMeeting = {
    id: 'meeting-1',
    team_id: 'team-1',
    title: 'Weekly L10',
    status: 'in_progress',
    current_segment: 'segue',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches meeting successfully', async () => {
    vi.mocked(getMeeting).mockResolvedValue({ success: true, data: mockMeeting });

    const { result } = renderHook(() => useMeetingQuery('meeting-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockMeeting);
    expect(getMeeting).toHaveBeenCalledWith('meeting-1');
  });

  it('does not fetch when meetingId is null', async () => {
    const { result } = renderHook(() => useMeetingQuery(null), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getMeeting).not.toHaveBeenCalled();
  });

  it('handles error', async () => {
    vi.mocked(getMeeting).mockResolvedValue({ success: false, error: 'Not found' });

    const { result } = renderHook(() => useMeetingQuery('bad-id'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Not found');
  });
});

describe('useActiveMeeting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches active meeting successfully', async () => {
    const activeMeeting = { id: 'meeting-1', status: 'in_progress' };
    vi.mocked(getActiveMeeting).mockResolvedValue({ success: true, data: activeMeeting });

    const { result } = renderHook(() => useActiveMeeting('team-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(activeMeeting);
  });

  it('returns null when no active meeting', async () => {
    vi.mocked(getActiveMeeting).mockResolvedValue({ success: true, data: null });

    const { result } = renderHook(() => useActiveMeeting('team-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('does not fetch when teamId is null', async () => {
    const { result } = renderHook(() => useActiveMeeting(null), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getActiveMeeting).not.toHaveBeenCalled();
  });

  it('handles error', async () => {
    vi.mocked(getActiveMeeting).mockResolvedValue({ success: false, error: 'Server error' });

    const { result } = renderHook(() => useActiveMeeting('team-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useMeetingHistory', () => {
  const mockHistory = [
    { id: 'meeting-1', title: 'L10 #1', status: 'completed' },
    { id: 'meeting-2', title: 'L10 #2', status: 'completed' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches meeting history successfully', async () => {
    vi.mocked(getMeetingHistory).mockResolvedValue({ success: true, data: mockHistory });

    const { result } = renderHook(() => useMeetingHistory('team-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockHistory);
  });

  it('returns empty array when no history', async () => {
    vi.mocked(getMeetingHistory).mockResolvedValue({ success: true, data: [] });

    const { result } = renderHook(() => useMeetingHistory('team-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('does not fetch when teamId is null', async () => {
    const { result } = renderHook(() => useMeetingHistory(null), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('handles error', async () => {
    vi.mocked(getMeetingHistory).mockResolvedValue({ success: false, error: 'DB error' });

    const { result } = renderHook(() => useMeetingHistory('team-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useStartMeeting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts meeting successfully', async () => {
    const newMeeting = { id: 'meeting-new', status: 'in_progress' };
    vi.mocked(startMeeting).mockResolvedValue({ success: true, data: newMeeting });

    const { result } = renderHook(() => useStartMeeting(), { wrapper: createWrapper() });

    result.current.mutate({ teamId: 'team-1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(startMeeting).toHaveBeenCalledWith({ teamId: 'team-1' });
  });

  it('starts meeting with custom title', async () => {
    const newMeeting = { id: 'meeting-new', title: 'Special L10' };
    vi.mocked(startMeeting).mockResolvedValue({ success: true, data: newMeeting });

    const { result } = renderHook(() => useStartMeeting(), { wrapper: createWrapper() });

    result.current.mutate({ teamId: 'team-1', title: 'Special L10' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('handles error', async () => {
    vi.mocked(startMeeting).mockResolvedValue({ success: false, error: 'Meeting already active' });

    const { result } = renderHook(() => useStartMeeting(), { wrapper: createWrapper() });

    result.current.mutate({ teamId: 'team-1' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Meeting already active');
  });
});

describe('useAdvanceSegment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('advances segment successfully', async () => {
    const updated = { id: 'meeting-1', current_segment: 'scorecard' };
    vi.mocked(advanceMeetingSegment).mockResolvedValue({ success: true, data: updated });

    const { result } = renderHook(() => useAdvanceSegment(), { wrapper: createWrapper() });

    result.current.mutate({ meetingId: 'meeting-1', segment: 'scorecard' as never });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('handles error', async () => {
    vi.mocked(advanceMeetingSegment).mockResolvedValue({ success: false, error: 'Invalid segment' });

    const { result } = renderHook(() => useAdvanceSegment(), { wrapper: createWrapper() });

    result.current.mutate({ meetingId: 'meeting-1', segment: 'bad' as never });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useEndMeeting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ends meeting successfully', async () => {
    const ended = { id: 'meeting-1', status: 'completed' };
    vi.mocked(endMeeting).mockResolvedValue({ success: true, data: ended });

    const { result } = renderHook(() => useEndMeeting(), { wrapper: createWrapper() });

    result.current.mutate('meeting-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(endMeeting).toHaveBeenCalledWith('meeting-1');
  });

  it('handles error', async () => {
    vi.mocked(endMeeting).mockResolvedValue({ success: false, error: 'Already ended' });

    const { result } = renderHook(() => useEndMeeting(), { wrapper: createWrapper() });

    result.current.mutate('meeting-1');

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useJoinMeeting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('joins meeting successfully', async () => {
    vi.mocked(joinMeeting).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useJoinMeeting(), { wrapper: createWrapper() });

    result.current.mutate('meeting-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(joinMeeting).toHaveBeenCalledWith('meeting-1');
  });

  it('handles error', async () => {
    vi.mocked(joinMeeting).mockResolvedValue({ success: false, error: 'Meeting not active' });

    const { result } = renderHook(() => useJoinMeeting(), { wrapper: createWrapper() });

    result.current.mutate('meeting-1');

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useSubmitRating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits rating successfully', async () => {
    vi.mocked(submitRating).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useSubmitRating(), { wrapper: createWrapper() });

    result.current.mutate({ meetingId: 'meeting-1', rating: 8 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(submitRating).toHaveBeenCalledWith({ meetingId: 'meeting-1', rating: 8 });
  });

  it('submits rating with explanation', async () => {
    vi.mocked(submitRating).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useSubmitRating(), { wrapper: createWrapper() });

    result.current.mutate({ meetingId: 'meeting-1', rating: 9, explanation: 'Great meeting' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('handles error', async () => {
    vi.mocked(submitRating).mockResolvedValue({ success: false, error: 'Invalid rating' });

    const { result } = renderHook(() => useSubmitRating(), { wrapper: createWrapper() });

    result.current.mutate({ meetingId: 'meeting-1', rating: -1 });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
