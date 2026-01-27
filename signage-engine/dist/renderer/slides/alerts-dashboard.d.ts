import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
export declare class AlertsDashboardSlide extends BaseSlide {
    render(ctx: SKRSContext2D, data: DataCache, deltaTime: number): void;
    private drawNoData;
    private drawAllClear;
    private drawOverdueSection;
    private drawOverdueItem;
    private drawStuckSection;
    private drawStuckItem;
    private formatNumber;
    private truncateText;
}
