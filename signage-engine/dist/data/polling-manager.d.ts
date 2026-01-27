import { ActiveProject } from './fetchers/projects.js';
import { RecentPO } from './fetchers/pos.js';
import { RevenueData } from './fetchers/revenue.js';
import { ScheduleEntry } from './fetchers/schedule.js';
import { ProjectMetrics } from './fetchers/metrics.js';
import { SignageSlide } from './fetchers/slide-config.js';
import { DashboardMetrics } from './fetchers/dashboard-metrics.js';
import { PollingConfig } from '../config/schema.js';
export interface DataCache {
    projects: {
        data: ActiveProject[];
        lastUpdated: Date | null;
    };
    pos: {
        data: RecentPO[];
        lastUpdated: Date | null;
    };
    revenue: {
        data: RevenueData | null;
        lastUpdated: Date | null;
    };
    schedule: {
        data: ScheduleEntry[];
        lastUpdated: Date | null;
    };
    metrics: {
        data: ProjectMetrics | null;
        lastUpdated: Date | null;
    };
    slideConfig: {
        data: SignageSlide[];
        lastUpdated: Date | null;
    };
    dashboardMetrics: {
        data: DashboardMetrics | null;
        lastUpdated: Date | null;
    };
    connectionStatus: {
        isConnected: boolean;
        usingMockData: boolean;
        lastError: string | null;
    };
}
export declare class PollingManager {
    private cache;
    private intervals;
    private config;
    constructor(config: PollingConfig);
    start(): Promise<void>;
    stop(): void;
    private fetchAll;
    private fetchProjects;
    private fetchPOs;
    private fetchRevenue;
    private fetchSchedule;
    private fetchMetrics;
    private fetchSlideConfig;
    private fetchDashboardMetrics;
    getCache(): DataCache;
    isDataStale(thresholdMs: number): boolean;
}
