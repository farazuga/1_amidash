import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useScorecard,
  useCreateMeasurable,
  useUpdateMeasurable,
  useDeleteMeasurable,
  useReorderMeasurables,
  useUpsertScorecardEntry,
  useAutoPopulateScorecardWeek,
} from '../use-l10-scorecard';

vi.mock('@/app/(dashboard)/l10/scorecard-actions', () => ({
  getScorecard: vi.fn(),
  createMeasurable: vi.fn(),
  updateMeasurable: vi.fn(),
  deleteMeasurable: vi.fn(),
  reorderMeasurables: vi.fn(),
  upsertScorecardEntry: vi.fn(),
  autoPopulateScorecardWeek: vi.fn(),
}));

import {
  getScorecard,
  createMeasurable,
  updateMeasurable,
  deleteMeasurable,
  reorderMeasurables,
  upsertScorecardEntry,
  autoPopulateScorecardWeek,
} from '@/app/(dashboard)/l10/scorecard-actions';

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

describe('useScorecard', () => {
  const mockScorecard = {
    id: 'sc-1',
    team_id: 'team-1',
    measurables: [
      { id: 'm-1', title: 'Revenue', unit: '$', goal_value: 100000 },
      { id: 'm-2', title: 'New Clients', unit: '#', goal_value: 5 },
    ],
    entries: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches scorecard successfully', async () => {
    vi.mocked(getScorecard).mockResolvedValue({ success: true, data: mockScorecard });

    const { result } = renderHook(() => useScorecard('team-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockScorecard);
    expect(getScorecard).toHaveBeenCalledWith('team-1');
  });

  it('does not fetch when teamId is null', async () => {
    const { result } = renderHook(() => useScorecard(null), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getScorecard).not.toHaveBeenCalled();
  });

  it('handles error', async () => {
    vi.mocked(getScorecard).mockResolvedValue({ success: false, error: 'Scorecard not found' });

    const { result } = renderHook(() => useScorecard('team-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Scorecard not found');
  });

  it('shows loading state initially', async () => {
    vi.mocked(getScorecard).mockResolvedValue({ success: true, data: mockScorecard });

    const { result } = renderHook(() => useScorecard('team-1'), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.isLoading).toBe(false);
  });
});

describe('useCreateMeasurable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates measurable successfully', async () => {
    vi.mocked(createMeasurable).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useCreateMeasurable(), { wrapper: createWrapper() });

    result.current.mutate({ scorecardId: 'sc-1', title: 'Revenue' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createMeasurable).toHaveBeenCalledWith({ scorecardId: 'sc-1', title: 'Revenue' });
  });

  it('creates measurable with all fields', async () => {
    vi.mocked(createMeasurable).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useCreateMeasurable(), { wrapper: createWrapper() });

    result.current.mutate({
      scorecardId: 'sc-1',
      title: 'Revenue',
      ownerId: 'user-1',
      unit: '$',
      goalValue: 100000,
      goalDirection: 'above',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('handles error', async () => {
    vi.mocked(createMeasurable).mockResolvedValue({ success: false, error: 'Validation error' });

    const { result } = renderHook(() => useCreateMeasurable(), { wrapper: createWrapper() });

    result.current.mutate({ scorecardId: 'sc-1', title: '' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateMeasurable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates measurable successfully', async () => {
    vi.mocked(updateMeasurable).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useUpdateMeasurable(), { wrapper: createWrapper() });

    result.current.mutate({ id: 'm-1', title: 'Updated Revenue' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('handles error', async () => {
    vi.mocked(updateMeasurable).mockResolvedValue({ success: false, error: 'Not found' });

    const { result } = renderHook(() => useUpdateMeasurable(), { wrapper: createWrapper() });

    result.current.mutate({ id: 'bad-id', title: 'X' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteMeasurable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes measurable successfully', async () => {
    vi.mocked(deleteMeasurable).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useDeleteMeasurable(), { wrapper: createWrapper() });

    result.current.mutate('m-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteMeasurable).toHaveBeenCalledWith('m-1');
  });

  it('handles error', async () => {
    vi.mocked(deleteMeasurable).mockResolvedValue({ success: false, error: 'Cannot delete' });

    const { result } = renderHook(() => useDeleteMeasurable(), { wrapper: createWrapper() });

    result.current.mutate('m-1');

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useReorderMeasurables', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reorders measurables successfully', async () => {
    vi.mocked(reorderMeasurables).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useReorderMeasurables(), { wrapper: createWrapper() });

    const newOrder = [
      { id: 'm-2', display_order: 0 },
      { id: 'm-1', display_order: 1 },
    ];
    result.current.mutate(newOrder);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(reorderMeasurables).toHaveBeenCalledWith(newOrder);
  });

  it('handles error', async () => {
    vi.mocked(reorderMeasurables).mockResolvedValue({ success: false, error: 'Reorder failed' });

    const { result } = renderHook(() => useReorderMeasurables(), { wrapper: createWrapper() });

    result.current.mutate([]);

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpsertScorecardEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts scorecard entry successfully', async () => {
    vi.mocked(upsertScorecardEntry).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useUpsertScorecardEntry(), { wrapper: createWrapper() });

    result.current.mutate({ measurableId: 'm-1', weekOf: '2026-03-16', value: 95000 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(upsertScorecardEntry).toHaveBeenCalledWith({
      measurableId: 'm-1',
      weekOf: '2026-03-16',
      value: 95000,
    });
  });

  it('upserts entry with null value to clear', async () => {
    vi.mocked(upsertScorecardEntry).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useUpsertScorecardEntry(), { wrapper: createWrapper() });

    result.current.mutate({ measurableId: 'm-1', weekOf: '2026-03-16', value: null });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('handles error', async () => {
    vi.mocked(upsertScorecardEntry).mockResolvedValue({ success: false, error: 'Invalid data' });

    const { result } = renderHook(() => useUpsertScorecardEntry(), { wrapper: createWrapper() });

    result.current.mutate({ measurableId: 'm-1', weekOf: '2026-03-16', value: 100 });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useAutoPopulateScorecardWeek', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auto-populates scorecard week successfully', async () => {
    const populateResult = { populated: 3, skipped: 1 };
    vi.mocked(autoPopulateScorecardWeek).mockResolvedValue({ success: true, data: populateResult });

    const { result } = renderHook(() => useAutoPopulateScorecardWeek(), { wrapper: createWrapper() });

    result.current.mutate({ teamId: 'team-1', weekOf: '2026-03-16' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(populateResult);
    expect(autoPopulateScorecardWeek).toHaveBeenCalledWith('team-1', '2026-03-16');
  });

  it('handles error', async () => {
    vi.mocked(autoPopulateScorecardWeek).mockResolvedValue({ success: false, error: 'No auto sources' });

    const { result } = renderHook(() => useAutoPopulateScorecardWeek(), { wrapper: createWrapper() });

    result.current.mutate({ teamId: 'team-1', weekOf: '2026-03-16' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
