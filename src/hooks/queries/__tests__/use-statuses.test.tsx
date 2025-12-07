import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useStatuses,
  useCreateStatus,
  useUpdateStatus,
  useReorderStatuses,
  useProjectTypes,
  useCreateProjectType,
  useUpdateProjectType,
  useReorderProjectTypes,
  useStatusMap,
  useToggleStatusForType,
} from '../use-statuses';

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

describe('useStatuses', () => {
  const mockStatuses = [
    { id: '1', name: 'Order Entry', display_order: 1 },
    { id: '2', name: 'In Production', display_order: 2 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches statuses successfully', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockStatuses, error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useStatuses(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockStatuses);
    expect(mockFrom).toHaveBeenCalledWith('statuses');
  });

  it('handles fetch error', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: new Error('Failed') }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useStatuses(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates status successfully', async () => {
    const newStatus = { id: '3', name: 'New Status', require_note: false, display_order: 3 };
    const mockFrom = vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: newStatus, error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useCreateStatus(), { wrapper: createWrapper() });

    result.current.mutate({ name: 'New Status', require_note: false, display_order: 3 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFrom).toHaveBeenCalledWith('statuses');
  });
});

describe('useUpdateStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates status successfully', async () => {
    const updatedStatus = { id: '1', name: 'Updated Status' };
    const mockFrom = vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedStatus, error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useUpdateStatus(), { wrapper: createWrapper() });

    result.current.mutate({ id: '1', name: 'Updated Status' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useReorderStatuses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reorders statuses successfully', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useReorderStatuses(), { wrapper: createWrapper() });

    result.current.mutate([
      { id: '1', display_order: 2 },
      { id: '2', display_order: 1 },
    ]);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useProjectTypes', () => {
  const mockTypes = [
    { id: '1', name: 'Furniture', display_order: 1 },
    { id: '2', name: 'Signage', display_order: 2 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches project types successfully', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockTypes, error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useProjectTypes(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockTypes);
    expect(mockFrom).toHaveBeenCalledWith('project_types');
  });
});

describe('useCreateProjectType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates project type successfully', async () => {
    const newType = { id: '3', name: 'New Type', display_order: 3 };
    const mockFrom = vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: newType, error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useCreateProjectType(), { wrapper: createWrapper() });

    result.current.mutate({ name: 'New Type', display_order: 3 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useUpdateProjectType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates project type successfully', async () => {
    const updatedType = { id: '1', name: 'Updated Type' };
    const mockFrom = vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedType, error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useUpdateProjectType(), { wrapper: createWrapper() });

    result.current.mutate({ id: '1', name: 'Updated Type' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useReorderProjectTypes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reorders project types successfully', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useReorderProjectTypes(), { wrapper: createWrapper() });

    result.current.mutate([
      { id: '1', display_order: 2 },
      { id: '2', display_order: 1 },
    ]);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useStatusMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches status map successfully', async () => {
    const mockData = [
      { project_type_id: 'type1', status_id: 'status1' },
      { project_type_id: 'type1', status_id: 'status2' },
      { project_type_id: 'type2', status_id: 'status1' },
    ];

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useStatusMap(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      type1: ['status1', 'status2'],
      type2: ['status1'],
    });
  });

  it('returns empty map when no data', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useStatusMap(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({});
  });
});

describe('useToggleStatusForType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enables status for type', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const mockFrom = vi.fn().mockReturnValue({
      insert: mockInsert,
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useToggleStatusForType(), { wrapper: createWrapper() });

    result.current.mutate({ projectTypeId: 'type1', statusId: 'status1', enabled: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInsert).toHaveBeenCalledWith({
      project_type_id: 'type1',
      status_id: 'status1',
    });
  });

  it('disables status for type', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockFrom = vi.fn().mockReturnValue({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue({ eq: mockEq }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useToggleStatusForType(), { wrapper: createWrapper() });

    result.current.mutate({ projectTypeId: 'type1', statusId: 'status1', enabled: false });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
