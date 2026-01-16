/**
 * Test data builders for creating consistent test fixtures
 */
import { ActiveProject } from '../../data/fetchers/projects';
import { RecentPO } from '../../data/fetchers/pos';
import { RevenueData } from '../../data/fetchers/revenue';
import { ScheduleEntry } from '../../data/fetchers/schedule';
import { ProjectMetrics } from '../../data/fetchers/metrics';
import { SignageSlide } from '../../data/fetchers/slide-config';
export declare function buildActiveProject(overrides?: Partial<ActiveProject>): ActiveProject;
export declare function buildActiveProjects(count?: number): ActiveProject[];
export declare function buildRecentPO(overrides?: Partial<RecentPO>): RecentPO;
export declare function buildRecentPOs(count?: number): RecentPO[];
export declare function buildRevenueData(overrides?: Partial<RevenueData>): RevenueData;
export declare function buildScheduleEntry(overrides?: Partial<ScheduleEntry>): ScheduleEntry;
export declare function buildScheduleEntries(count?: number): ScheduleEntry[];
export declare function buildProjectMetrics(overrides?: Partial<ProjectMetrics>): ProjectMetrics;
export declare function buildSignageSlide(overrides?: Partial<SignageSlide>): SignageSlide;
export declare function buildSignageSlides(count?: number): SignageSlide[];
export declare function buildSupabaseResponse<T>(data: T | null, error?: Error | null): {
    data: T | null;
    error: Error | null;
};
export declare function buildSupabaseError(message: string, code?: string): {
    data: null;
    error: {
        message: string;
        code: string;
        details: null;
        hint: null;
    };
};
