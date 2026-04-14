import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
const mockSelect = vi.fn();
const mockNot = vi.fn();
const mockGte = vi.fn();
const mockLt = vi.fn();
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({ from: mockFrom })),
}));

import { getReceivedPOs } from '../actions';

describe('getReceivedPOs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Chain: from('projects').select(...).not('po_number', 'is', null).gte('created_date', ...).lt('created_date', ...)
    mockSelect.mockReturnValue({ not: mockNot });
    mockNot.mockReturnValue({ gte: mockGte });
    mockGte.mockReturnValue({ lt: mockLt });
  });

  it('returns aggregated PO data for a month', async () => {
    mockLt.mockResolvedValue({
      data: [
        { id: '1', client_name: 'Acme Co', sales_amount: 50000, created_date: '2026-04-05' },
        { id: '2', client_name: 'Beta Inc', sales_amount: 80000, created_date: '2026-04-12' },
      ],
      error: null,
    });

    const result = await getReceivedPOs('2026-04');
    expect(result).toEqual({
      totalValue: 130000,
      count: 2,
      projects: [
        { id: '1', client_name: 'Acme Co', sales_amount: 50000, created_date: '2026-04-05' },
        { id: '2', client_name: 'Beta Inc', sales_amount: 80000, created_date: '2026-04-12' },
      ],
    });

    expect(mockFrom).toHaveBeenCalledWith('projects');
    expect(mockNot).toHaveBeenCalledWith('po_number', 'is', null);
    expect(mockGte).toHaveBeenCalledWith('created_date', '2026-04-01');
    expect(mockLt).toHaveBeenCalledWith('created_date', '2026-05-01');
  });

  it('returns zeros when no POs found', async () => {
    mockLt.mockResolvedValue({ data: [], error: null });

    const result = await getReceivedPOs('2026-04');
    expect(result).toEqual({ totalValue: 0, count: 0, projects: [] });
  });

  it('returns zeros on Supabase error', async () => {
    mockLt.mockResolvedValue({ data: null, error: { message: 'fail' } });

    const result = await getReceivedPOs('2026-04');
    expect(result).toEqual({ totalValue: 0, count: 0, projects: [] });
  });
});
