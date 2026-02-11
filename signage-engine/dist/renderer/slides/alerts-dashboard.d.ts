import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
/**
 * Alerts Dashboard Slide
 *
 * Displays project alerts in a split layout:
 * - Left column (red): Overdue projects past their goal date
 * - Right column (amber): Stuck projects (in same status too long)
 *
 * Shows "All Clear" message when no alerts exist.
 *
 * Data source: dashboardMetrics.alerts
 */
export declare class AlertsDashboardSlide extends BaseSlide {
    render(ctx: SKRSContext2D, data: DataCache, deltaTime: number): void;
    private drawNoData;
    private drawAllClear;
    private drawOverdueSection;
    private drawOverdueItem;
    private drawStuckSection;
    private drawStuckItem;
}
