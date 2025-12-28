import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchRecentPOs } from './pos';

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock supabase-client module
const mockSupabase = {
  from: vi.fn(),
};

vi.mock('../supabase-client', () => ({
  supabase: null,
  isSupabaseConfigured: vi.fn(),
}));

import { logger } from '../../utils/logger';
import * as supabaseClient from '../supabase-client';

describe('fetchRecentPOs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when Supabase is not configured', () => {
    beforeEach(() => {
      vi.mocked(supabaseClient.isSupabaseConfigured).mockReturnValue(false);
    });

    it('should return mock POs', async () => {
      const pos = await fetchRecentPOs();

      expect(pos).toHaveLength(3);
      expect(pos[0]).toHaveProperty('id');
      expect(pos[0]).toHaveProperty('po_number');
      expect(pos[0]).toHaveProperty('project_name');
      expect(pos[0]).toHaveProperty('client_name');
      expect(pos[0]).toHaveProperty('amount');
      expect(pos[0]).toHaveProperty('created_at');
    });

    it('should log debug message about mock data', async () => {
      await fetchRecentPOs();

      expect(logger.debug).toHaveBeenCalledWith(
        'Supabase not configured, returning mock POs'
      );
    });

    it('should return POs with expected structure', async () => {
      const pos = await fetchRecentPOs();
      const po = pos[0];

      expect(typeof po.id).toBe('string');
      expect(typeof po.po_number).toBe('string');
      expect(typeof po.project_name).toBe('string');
      expect(typeof po.client_name).toBe('string');
      expect(typeof po.amount).toBe('number');
      expect(typeof po.created_at).toBe('string');
    });

    it('should return POs with valid ISO date strings', async () => {
      const pos = await fetchRecentPOs();

      pos.forEach((po) => {
        expect(() => new Date(po.created_at)).not.toThrow();
        expect(new Date(po.created_at).toISOString()).toBe(po.created_at);
      });
    });

    it('should return POs with positive amounts', async () => {
      const pos = await fetchRecentPOs();

      pos.forEach((po) => {
        expect(po.amount).toBeGreaterThan(0);
      });
    });
  });

  describe('when Supabase is configured', () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn(),
    };

    beforeEach(() => {
      vi.mocked(supabaseClient.isSupabaseConfigured).mockReturnValue(true);
      // @ts-expect-error - Mocking module export
      supabaseClient.supabase = mockSupabase;
      mockSupabase.from.mockReturnValue(mockQuery);
    });

    it('should fetch POs from database', async () => {
      mockQuery.limit.mockResolvedValueOnce({
        data: [
          {
            id: 'po-1',
            po_number: 'PO-2024-100',
            client_name: 'Test Client',
            sales_amount: 25000,
            created_at: '2024-01-15T10:00:00Z',
          },
        ],
        error: null,
      });

      const pos = await fetchRecentPOs();

      expect(mockSupabase.from).toHaveBeenCalledWith('projects');
      expect(pos).toHaveLength(1);
      expect(pos[0].po_number).toBe('PO-2024-100');
    });

    it('should transform database response correctly', async () => {
      mockQuery.limit.mockResolvedValueOnce({
        data: [
          {
            id: 'po-123',
            po_number: 'PO-2024-456',
            client_name: 'Acme Corp',
            sales_amount: 50000,
            created_at: '2024-02-01T14:30:00Z',
          },
        ],
        error: null,
      });

      const pos = await fetchRecentPOs();

      expect(pos[0]).toEqual({
        id: 'po-123',
        po_number: 'PO-2024-456',
        project_name: 'Acme Corp',
        client_name: 'Acme Corp',
        amount: 50000,
        created_at: '2024-02-01T14:30:00Z',
      });
    });

    it('should handle null sales_amount', async () => {
      mockQuery.limit.mockResolvedValueOnce({
        data: [
          {
            id: 'po-1',
            po_number: 'PO-2024-001',
            client_name: 'Test Client',
            sales_amount: null,
            created_at: '2024-01-15T10:00:00Z',
          },
        ],
        error: null,
      });

      const pos = await fetchRecentPOs();

      expect(pos[0].amount).toBe(0);
    });

    it('should return empty array on database error', async () => {
      mockQuery.limit.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error', code: 'PGRST000' },
      });

      const pos = await fetchRecentPOs();

      expect(pos).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Object) },
        'Failed to fetch recent POs'
      );
    });

    it('should filter out projects without PO numbers', async () => {
      mockQuery.limit.mockResolvedValueOnce({ data: [], error: null });

      await fetchRecentPOs();

      expect(mockQuery.not).toHaveBeenCalledWith('po_number', 'is', null);
    });

    it('should order by created_at descending', async () => {
      mockQuery.limit.mockResolvedValueOnce({ data: [], error: null });

      await fetchRecentPOs();

      expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('should limit results to 15 POs', async () => {
      mockQuery.limit.mockResolvedValueOnce({ data: [], error: null });

      await fetchRecentPOs();

      expect(mockQuery.limit).toHaveBeenCalledWith(15);
    });

    it('should handle empty result set', async () => {
      mockQuery.limit.mockResolvedValueOnce({ data: [], error: null });

      const pos = await fetchRecentPOs();

      expect(pos).toEqual([]);
    });

    it('should handle null data gracefully', async () => {
      mockQuery.limit.mockResolvedValueOnce({ data: null, error: null });

      const pos = await fetchRecentPOs();

      expect(pos).toEqual([]);
    });
  });
});
