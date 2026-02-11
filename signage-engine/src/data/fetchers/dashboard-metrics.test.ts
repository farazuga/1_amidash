import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDashboardMetrics } from './dashboard-metrics';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../supabase-client', () => ({
  supabase: null,
  isSupabaseConfigured: vi.fn(() => false),
}));

describe('fetchDashboardMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mock data fallback', () => {
    it('should return mock metrics when Supabase not configured', async () => {
      const metrics = await fetchDashboardMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.health).toBeDefined();
      expect(metrics.alerts).toBeDefined();
      expect(metrics.performance).toBeDefined();
      expect(metrics.velocity).toBeDefined();
      expect(metrics.cycleTime).toBeDefined();
      expect(metrics.pipeline).toBeDefined();
    });
  });

  describe('health metrics structure', () => {
    it('should have valid salesHealth percentage', async () => {
      const metrics = await fetchDashboardMetrics();

      expect(metrics.health.salesHealth).toBeGreaterThanOrEqual(0);
      expect(metrics.health.salesHealth).toBeLessThanOrEqual(100);
    });

    it('should have valid opsHealth percentage', async () => {
      const metrics = await fetchDashboardMetrics();

      expect(metrics.health.opsHealth).toBeGreaterThanOrEqual(0);
      expect(metrics.health.opsHealth).toBeLessThanOrEqual(100);
    });

    it('should have valid diagnosis', async () => {
      const metrics = await fetchDashboardMetrics();

      expect(['healthy', 'sales', 'operations', 'both']).toContain(
        metrics.health.diagnosis
      );
    });

    it('should have message string', async () => {
      const metrics = await fetchDashboardMetrics();

      expect(typeof metrics.health.message).toBe('string');
      expect(metrics.health.message.length).toBeGreaterThan(0);
    });

    it('should have bottleneck counts', async () => {
      const metrics = await fetchDashboardMetrics();

      expect(metrics.health.bottlenecks).toBeDefined();
      expect(typeof metrics.health.bottlenecks.procurement).toBe('number');
      expect(typeof metrics.health.bottlenecks.engineering).toBe('number');
    });
  });

  describe('alerts data structure', () => {
    it('should have stuck projects array', async () => {
      const metrics = await fetchDashboardMetrics();

      expect(Array.isArray(metrics.alerts.stuckProjects)).toBe(true);
    });

    it('should have overdue projects array', async () => {
      const metrics = await fetchDashboardMetrics();

      expect(Array.isArray(metrics.alerts.overdueProjects)).toBe(true);
    });

    it('should have consistent totals', async () => {
      const metrics = await fetchDashboardMetrics();

      expect(metrics.alerts.totalStuck).toBe(metrics.alerts.stuckProjects.length);
      expect(metrics.alerts.totalOverdue).toBe(
        metrics.alerts.overdueProjects.length
      );
    });

    it('should calculate hasAlerts correctly', async () => {
      const metrics = await fetchDashboardMetrics();

      const expectedHasAlerts =
        metrics.alerts.stuckProjects.length > 0 ||
        metrics.alerts.overdueProjects.length > 0;
      expect(metrics.alerts.hasAlerts).toBe(expectedHasAlerts);
    });

    it('stuck projects should have required fields', async () => {
      const metrics = await fetchDashboardMetrics();

      if (metrics.alerts.stuckProjects.length > 0) {
        const stuck = metrics.alerts.stuckProjects[0];
        expect(stuck.id).toBeDefined();
        expect(stuck.clientName).toBeDefined();
        expect(typeof stuck.salesAmount).toBe('number');
        expect(typeof stuck.daysInStatus).toBe('number');
        expect(stuck.statusName).toBeDefined();
      }
    });

    it('overdue projects should have required fields', async () => {
      const metrics = await fetchDashboardMetrics();

      if (metrics.alerts.overdueProjects.length > 0) {
        const overdue = metrics.alerts.overdueProjects[0];
        expect(overdue.id).toBeDefined();
        expect(overdue.clientName).toBeDefined();
        expect(typeof overdue.salesAmount).toBe('number');
        expect(typeof overdue.daysOverdue).toBe('number');
        expect(overdue.goalDate).toBeDefined();
      }
    });
  });

  describe('performance metrics structure', () => {
    it('should have valid onTimePercent', async () => {
      const metrics = await fetchDashboardMetrics();

      expect(metrics.performance.onTimePercent).toBeGreaterThanOrEqual(0);
      expect(metrics.performance.onTimePercent).toBeLessThanOrEqual(100);
    });

    it('should have valid dti (days to invoice)', async () => {
      const metrics = await fetchDashboardMetrics();

      expect(typeof metrics.performance.dti).toBe('number');
      expect(metrics.performance.dti).toBeGreaterThanOrEqual(0);
    });

    it('should have valid backlogDepth', async () => {
      const metrics = await fetchDashboardMetrics();

      expect(typeof metrics.performance.backlogDepth).toBe('number');
      expect(metrics.performance.backlogDepth).toBeGreaterThanOrEqual(0);
    });

    it('should have valid concentrationRisk', async () => {
      const metrics = await fetchDashboardMetrics();

      expect(['low', 'medium', 'high']).toContain(
        metrics.performance.concentrationRisk
      );
    });

    it('should have topClients array', async () => {
      const metrics = await fetchDashboardMetrics();

      expect(Array.isArray(metrics.performance.topClients)).toBe(true);
      expect(metrics.performance.topClients.length).toBeLessThanOrEqual(3);
    });
  });

  describe('velocity data structure', () => {
    it('should have monthly data array', async () => {
      const metrics = await fetchDashboardMetrics();

      expect(Array.isArray(metrics.velocity.monthly)).toBe(true);
      expect(metrics.velocity.monthly.length).toBe(6); // 6 months
    });

    it('should have valid trend', async () => {
      const metrics = await fetchDashboardMetrics();

      expect(['growing', 'shrinking', 'stable']).toContain(
        metrics.velocity.trend
      );
    });

    it('monthly data should have required fields', async () => {
      const metrics = await fetchDashboardMetrics();

      metrics.velocity.monthly.forEach((month) => {
        expect(typeof month.month).toBe('string');
        expect(typeof month.posReceived).toBe('number');
        expect(typeof month.invoiced).toBe('number');
      });
    });

    it('should calculate netChange correctly', async () => {
      const metrics = await fetchDashboardMetrics();

      expect(metrics.velocity.netChange).toBe(
        metrics.velocity.totalPOs - metrics.velocity.totalInvoiced
      );
    });
  });

  describe('cycle time data structure', () => {
    it('should have statuses array', async () => {
      const metrics = await fetchDashboardMetrics();

      expect(Array.isArray(metrics.cycleTime.statuses)).toBe(true);
    });

    it('status entries should have required fields', async () => {
      const metrics = await fetchDashboardMetrics();

      metrics.cycleTime.statuses.forEach((status) => {
        expect(typeof status.name).toBe('string');
        expect(typeof status.avgDays).toBe('number');
        expect(typeof status.isBottleneck).toBe('boolean');
        expect(typeof status.color).toBe('string');
      });
    });

    it('should have totalAvgCycleTime', async () => {
      const metrics = await fetchDashboardMetrics();

      expect(typeof metrics.cycleTime.totalAvgCycleTime).toBe('number');
    });
  });

  describe('pipeline data structure', () => {
    it('should have statuses array', async () => {
      const metrics = await fetchDashboardMetrics();

      expect(Array.isArray(metrics.pipeline.statuses)).toBe(true);
    });

    it('pipeline entries should have required fields', async () => {
      const metrics = await fetchDashboardMetrics();

      metrics.pipeline.statuses.forEach((status) => {
        expect(typeof status.name).toBe('string');
        expect(typeof status.count).toBe('number');
        expect(typeof status.revenue).toBe('number');
        expect(typeof status.color).toBe('string');
        expect(typeof status.isBottleneck).toBe('boolean');
      });
    });

    it('should have consistent totalProjects', async () => {
      const metrics = await fetchDashboardMetrics();

      const sumCount = metrics.pipeline.statuses.reduce(
        (sum, s) => sum + s.count,
        0
      );
      expect(metrics.pipeline.totalProjects).toBe(sumCount);
    });

    it('should have consistent totalRevenue', async () => {
      const metrics = await fetchDashboardMetrics();

      const sumRevenue = metrics.pipeline.statuses.reduce(
        (sum, s) => sum + s.revenue,
        0
      );
      expect(metrics.pipeline.totalRevenue).toBe(sumRevenue);
    });
  });
});
