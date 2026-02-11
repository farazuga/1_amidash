import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
/**
 * Performance Metrics Slide
 *
 * Displays 4 key performance indicators in a 2x2 grid:
 * - On-Time Completion % (top-left)
 * - DTI - Days to Invoice (top-right)
 * - Sales Health gauge (bottom-left)
 * - Ops Health gauge (bottom-right)
 *
 * Data source: dashboardMetrics.performance and dashboardMetrics.health
 */
export declare class PerformanceMetricsSlide extends BaseSlide {
    render(ctx: SKRSContext2D, data: DataCache, deltaTime: number): void;
    private drawNoData;
    private drawOnTimeCard;
    private drawDTICard;
    private drawSalesHealthCard;
    private drawOpsHealthCard;
    private drawCardBackground;
}
