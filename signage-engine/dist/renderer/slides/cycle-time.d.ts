import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
/**
 * Cycle Time Analysis Slide
 *
 * Displays average time projects spend in each workflow stage.
 * Shows horizontal bars for each status with average days.
 * Helps identify slow stages in the project workflow.
 *
 * Data source: dashboardMetrics.cycleTime
 */
export declare class CycleTimeSlide extends BaseSlide {
    render(ctx: SKRSContext2D, data: DataCache, deltaTime: number): void;
    private drawNoData;
    private drawTotalCycleTime;
    private drawCycleTimeChart;
}
