import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
/**
 * PO Ticker Slide (Recent Purchase Orders)
 *
 * Displays recent purchase orders in two sections:
 * - Top 3 largest POs from last 10 days (with gold/silver/bronze badges)
 * - Recent POs list from last 7 days
 *
 * Data source: pos (from fetchRecentPOs)
 */
export declare class POTickerSlide extends BaseSlide {
    render(ctx: SKRSContext2D, data: DataCache, _deltaTime: number): void;
    private drawLargePOCard;
    private drawSmallPOCard;
}
