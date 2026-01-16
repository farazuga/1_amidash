import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
export declare class RecentWinsSlide extends BaseSlide {
    render(ctx: SKRSContext2D, data: DataCache, deltaTime: number): void;
    private drawEmptyState;
    private drawWinsDashboard;
    private drawSummarySection;
    private drawWinsGrid;
    private drawWinCard;
}
