import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PollingManager } from './polling-manager';
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
}));
vi.mock('./fetchers/pos', () => ({
    fetchRecentPOs: vi.fn(),
}));
vi.mock('./fetchers/revenue', () => ({
    fetchRevenueData: vi.fn(),
}));
vi.mock('./fetchers/schedule', () => ({
    fetchScheduleData: vi.fn(),
}));
vi.mock('./fetchers/metrics', () => ({
    fetchProjectMetrics: vi.fn(),
}));
vi.mock('./fetchers/slide-config', () => ({
    fetchSlideConfig: vi.fn(),
}));
vi.mock('./supabase-client', () => ({
    supabase: null,
    isSupabaseConfigured: vi.fn(() => false),
}));
// Import mocked modules
import { fetchActiveProjects } from './fetchers/projects';
import { fetchRecentPOs } from './fetchers/pos';
import { fetchRevenueData } from './fetchers/revenue';
import { fetchScheduleData } from './fetchers/schedule';
import { fetchProjectMetrics } from './fetchers/metrics';
import { fetchSlideConfig } from './fetchers/slide-config';
import { logger } from '../utils/logger';
describe('PollingManager', () => {
    const defaultConfig = {
        projects: 30000,
        purchaseOrders: 15000,
        revenue: 60000,
        schedule: 30000,
    };
    const mockProjects = [
        { id: '1', name: 'Project 1', client_name: 'Client A', status: 'Active', status_color: '#00ff00' },
        { id: '2', name: 'Project 2', client_name: 'Client B', status: 'Pending', status_color: '#ffff00' },
    ];
    const mockPOs = [
        { id: '1', vendor: 'Vendor A', amount: 1000, date: '2024-01-15' },
    ];
    const mockRevenue = {
        mtd: 50000,
        ytd: 500000,
        target: 600000,
    };
    const mockSchedule = [
        { id: '1', employee: 'John', project: 'Project 1', date: '2024-01-15' },
    ];
    const mockMetrics = {
        total: 10,
        active: 5,
        completed: 3,
        pending: 2,
    };
    const mockSlideConfig = [
        { id: '1', slide_type: 'active-projects', enabled: true, duration_ms: 15000 },
    ];
    let pollingManager;
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        // Set up default mock implementations
        vi.mocked(fetchActiveProjects).mockResolvedValue(mockProjects);
        vi.mocked(fetchRecentPOs).mockResolvedValue(mockPOs);
        vi.mocked(fetchRevenueData).mockResolvedValue(mockRevenue);
        vi.mocked(fetchScheduleData).mockResolvedValue(mockSchedule);
        vi.mocked(fetchProjectMetrics).mockResolvedValue(mockMetrics);
        vi.mocked(fetchSlideConfig).mockResolvedValue(mockSlideConfig);
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
            expect(cache.pos.data).toEqual([]);
            expect(cache.revenue.data).toBeNull();
            expect(cache.schedule.data).toEqual([]);
            expect(cache.metrics.data).toBeNull();
            expect(cache.slideConfig.data).toEqual([]);
        });
    });
    describe('start', () => {
        it('should fetch all data initially', async () => {
            await pollingManager.start();
            expect(fetchActiveProjects).toHaveBeenCalledTimes(1);
            expect(fetchRecentPOs).toHaveBeenCalledTimes(1);
            expect(fetchRevenueData).toHaveBeenCalledTimes(1);
            expect(fetchScheduleData).toHaveBeenCalledTimes(1);
            expect(fetchProjectMetrics).toHaveBeenCalledTimes(1);
            expect(fetchSlideConfig).toHaveBeenCalledTimes(1);
        });
        it('should populate cache with fetched data', async () => {
            await pollingManager.start();
            const cache = pollingManager.getCache();
            expect(cache.projects.data).toEqual(mockProjects);
            expect(cache.projects.lastUpdated).toBeInstanceOf(Date);
            expect(cache.pos.data).toEqual(mockPOs);
            expect(cache.revenue.data).toEqual(mockRevenue);
            expect(cache.schedule.data).toEqual(mockSchedule);
            expect(cache.metrics.data).toEqual(mockMetrics);
            expect(cache.slideConfig.data).toEqual(mockSlideConfig);
        });
        it('should log start message', async () => {
            await pollingManager.start();
            expect(logger.info).toHaveBeenCalledWith('Starting polling manager');
        });
        it('should log polling config after setup', async () => {
            await pollingManager.start();
            expect(logger.info).toHaveBeenCalledWith({ config: defaultConfig }, 'Polling intervals configured');
        });
        it('should set up polling intervals', async () => {
            await pollingManager.start();
            // Clear initial fetch counts
            vi.clearAllMocks();
            // Advance time by projects interval
            await vi.advanceTimersByTimeAsync(30000);
            expect(fetchActiveProjects).toHaveBeenCalledTimes(1);
            expect(fetchProjectMetrics).toHaveBeenCalledTimes(1);
            expect(fetchScheduleData).toHaveBeenCalledTimes(1);
        });
        it('should poll POs at purchaseOrders interval', async () => {
            await pollingManager.start();
            vi.clearAllMocks();
            // Advance time by PO interval (15000ms)
            await vi.advanceTimersByTimeAsync(15000);
            expect(fetchRecentPOs).toHaveBeenCalledTimes(1);
        });
        it('should poll revenue at revenue interval', async () => {
            await pollingManager.start();
            vi.clearAllMocks();
            // Advance time by revenue interval (60000ms)
            await vi.advanceTimersByTimeAsync(60000);
            expect(fetchRevenueData).toHaveBeenCalledTimes(1);
        });
        it('should poll slide config every 60 seconds', async () => {
            await pollingManager.start();
            vi.clearAllMocks();
            await vi.advanceTimersByTimeAsync(60000);
            expect(fetchSlideConfig).toHaveBeenCalledTimes(1);
        });
        it('should poll multiple times over extended period', async () => {
            await pollingManager.start();
            vi.clearAllMocks();
            // Advance 2 minutes (120000ms)
            await vi.advanceTimersByTimeAsync(120000);
            // Projects: 30s interval, so 4 calls in 120s
            expect(fetchActiveProjects).toHaveBeenCalledTimes(4);
            // POs: 15s interval, so 8 calls in 120s
            expect(fetchRecentPOs).toHaveBeenCalledTimes(8);
            // Revenue: 60s interval, so 2 calls in 120s
            expect(fetchRevenueData).toHaveBeenCalledTimes(2);
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
            expect(fetchRecentPOs).not.toHaveBeenCalled();
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
            // Should not throw
            expect(true).toBe(true);
        });
        it('should be safe to call stop before start', () => {
            pollingManager.stop();
            // Should not throw
            expect(true).toBe(true);
        });
    });
    describe('getCache', () => {
        it('should return current cache state', async () => {
            await pollingManager.start();
            const cache = pollingManager.getCache();
            expect(cache).toHaveProperty('projects');
            expect(cache).toHaveProperty('pos');
            expect(cache).toHaveProperty('revenue');
            expect(cache).toHaveProperty('schedule');
            expect(cache).toHaveProperty('metrics');
            expect(cache).toHaveProperty('slideConfig');
        });
        it('should return updated cache after new fetch', async () => {
            await pollingManager.start();
            const updatedProjects = [{ id: '3', name: 'New Project' }];
            vi.mocked(fetchActiveProjects).mockResolvedValue(updatedProjects);
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
        it('should check all data sources except slideConfig', async () => {
            await pollingManager.start();
            // All data is fresh
            expect(pollingManager.isDataStale(60000)).toBe(false);
            // Advance time slightly
            await vi.advanceTimersByTimeAsync(5000);
            // Still fresh with 60s threshold
            expect(pollingManager.isDataStale(60000)).toBe(false);
        });
        it('should return true with very short threshold', async () => {
            await pollingManager.start();
            // Even 1ms later, with 0ms threshold, should be stale
            await vi.advanceTimersByTimeAsync(1);
            const isStale = pollingManager.isDataStale(0);
            expect(isStale).toBe(true);
        });
    });
    describe('error handling', () => {
        it('should handle project fetch errors gracefully', async () => {
            vi.mocked(fetchActiveProjects).mockRejectedValue(new Error('Network error'));
            await pollingManager.start();
            expect(logger.error).toHaveBeenCalledWith({ error: expect.any(Error) }, 'Failed to fetch projects');
            // Cache should remain empty
            const cache = pollingManager.getCache();
            expect(cache.projects.data).toEqual([]);
        });
        it('should handle PO fetch errors gracefully', async () => {
            vi.mocked(fetchRecentPOs).mockRejectedValue(new Error('Database error'));
            await pollingManager.start();
            expect(logger.error).toHaveBeenCalledWith({ error: expect.any(Error) }, 'Failed to fetch POs');
        });
        it('should handle revenue fetch errors gracefully', async () => {
            vi.mocked(fetchRevenueData).mockRejectedValue(new Error('API error'));
            await pollingManager.start();
            expect(logger.error).toHaveBeenCalledWith({ error: expect.any(Error) }, 'Failed to fetch revenue');
        });
        it('should handle schedule fetch errors gracefully', async () => {
            vi.mocked(fetchScheduleData).mockRejectedValue(new Error('Timeout'));
            await pollingManager.start();
            expect(logger.error).toHaveBeenCalledWith({ error: expect.any(Error) }, 'Failed to fetch schedule');
        });
        it('should handle metrics fetch errors gracefully', async () => {
            vi.mocked(fetchProjectMetrics).mockRejectedValue(new Error('Server error'));
            await pollingManager.start();
            expect(logger.error).toHaveBeenCalledWith({ error: expect.any(Error) }, 'Failed to fetch metrics');
        });
        it('should handle slide config fetch errors gracefully', async () => {
            vi.mocked(fetchSlideConfig).mockRejectedValue(new Error('Config error'));
            await pollingManager.start();
            expect(logger.error).toHaveBeenCalledWith({ error: expect.any(Error) }, 'Failed to fetch slide config');
        });
        it('should continue polling after fetch error', async () => {
            vi.mocked(fetchActiveProjects)
                .mockRejectedValueOnce(new Error('First error'))
                .mockResolvedValue(mockProjects);
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
            expect(logger.debug).toHaveBeenCalledWith({ count: mockProjects.length }, 'Fetched projects');
            expect(logger.debug).toHaveBeenCalledWith({ count: mockPOs.length }, 'Fetched POs');
            expect(logger.debug).toHaveBeenCalledWith('Fetched revenue data');
            expect(logger.debug).toHaveBeenCalledWith({ count: mockSchedule.length }, 'Fetched schedule');
            expect(logger.debug).toHaveBeenCalledWith({ total: mockMetrics.total }, 'Fetched metrics');
            expect(logger.debug).toHaveBeenCalledWith({ count: mockSlideConfig.length }, 'Fetched slide config');
        });
    });
});
//# sourceMappingURL=polling-manager.test.js.map