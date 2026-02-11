import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
/**
 * Active Projects Slide
 *
 * Displays a grid of active (non-completed, non-invoiced) projects.
 * Each project card shows client name, status, value, and due date.
 * Excludes projects with 'complete', 'cancelled', or 'invoiced' status.
 *
 * Data source: projects (from fetchActiveProjects)
 */
export declare class ActiveProjectsSlide extends BaseSlide {
    render(ctx: SKRSContext2D, data: DataCache, deltaTime: number): void;
    private drawNoData;
    private drawProjectCard;
}
