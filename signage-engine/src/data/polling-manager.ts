import { logger } from '../utils/logger.js';
import { fetchActiveProjects, ActiveProject, fetchInvoicedProjects, InvoicedProject } from './fetchers/projects.js';
import { fetchPOs, HighlightPO } from './fetchers/pos.js';
import { fetchRevenueData, RevenueData } from './fetchers/revenue.js';
import { fetchBlocksConfig, BlocksConfig } from './fetchers/blocks-config.js';
import { isSupabaseConfigured } from './supabase-client.js';
import { PollingConfig } from '../config/schema.js';

export interface DataCache {
  projects: { data: ActiveProject[]; lastUpdated: Date | null };
  invoicedProjects: { data: InvoicedProject[]; lastUpdated: Date | null };
  pos: { data: HighlightPO[]; lastUpdated: Date | null };
  revenue: { data: RevenueData | null; lastUpdated: Date | null };
  blocksConfig: { data: BlocksConfig | null; lastUpdated: Date | null };
  connectionStatus: { isConnected: boolean; usingMockData: boolean; lastError: string | null };
}

export class PollingManager {
  private cache: DataCache = {
    projects: { data: [], lastUpdated: null },
    invoicedProjects: { data: [], lastUpdated: null },
    pos: { data: [], lastUpdated: null },
    revenue: { data: null, lastUpdated: null },
    blocksConfig: { data: null, lastUpdated: null },
    connectionStatus: { isConnected: false, usingMockData: true, lastError: null },
  };

  private intervals: NodeJS.Timeout[] = [];
  private config: PollingConfig;

  constructor(config: PollingConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    logger.info('Starting polling manager');

    // Check Supabase connection status
    const connected = isSupabaseConfigured();
    this.cache.connectionStatus = {
      isConnected: connected,
      usingMockData: !connected,
      lastError: connected ? null : 'Supabase not configured - displaying mock data',
    };

    if (!connected) {
      logger.warn('Supabase not configured - signage will display mock data');
    }

    // Initial fetch
    await this.fetchAll();

    // Set up intervals
    this.intervals.push(
      setInterval(() => this.fetchProjects(), this.config.projects),
      setInterval(() => this.fetchInvoicedProjects(), this.config.invoicedProjects),
      setInterval(() => this.fetchHighlightPOs(), this.config.purchaseOrders),
      setInterval(() => this.fetchRevenue(), this.config.revenue),
      setInterval(() => this.fetchBlocksConfig(), this.config.blocksConfig),
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
      this.fetchInvoicedProjects(),
      this.fetchHighlightPOs(),
      this.fetchRevenue(),
      this.fetchBlocksConfig(),
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

  private async fetchInvoicedProjects(): Promise<void> {
    try {
      const data = await fetchInvoicedProjects();
      this.cache.invoicedProjects = { data, lastUpdated: new Date() };
      logger.debug({ count: data.length }, 'Fetched invoiced projects');
    } catch (error) {
      logger.error({ error }, 'Failed to fetch invoiced projects');
    }
  }

  private async fetchHighlightPOs(): Promise<void> {
    try {
      const data = await fetchPOs();
      this.cache.pos = { data, lastUpdated: new Date() };
      logger.debug({ count: data.length }, 'Fetched highlight POs');
    } catch (error) {
      logger.error({ error }, 'Failed to fetch highlight POs');
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

  private async fetchBlocksConfig(): Promise<void> {
    try {
      const data = await fetchBlocksConfig();
      this.cache.blocksConfig = { data, lastUpdated: new Date() };
      logger.debug({ blockCount: data.blocks.length }, 'Fetched blocks config');
    } catch (error) {
      logger.error({ error }, 'Failed to fetch blocks config');
    }
  }

  getCache(): DataCache {
    return this.cache;
  }

  isDataStale(thresholdMs: number): boolean {
    const now = Date.now();
    const checks = [
      this.cache.projects.lastUpdated,
      this.cache.invoicedProjects.lastUpdated,
      this.cache.pos.lastUpdated,
      this.cache.revenue.lastUpdated,
      this.cache.blocksConfig.lastUpdated,
    ];

    return checks.some((date) => {
      if (!date) return true;
      return now - date.getTime() > thresholdMs;
    });
  }
}
