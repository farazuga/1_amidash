import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
/**
 * Status Pipeline Slide
 *
 * Displays project workflow stages as a horizontal pipeline.
 * Each stage shows the count and total revenue of projects in that status.
 * Includes animated flow effect and bottleneck indicators.
 *
 * Data source: dashboardMetrics.pipeline
 */
export declare class StatusPipelineSlide extends BaseSlide {
    private flowOffset;
    render(ctx: SKRSContext2D, data: DataCache, deltaTime: number): void;
    private drawNoData;
    private drawSummary;
    private drawPipeline;
    private drawFlowLines;
    private drawStage;
}
