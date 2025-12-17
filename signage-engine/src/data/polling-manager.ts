import { logger } from '../utils/logger.js';
import { fetchActiveProjects, ActiveProject } from './fetchers/projects.js';
import { fetchRecentPOs, RecentPO } from './fetchers/pos.js';
import { fetchRevenueData, RevenueData } from './fetchers/revenue.js';
import { fetchScheduleData, ScheduleEntry } from './fetchers/schedule.js';
import { PollingConfig } from '../config/schema.js';

export interface DataCache {
  projects: { data: ActiveProject[]; lastUpdated: Date | null };
  pos: { data: RecentPO[]; lastUpdated: Date | null };
  revenue: { data: RevenueData | null; lastUpdated: Date | null };
  schedule: { data: ScheduleEntry[]; lastUpdated: Date | null };
}

export class PollingManager {
  private cache: DataCache = {
    projects: { data: [], lastUpdated: null },
    pos: { data: [], lastUpdated: null },
    revenue: { data: null, lastUpdated: null },
    schedule: { data: [], lastUpdated: null },
  };

  private intervals: NodeJS.Timeout[] = [];
  private config: PollingConfig;

  constructor(config: PollingConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    logger.info('Starting polling manager');

    // Initial fetch
    await this.fetchAll();

    // Set up intervals
    this.intervals.push(
      setInterval(() => this.fetchProjects(), this.config.projects),
      setInterval(() => this.fetchPOs(), this.config.purchaseOrders),
      setInterval(() => this.fetchRevenue(), this.config.revenue),
      setInterval(() => this.fetchSchedule(), this.config.schedule)
    );

    logger.info({ config: this.config }, 'Polling intervals configured');
  }

  stop(): void {
    this.intervals.forEach(clearInterval);
    this.intervals = [];
    logger.info('Polling manager stopped');
  }

  private async fetchAll(): Promise<void> {
    await Promise.all([
      this.fetchProjects(),
      this.fetchPOs(),
      this.fetchRevenue(),
      this.fetchSchedule(),
    ]);
  }

  private async fetchProjects(): Promise<void> {
    try {
      const data = await fetchActiveProjects();
      this.cache.projects = { data, lastUpdated: new Date() };
      logger.debug({ count: data.length }, 'Fetched projects');
    } catch (error) {
      logger.error({ error }, 'Failed to fetch projects');
    }
  }

  private async fetchPOs(): Promise<void> {
    try {
      const data = await fetchRecentPOs();
      this.cache.pos = { data, lastUpdated: new Date() };
      logger.debug({ count: data.length }, 'Fetched POs');
    } catch (error) {
      logger.error({ error }, 'Failed to fetch POs');
    }
  }

  private async fetchRevenue(): Promise<void> {
    try {
      const data = await fetchRevenueData();
      this.cache.revenue = { data, lastUpdated: new Date() };
      logger.debug('Fetched revenue data');
    } catch (error) {
      logger.error({ error }, 'Failed to fetch revenue');
    }
  }

  private async fetchSchedule(): Promise<void> {
    try {
      const data = await fetchScheduleData();
      this.cache.schedule = { data, lastUpdated: new Date() };
      logger.debug({ count: data.length }, 'Fetched schedule');
    } catch (error) {
      logger.error({ error }, 'Failed to fetch schedule');
    }
  }

  getCache(): DataCache {
    return this.cache;
  }

  isDataStale(thresholdMs: number): boolean {
    const now = Date.now();
    const checks = [
      this.cache.projects.lastUpdated,
      this.cache.pos.lastUpdated,
      this.cache.revenue.lastUpdated,
      this.cache.schedule.lastUpdated,
    ];

    return checks.some((date) => {
      if (!date) return true;
      return now - date.getTime() > thresholdMs;
    });
  }
}
