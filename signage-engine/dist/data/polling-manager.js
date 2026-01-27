import { logger } from '../utils/logger.js';
import { fetchActiveProjects } from './fetchers/projects.js';
import { fetchRecentPOs } from './fetchers/pos.js';
import { fetchRevenueData } from './fetchers/revenue.js';
import { fetchScheduleData } from './fetchers/schedule.js';
import { fetchProjectMetrics } from './fetchers/metrics.js';
import { fetchSlideConfig } from './fetchers/slide-config.js';
import { fetchDashboardMetrics } from './fetchers/dashboard-metrics.js';
import { isSupabaseConfigured } from './supabase-client.js';
export class PollingManager {
    cache = {
        projects: { data: [], lastUpdated: null },
        pos: { data: [], lastUpdated: null },
        revenue: { data: null, lastUpdated: null },
        schedule: { data: [], lastUpdated: null },
        metrics: { data: null, lastUpdated: null },
        slideConfig: { data: [], lastUpdated: null },
        dashboardMetrics: { data: null, lastUpdated: null },
        connectionStatus: { isConnected: false, usingMockData: true, lastError: null },
    };
    intervals = [];
    config;
    constructor(config) {
        this.config = config;
    }
    async start() {
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
        this.intervals.push(setInterval(() => this.fetchProjects(), this.config.projects), setInterval(() => this.fetchPOs(), this.config.purchaseOrders), setInterval(() => this.fetchRevenue(), this.config.revenue), setInterval(() => this.fetchSchedule(), this.config.schedule), setInterval(() => this.fetchMetrics(), this.config.projects), // Same as projects
        setInterval(() => this.fetchSlideConfig(), 60000), // Every 60 seconds
        setInterval(() => this.fetchDashboardMetrics(), 30000) // Every 30 seconds for dashboard metrics
        );
        logger.info({ config: this.config }, 'Polling intervals configured');
    }
    stop() {
        this.intervals.forEach(clearInterval);
        this.intervals = [];
        logger.info('Polling manager stopped');
    }
    async fetchAll() {
        await Promise.all([
            this.fetchProjects(),
            this.fetchPOs(),
            this.fetchRevenue(),
            this.fetchSchedule(),
            this.fetchMetrics(),
            this.fetchSlideConfig(),
            this.fetchDashboardMetrics(),
        ]);
    }
    async fetchProjects() {
        try {
            const data = await fetchActiveProjects();
            this.cache.projects = { data, lastUpdated: new Date() };
            logger.debug({ count: data.length }, 'Fetched projects');
        }
        catch (error) {
            logger.error({ error }, 'Failed to fetch projects');
        }
    }
    async fetchPOs() {
        try {
            const data = await fetchRecentPOs();
            this.cache.pos = { data, lastUpdated: new Date() };
            logger.debug({ count: data.length }, 'Fetched POs');
        }
        catch (error) {
            logger.error({ error }, 'Failed to fetch POs');
        }
    }
    async fetchRevenue() {
        try {
            const data = await fetchRevenueData();
            this.cache.revenue = { data, lastUpdated: new Date() };
            logger.debug('Fetched revenue data');
        }
        catch (error) {
            logger.error({ error }, 'Failed to fetch revenue');
        }
    }
    async fetchSchedule() {
        try {
            const data = await fetchScheduleData();
            this.cache.schedule = { data, lastUpdated: new Date() };
            logger.debug({ count: data.length }, 'Fetched schedule');
        }
        catch (error) {
            logger.error({ error }, 'Failed to fetch schedule');
        }
    }
    async fetchMetrics() {
        try {
            const data = await fetchProjectMetrics();
            this.cache.metrics = { data, lastUpdated: new Date() };
            logger.debug({ total: data.total }, 'Fetched metrics');
        }
        catch (error) {
            logger.error({ error }, 'Failed to fetch metrics');
        }
    }
    async fetchSlideConfig() {
        try {
            const data = await fetchSlideConfig();
            this.cache.slideConfig = { data, lastUpdated: new Date() };
            logger.debug({ count: data.length }, 'Fetched slide config');
        }
        catch (error) {
            logger.error({ error }, 'Failed to fetch slide config');
        }
    }
    async fetchDashboardMetrics() {
        try {
            const data = await fetchDashboardMetrics();
            this.cache.dashboardMetrics = { data, lastUpdated: new Date() };
            logger.debug('Fetched dashboard metrics');
        }
        catch (error) {
            logger.error({ error }, 'Failed to fetch dashboard metrics');
        }
    }
    getCache() {
        return this.cache;
    }
    isDataStale(thresholdMs) {
        const now = Date.now();
        const checks = [
            this.cache.projects.lastUpdated,
            this.cache.pos.lastUpdated,
            this.cache.revenue.lastUpdated,
            this.cache.schedule.lastUpdated,
            this.cache.metrics.lastUpdated,
            this.cache.dashboardMetrics.lastUpdated,
        ];
        return checks.some((date) => {
            if (!date)
                return true;
            return now - date.getTime() > thresholdMs;
        });
    }
}
//# sourceMappingURL=polling-manager.js.map