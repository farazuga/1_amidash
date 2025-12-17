import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { fetchActiveProjects, fetchStatuses } from './fetchers/projects.js';
import { fetchRecentPOs } from './fetchers/pos.js';
import { fetchRevenueData } from './fetchers/revenue.js';
import { fetchScheduleData } from './fetchers/schedule.js';
import type { PollingConfig } from '../config/schema.js';
import type {
  SignageProject,
  PurchaseOrder,
  RevenueData,
  ScheduleData,
  Status,
} from '../types/database.js';

export type DataKey = 'projects' | 'pos' | 'revenue' | 'schedule' | 'statuses';

export interface CachedData {
  projects: SignageProject[];
  pos: PurchaseOrder[];
  revenue: RevenueData | null;
  schedule: ScheduleData | null;
  statuses: Status[];
}

export interface DataTimestamps {
  projects: number;
  pos: number;
  revenue: number;
  schedule: number;
  statuses: number;
}

interface DataUpdateEvent {
  key: DataKey;
  data: unknown;
  timestamp: number;
}

interface DataErrorEvent {
  key: DataKey;
  error: Error;
  timestamp: number;
}

/**
 * Polling manager that periodically fetches data from Supabase
 * and caches it in memory for the slide renderers.
 */
export class PollingManager extends EventEmitter {
  private intervals: Map<DataKey, NodeJS.Timeout> = new Map();
  private cache: CachedData = {
    projects: [],
    pos: [],
    revenue: null,
    schedule: null,
    statuses: [],
  };
  private timestamps: DataTimestamps = {
    projects: 0,
    pos: 0,
    revenue: 0,
    schedule: 0,
    statuses: 0,
  };
  private errors: Map<DataKey, Error | null> = new Map();
  private running = false;
  private config: PollingConfig;

  constructor(config: PollingConfig) {
    super();
    this.config = config;
  }

  /**
   * Start polling all data sources
   */
  async start(): Promise<void> {
    if (this.running) {
      logger.warn('Polling manager already running');
      return;
    }

    this.running = true;
    logger.info('Starting polling manager');

    // Initial fetch of all data
    await this.fetchAllData();

    // Set up polling intervals
    this.schedulePolling('projects', this.config.projects, () =>
      fetchActiveProjects(15)
    );
    this.schedulePolling('pos', this.config.purchaseOrders, () =>
      fetchRecentPOs(10)
    );
    this.schedulePolling('revenue', this.config.revenue, () =>
      fetchRevenueData()
    );
    this.schedulePolling('schedule', this.config.schedule, () =>
      fetchScheduleData(14)
    );
    // Statuses don't change often, poll less frequently
    this.schedulePolling('statuses', this.config.revenue, () => fetchStatuses());

    logger.info('Polling manager started with intervals', {
      projects: this.config.projects,
      pos: this.config.purchaseOrders,
      revenue: this.config.revenue,
      schedule: this.config.schedule,
    });
  }

  /**
   * Stop all polling
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;

    // Clear all intervals
    this.intervals.forEach((interval, key) => {
      clearInterval(interval);
      logger.info({ key }, 'Stopped polling');
    });
    this.intervals.clear();

    logger.info('Polling manager stopped');
  }

  /**
   * Fetch all data once (for initial load or refresh)
   */
  async fetchAllData(): Promise<void> {
    logger.info('Fetching all data...');

    const fetches = [
      this.pollData('projects', () => fetchActiveProjects(15)),
      this.pollData('pos', () => fetchRecentPOs(10)),
      this.pollData('revenue', () => fetchRevenueData()),
      this.pollData('schedule', () => fetchScheduleData(14)),
      this.pollData('statuses', () => fetchStatuses()),
    ];

    await Promise.allSettled(fetches);
    logger.info('Initial data fetch complete');
  }

  /**
   * Get cached data by key
   */
  getData<K extends DataKey>(key: K): CachedData[K] {
    return this.cache[key];
  }

  /**
   * Get all cached data
   */
  getAllData(): CachedData {
    return { ...this.cache };
  }

  /**
   * Get timestamp for when data was last updated
   */
  getTimestamp(key: DataKey): number {
    return this.timestamps[key];
  }

  /**
   * Get all timestamps
   */
  getAllTimestamps(): DataTimestamps {
    return { ...this.timestamps };
  }

  /**
   * Check if any data is stale (older than threshold)
   */
  isDataStale(thresholdMs: number): boolean {
    const now = Date.now();
    return Object.values(this.timestamps).some(
      (timestamp) => timestamp > 0 && now - timestamp > thresholdMs
    );
  }

  /**
   * Get the oldest data timestamp
   */
  getOldestTimestamp(): number {
    const validTimestamps = Object.values(this.timestamps).filter((t) => t > 0);
    return validTimestamps.length > 0 ? Math.min(...validTimestamps) : 0;
  }

  /**
   * Get last error for a data key
   */
  getError(key: DataKey): Error | null {
    return this.errors.get(key) || null;
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    return Array.from(this.errors.values()).some((e) => e !== null);
  }

  /**
   * Update polling configuration
   */
  updateConfig(config: PollingConfig): void {
    this.config = config;

    if (this.running) {
      // Restart with new intervals
      this.stop();
      this.start();
    }
  }

  /**
   * Schedule periodic polling for a data source
   */
  private schedulePolling<T>(
    key: DataKey,
    intervalMs: number,
    fetcher: () => Promise<T>
  ): void {
    const interval = setInterval(async () => {
      if (!this.running) return;
      await this.pollData(key, fetcher);
    }, intervalMs);

    this.intervals.set(key, interval);
    logger.info({ key, intervalMs }, 'Scheduled polling');
  }

  /**
   * Poll data and update cache
   */
  private async pollData<T>(
    key: DataKey,
    fetcher: () => Promise<T>
  ): Promise<void> {
    try {
      const data = await fetcher();
      const timestamp = Date.now();

      // Update cache
      (this.cache as Record<DataKey, unknown>)[key] = data;
      this.timestamps[key] = timestamp;
      this.errors.set(key, null);

      // Emit update event
      const event: DataUpdateEvent = { key, data, timestamp };
      this.emit('data', event);
      this.emit(`data:${key}`, event);

      logger.debug({ key, timestamp }, 'Data updated');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.errors.set(key, err);

      // Emit error event
      const event: DataErrorEvent = { key, error: err, timestamp: Date.now() };
      this.emit('error', event);
      this.emit(`error:${key}`, event);

      logger.error({ key, error: err.message }, 'Failed to fetch data');
    }
  }
}

// Singleton instance
let pollingManager: PollingManager | null = null;

/**
 * Get or create the polling manager instance
 */
export function getPollingManager(config?: PollingConfig): PollingManager {
  if (!pollingManager && config) {
    pollingManager = new PollingManager(config);
  }
  if (!pollingManager) {
    throw new Error('Polling manager not initialized. Call with config first.');
  }
  return pollingManager;
}

/**
 * Destroy the polling manager instance
 */
export function destroyPollingManager(): void {
  if (pollingManager) {
    pollingManager.stop();
    pollingManager = null;
  }
}
