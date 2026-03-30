import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchRevenueData, RevenueData } from './revenue';

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

describe('fetchRevenueData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when Supabase is not configured', () => {
    beforeEach(() => {
      vi.mocked(supabaseClient.isSupabaseConfigured).mockReturnValue(false);
    });

    it('should return mock revenue data', async () => {
      const revenue = await fetchRevenueData();

      expect(revenue).toHaveProperty('currentMonthRevenue');
      expect(revenue).toHaveProperty('currentMonthGoal');
      expect(revenue).toHaveProperty('yearToDateRevenue');
      expect(revenue).toHaveProperty('yearToDateGoal');
      expect(revenue).toHaveProperty('monthlyData');
    });

    it('should log debug message about mock data', async () => {
      await fetchRevenueData();

      expect(logger.debug).toHaveBeenCalledWith(
        'Supabase not configured, returning mock revenue'
      );
    });

    it('should return revenue data with expected structure', async () => {
      const revenue = await fetchRevenueData();

      expect(typeof revenue.currentMonthRevenue).toBe('number');
      expect(typeof revenue.currentMonthGoal).toBe('number');
      expect(typeof revenue.yearToDateRevenue).toBe('number');
      expect(typeof revenue.yearToDateGoal).toBe('number');
      expect(Array.isArray(revenue.monthlyData)).toBe(true);
    });

    it('should return 12 months of data', async () => {
      const revenue = await fetchRevenueData();

      expect(revenue.monthlyData).toHaveLength(12);
    });

    it('should have valid monthly data structure', async () => {
      const revenue = await fetchRevenueData();

      revenue.monthlyData.forEach((month) => {
        expect(month).toHaveProperty('month');
        expect(month).toHaveProperty('revenue');
        expect(month).toHaveProperty('goal');
        expect(typeof month.month).toBe('string');
        expect(typeof month.revenue).toBe('number');
        expect(typeof month.goal).toBe('number');
      });
    });

    it('should have non-negative revenue values', async () => {
      const revenue = await fetchRevenueData();

      expect(revenue.currentMonthRevenue).toBeGreaterThanOrEqual(0);
      expect(revenue.yearToDateRevenue).toBeGreaterThanOrEqual(0);
      revenue.monthlyData.forEach((month) => {
        expect(month.revenue).toBeGreaterThanOrEqual(0);
        expect(month.goal).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('when Supabase is configured', () => {
    const mockGoalsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn(),
    };

    const mockProjectsQuery = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn(),
    };

    beforeEach(() => {
      vi.mocked(supabaseClient.isSupabaseConfigured).mockReturnValue(true);
      // @ts-expect-error - Mocking module export
      supabaseClient.supabase = mockSupabase;

      // Set up chainable mocks
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'revenue_goals') return mockGoalsQuery;
        if (table === 'projects') return mockProjectsQuery;
        return mockGoalsQuery;
      });
    });

    it('should fetch revenue data from database', async () => {
      // Mock goals
      mockGoalsQuery.eq.mockResolvedValueOnce({
        data: [
          { month: 1, revenue_goal: 100000 },
          { month: 2, revenue_goal: 100000 },
        ],
        error: null,
      });

      // Mock invoiced projects
      mockProjectsQuery.lte.mockResolvedValueOnce({
        data: [
          { invoiced_date: '2024-01-15', sales_amount: 50000 },
          { invoiced_date: '2024-01-20', sales_amount: 30000 },
        ],
        error: null,
      });

      const revenue = await fetchRevenueData();

      expect(mockSupabase.from).toHaveBeenCalledWith('revenue_goals');
      expect(mockSupabase.from).toHaveBeenCalledWith('projects');
      expect(revenue.monthlyData).toHaveLength(12);
    });

    it('should calculate YTD revenue correctly', async () => {
      mockGoalsQuery.eq.mockResolvedValueOnce({
        data: [
          { month: 1, revenue_goal: 50000 },
          { month: 2, revenue_goal: 60000 },
        ],
        error: null,
      });

      mockProjectsQuery.lte.mockResolvedValueOnce({
        data: [
          { invoiced_date: '2024-01-10', sales_amount: 40000 },
          { invoiced_date: '2024-02-15', sales_amount: 55000 },
        ],
        error: null,
      });

      const revenue = await fetchRevenueData();

      // Check that monthly data has values
      expect(revenue.monthlyData[0].revenue).toBe(40000); // January
      expect(revenue.monthlyData[1].revenue).toBe(55000); // February
    });

    it('should handle null project values', async () => {
      mockGoalsQuery.eq.mockResolvedValueOnce({ data: [], error: null });

      mockProjectsQuery.lte.mockResolvedValueOnce({
        data: [
          { invoiced_date: '2024-01-10', sales_amount: null },
          { invoiced_date: '2024-01-15', sales_amount: 0 },
        ],
        error: null,
      });

      const revenue = await fetchRevenueData();

      // Should not throw and handle nulls as 0
      expect(revenue.monthlyData[0].revenue).toBe(0);
    });

    it('should return mock data on error', async () => {
      mockGoalsQuery.eq.mockRejectedValueOnce(new Error('Database error'));

      const revenue = await fetchRevenueData();

      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error) },
        'Failed to fetch revenue data, returning mock data'
      );
      // Should return mock data on error
      expect(revenue.monthlyData).toHaveLength(12);
    });

    it('should handle missing goals gracefully', async () => {
      mockGoalsQuery.eq.mockResolvedValueOnce({ data: null, error: null });

      mockProjectsQuery.lte.mockResolvedValueOnce({ data: [], error: null });

      const revenue = await fetchRevenueData();

      // Should still return valid structure with 0 goals
      expect(revenue.monthlyData).toHaveLength(12);
      revenue.monthlyData.forEach((month) => {
        expect(month.goal).toBe(0);
      });
    });

    it('should filter by current year', async () => {
      const currentYear = new Date().getFullYear();

      mockGoalsQuery.eq.mockResolvedValueOnce({ data: [], error: null });

      mockProjectsQuery.lte.mockResolvedValueOnce({ data: [], error: null });

      await fetchRevenueData();

      expect(mockGoalsQuery.eq).toHaveBeenCalledWith('year', currentYear);
      expect(mockProjectsQuery.gte).toHaveBeenCalledWith(
        'invoiced_date',
        `${currentYear}-01-01`
      );
      expect(mockProjectsQuery.lte).toHaveBeenCalledWith(
        'invoiced_date',
        `${currentYear}-12-31`
      );
    });
  });

  describe('mock data validation', () => {
    beforeEach(() => {
      vi.mocked(supabaseClient.isSupabaseConfigured).mockReturnValue(false);
    });

    it('should have realistic mock values', async () => {
      const revenue = await fetchRevenueData();

      // Current month should be less than or equal to YTD
      expect(revenue.currentMonthRevenue).toBeLessThanOrEqual(revenue.yearToDateRevenue);

      // Goals should be positive
      expect(revenue.currentMonthGoal).toBeGreaterThan(0);
      expect(revenue.yearToDateGoal).toBeGreaterThan(0);
    });

    it('should have all months represented', async () => {
      const revenue = await fetchRevenueData();
      const expectedMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      const actualMonths = revenue.monthlyData.map((m) => m.month);
      expect(actualMonths).toEqual(expectedMonths);
    });
  });
});
