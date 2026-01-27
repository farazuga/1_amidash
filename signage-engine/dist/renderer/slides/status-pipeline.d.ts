import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
export declare class StatusPipelineSlide extends BaseSlide {
    private flowOffset;
    render(ctx: SKRSContext2D, data: DataCache, deltaTime: number): void;
    private drawNoData;
    private drawSummary;
    private drawPipeline;
    private drawFlowLines;
    private drawStage;
    private formatNumber;
}
