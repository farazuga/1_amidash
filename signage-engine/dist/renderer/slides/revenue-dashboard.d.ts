import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
/**
 * Revenue Dashboard Slide
 *
 * Displays revenue metrics with:
 * - 4 KPI cards: This Month, Month Progress, Year to Date, YTD Progress
 * - Progress bars for monthly and YTD goals
 * - Monthly bar chart comparing revenue vs goals
 *
 * Data source: revenue (from fetchRevenueData)
 */
export declare class RevenueDashboardSlide extends BaseSlide {
    render(ctx: SKRSContext2D, data: DataCache, _deltaTime: number): void;
}
