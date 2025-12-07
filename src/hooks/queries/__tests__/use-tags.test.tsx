import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from '../use-tags';

// Mock the Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/client';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return TestWrapper;
}

describe('useTags', () => {
  const mockTags = [
    { id: '1', name: 'Priority', color: '#ff0000' },
    { id: '2', name: 'Urgent', color: '#00ff00' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches tags successfully', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockTags, error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useTags(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockTags);
    expect(mockFrom).toHaveBeenCalledWith('tags');
  });

  it('handles fetch error', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: new Error('Failed') }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useTags(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateTag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates tag successfully', async () => {
    const newTag = { id: '3', name: 'New Tag', color: '#0000ff' };
    const mockFrom = vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: newTag, error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useCreateTag(), { wrapper: createWrapper() });

    result.current.mutate({ name: 'New Tag', color: '#0000ff' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFrom).toHaveBeenCalledWith('tags');
  });

  it('handles create error', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: new Error('Duplicate name') }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useCreateTag(), { wrapper: createWrapper() });

    result.current.mutate({ name: 'Existing', color: '#000' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateTag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates tag name successfully', async () => {
    const updatedTag = { id: '1', name: 'Updated Tag', color: '#ff0000' };
    const mockFrom = vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedTag, error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useUpdateTag(), { wrapper: createWrapper() });

    result.current.mutate({ id: '1', name: 'Updated Tag' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('updates tag color successfully', async () => {
    const updatedTag = { id: '1', name: 'Tag', color: '#ffffff' };
    const mockFrom = vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedTag, error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useUpdateTag(), { wrapper: createWrapper() });

    result.current.mutate({ id: '1', color: '#ffffff' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('handles update error', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useUpdateTag(), { wrapper: createWrapper() });

    result.current.mutate({ id: 'nonexistent', name: 'Test' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteTag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes tag successfully', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useDeleteTag(), { wrapper: createWrapper() });

    result.current.mutate('1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFrom).toHaveBeenCalledWith('tags');
  });

  it('handles delete error', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: new Error('Constraint violation') }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useDeleteTag(), { wrapper: createWrapper() });

    result.current.mutate('1');

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
