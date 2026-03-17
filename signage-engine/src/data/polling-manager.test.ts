import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PollingManager, DataCache } from './polling-manager';
import { PollingConfig } from '../config/schema';

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock all fetchers
vi.mock('./fetchers/projects', () => ({
  fetchActiveProjects: vi.fn(),
  fetchInvoicedProjects: vi.fn(),
}));

vi.mock('./fetchers/pos', () => ({
  fetchPOs: vi.fn(),
}));

vi.mock('./fetchers/revenue', () => ({
  fetchRevenueData: vi.fn(),
}));

vi.mock('./fetchers/blocks-config', () => ({
  fetchBlocksConfig: vi.fn(),
}));

vi.mock('./supabase-client', () => ({
  supabase: null,
  isSupabaseConfigured: vi.fn(() => false),
}));

// Import mocked modules
import { fetchActiveProjects, fetchInvoicedProjects } from './fetchers/projects';
import { fetchPOs } from './fetchers/pos';
import { fetchRevenueData } from './fetchers/revenue';
import { fetchBlocksConfig } from './fetchers/blocks-config';
import { logger } from '../utils/logger';

describe('PollingManager', () => {
  const defaultConfig: PollingConfig = {
    projects: 30000,
    invoicedProjects: 60000,
    purchaseOrders: 30000,
    revenue: 60000,
    blocksConfig: 30000,
  };

  const mockProjects = [
    { id: '1', name: 'Project 1', client_name: 'Client A', status: 'Active', status_color: '#00ff00' },
    { id: '2', name: 'Project 2', client_name: 'Client B', status: 'Pending', status_color: '#ffff00' },
  ];

  const mockInvoicedProjects = [
    { id: 'inv-1', name: 'Done Project', client_name: 'Client C', total_value: 50000, completed_at: '2026-03-01' },
  ];

  const mockPOs = [
    { id: '1', po_number: 'PO-001', project_name: 'Project 1', client_name: 'Client A', amount: 15000, created_at: '2024-01-15', highlight_reason: 'newest' },
  ];

  const mockRevenue = {
    currentMonthRevenue: 50000,
    currentMonthGoal: 60000,
    quarterRevenue: 150000,
    quarterGoal: 180000,
    yearToDateRevenue: 500000,
    yearToDateGoal: 600000,
    monthlyData: [],
  };

  const mockBlocksConfig = {
    blocks: [
      { id: '1', block_type: 'po-highlight', title: 'POs', content: {}, enabled: true, position: 'left', display_order: 0 },
    ],
    settings: { rotation_interval_ms: 15000 },
  };

  let pollingManager: PollingManager;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Set up default mock implementations
    vi.mocked(fetchActiveProjects).mockResolvedValue(mockProjects as never);
    vi.mocked(fetchInvoicedProjects).mockResolvedValue(mockInvoicedProjects as never);
    vi.mocked(fetchPOs).mockResolvedValue(mockPOs as never);
    vi.mocked(fetchRevenueData).mockResolvedValue(mockRevenue as never);
    vi.mocked(fetchBlocksConfig).mockResolvedValue(mockBlocksConfig as never);

    pollingManager = new PollingManager(defaultConfig);
  });

  afterEach(() => {
    pollingManager.stop();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with empty cache', () => {
      const cache = pollingManager.getCache();

      expect(cache.projects.data).toEqual([]);
      expect(cache.projects.lastUpdated).toBeNull();
      expect(cache.invoicedProjects.data).toEqual([]);
      expect(cache.pos.data).toEqual([]);
      expect(cache.revenue.data).toBeNull();
      expect(cache.blocksConfig.data).toBeNull();
    });
  });

  describe('start', () => {
    it('should fetch all data initially', async () => {
      await pollingManager.start();

      expect(fetchActiveProjects).toHaveBeenCalledTimes(1);
      expect(fetchInvoicedProjects).toHaveBeenCalledTimes(1);
      expect(fetchPOs).toHaveBeenCalledTimes(1);
      expect(fetchRevenueData).toHaveBeenCalledTimes(1);
      expect(fetchBlocksConfig).toHaveBeenCalledTimes(1);
    });

    it('should populate cache with fetched data', async () => {
      await pollingManager.start();

      const cache = pollingManager.getCache();

      expect(cache.projects.data).toEqual(mockProjects);
      expect(cache.projects.lastUpdated).toBeInstanceOf(Date);
      expect(cache.invoicedProjects.data).toEqual(mockInvoicedProjects);
      expect(cache.pos.data).toEqual(mockPOs);
      expect(cache.revenue.data).toEqual(mockRevenue);
      expect(cache.blocksConfig.data).toEqual(mockBlocksConfig);
    });

    it('should log start message', async () => {
      await pollingManager.start();

      expect(logger.info).toHaveBeenCalledWith('Starting polling manager');
    });

    it('should log polling config after setup', async () => {
      await pollingManager.start();

      expect(logger.info).toHaveBeenCalledWith(
        { config: defaultConfig },
        'Polling intervals configured'
      );
    });

    it('should set up polling intervals', async () => {
      await pollingManager.start();
      vi.clearAllMocks();

      // Advance time by projects interval (30s)
      await vi.advanceTimersByTimeAsync(30000);

      expect(fetchActiveProjects).toHaveBeenCalledTimes(1);
      expect(fetchPOs).toHaveBeenCalledTimes(1);
      expect(fetchBlocksConfig).toHaveBeenCalledTimes(1);
    });

    it('should poll invoiced projects at 60s interval', async () => {
      await pollingManager.start();
      vi.clearAllMocks();

      await vi.advanceTimersByTimeAsync(60000);

      expect(fetchInvoicedProjects).toHaveBeenCalledTimes(1);
    });

    it('should poll revenue at revenue interval', async () => {
      await pollingManager.start();
      vi.clearAllMocks();

      await vi.advanceTimersByTimeAsync(60000);

      expect(fetchRevenueData).toHaveBeenCalledTimes(1);
    });

    it('should poll multiple times over extended period', async () => {
      await pollingManager.start();
      vi.clearAllMocks();

      // Advance 2 minutes (120000ms)
      await vi.advanceTimersByTimeAsync(120000);

      // Projects: 30s interval, so 4 calls in 120s
      expect(fetchActiveProjects).toHaveBeenCalledTimes(4);
      // POs: 30s interval, so 4 calls in 120s
      expect(fetchPOs).toHaveBeenCalledTimes(4);
      // Revenue: 60s interval, so 2 calls in 120s
      expect(fetchRevenueData).toHaveBeenCalledTimes(2);
      // Invoiced: 60s interval, so 2 calls in 120s
      expect(fetchInvoicedProjects).toHaveBeenCalledTimes(2);
      // Blocks: 30s interval, so 4 calls in 120s
      expect(fetchBlocksConfig).toHaveBeenCalledTimes(4);
    });
  });

  describe('stop', () => {
    it('should clear all intervals', async () => {
      await pollingManager.start();
      vi.clearAllMocks();

      pollingManager.stop();

      // Advance time - no fetches should happen
      await vi.advanceTimersByTimeAsync(120000);

      expect(fetchActiveProjects).not.toHaveBeenCalled();
      expect(fetchPOs).not.toHaveBeenCalled();
      expect(fetchRevenueData).not.toHaveBeenCalled();
    });

    it('should log stop message', async () => {
      await pollingManager.start();
      vi.clearAllMocks();

      pollingManager.stop();

      expect(logger.info).toHaveBeenCalledWith('Polling manager stopped');
    });

    it('should be safe to call stop multiple times', () => {
      pollingManager.stop();
      pollingManager.stop();
      pollingManager.stop();

      expect(true).toBe(true);
    });

    it('should be safe to call stop before start', () => {
      pollingManager.stop();

      expect(true).toBe(true);
    });
  });

  describe('getCache', () => {
    it('should return current cache state', async () => {
      await pollingManager.start();

      const cache = pollingManager.getCache();

      expect(cache).toHaveProperty('projects');
      expect(cache).toHaveProperty('invoicedProjects');
      expect(cache).toHaveProperty('pos');
      expect(cache).toHaveProperty('revenue');
      expect(cache).toHaveProperty('blocksConfig');
      expect(cache).toHaveProperty('connectionStatus');
    });

    it('should return updated cache after new fetch', async () => {
      await pollingManager.start();

      const updatedProjects = [{ id: '3', name: 'New Project' }];
      vi.mocked(fetchActiveProjects).mockResolvedValue(updatedProjects as never);

      await vi.advanceTimersByTimeAsync(30000);

      const cache = pollingManager.getCache();
      expect(cache.projects.data).toEqual(updatedProjects);
    });
  });

  describe('isDataStale', () => {
    it('should return true when data has never been fetched', () => {
      const isStale = pollingManager.isDataStale(30000);

      expect(isStale).toBe(true);
    });

    it('should return false when all data is fresh', async () => {
      await pollingManager.start();

      const isStale = pollingManager.isDataStale(60000);

      expect(isStale).toBe(false);
    });

    it('should return true when any data exceeds threshold', async () => {
      await pollingManager.start();

      // Advance time past threshold
      await vi.advanceTimersByTimeAsync(35000);

      // With 30000ms threshold, data should be stale
      const isStale = pollingManager.isDataStale(30000);

      expect(isStale).toBe(true);
    });

    it('should return true with very short threshold', async () => {
      await pollingManager.start();

      await vi.advanceTimersByTimeAsync(1);

      const isStale = pollingManager.isDataStale(0);

      expect(isStale).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle project fetch errors gracefully', async () => {
      vi.mocked(fetchActiveProjects).mockRejectedValue(new Error('Network error'));

      await pollingManager.start();

      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error) },
        'Failed to fetch projects'
      );

      const cache = pollingManager.getCache();
      expect(cache.projects.data).toEqual([]);
    });

    it('should handle PO fetch errors gracefully', async () => {
      vi.mocked(fetchPOs).mockRejectedValue(new Error('Database error'));

      await pollingManager.start();

      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error) },
        'Failed to fetch highlight POs'
      );
    });

    it('should handle revenue fetch errors gracefully', async () => {
      vi.mocked(fetchRevenueData).mockRejectedValue(new Error('API error'));

      await pollingManager.start();

      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error) },
        'Failed to fetch revenue'
      );
    });

    it('should handle invoiced projects fetch errors gracefully', async () => {
      vi.mocked(fetchInvoicedProjects).mockRejectedValue(new Error('Timeout'));

      await pollingManager.start();

      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error) },
        'Failed to fetch invoiced projects'
      );
    });

    it('should handle blocks config fetch errors gracefully', async () => {
      vi.mocked(fetchBlocksConfig).mockRejectedValue(new Error('Config error'));

      await pollingManager.start();

      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error) },
        'Failed to fetch blocks config'
      );
    });

    it('should continue polling after fetch error', async () => {
      vi.mocked(fetchActiveProjects)
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValue(mockProjects as never);

      await pollingManager.start();

      // First fetch failed, cache should be empty
      expect(pollingManager.getCache().projects.data).toEqual([]);

      // Advance to next poll
      await vi.advanceTimersByTimeAsync(30000);

      // Second fetch should succeed
      expect(pollingManager.getCache().projects.data).toEqual(mockProjects);
    });

    it('should handle partial fetch failures', async () => {
      vi.mocked(fetchActiveProjects).mockRejectedValue(new Error('Error'));
      // Other fetches succeed

      await pollingManager.start();

      const cache = pollingManager.getCache();

      // Projects failed
      expect(cache.projects.data).toEqual([]);
      expect(cache.projects.lastUpdated).toBeNull();

      // Others succeeded
      expect(cache.pos.data).toEqual(mockPOs);
      expect(cache.revenue.data).toEqual(mockRevenue);
    });
  });

  describe('concurrent operations', () => {
    it('should handle rapid start/stop cycles', async () => {
      await pollingManager.start();
      pollingManager.stop();
      await pollingManager.start();
      pollingManager.stop();

      // Should not throw or leak intervals
      await vi.advanceTimersByTimeAsync(60000);

      // Only initial fetches from the two starts
      expect(fetchActiveProjects).toHaveBeenCalledTimes(2);
    });
  });

  describe('debug logging', () => {
    it('should log debug info after successful fetches', async () => {
      await pollingManager.start();

      expect(logger.debug).toHaveBeenCalledWith(
        { count: mockProjects.length },
        'Fetched projects'
      );
      expect(logger.debug).toHaveBeenCalledWith(
        { count: mockPOs.length },
        'Fetched highlight POs'
      );
      expect(logger.debug).toHaveBeenCalledWith('Fetched revenue data');
      expect(logger.debug).toHaveBeenCalledWith(
        { count: mockInvoicedProjects.length },
        'Fetched invoiced projects'
      );
      expect(logger.debug).toHaveBeenCalledWith(
        { blockCount: mockBlocksConfig.blocks.length },
        'Fetched blocks config'
      );
    });
  });
});
