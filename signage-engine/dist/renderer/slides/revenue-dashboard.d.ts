import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
export declare class RevenueDashboardSlide extends BaseSlide {
    render(ctx: SKRSContext2D, data: DataCache, _deltaTime: number): void;
}
