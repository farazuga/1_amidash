import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
/**
 * Team Schedule Slide
 *
 * Displays team member assignments in a calendar grid format.
 * Shows upcoming days (configurable) with project assignments.
 * Currently uses mock data (project_assignments table not implemented).
 *
 * Data source: schedule (from fetchScheduleData)
 */
export declare class TeamScheduleSlide extends BaseSlide {
    render(ctx: SKRSContext2D, data: DataCache, _deltaTime: number): void;
}
