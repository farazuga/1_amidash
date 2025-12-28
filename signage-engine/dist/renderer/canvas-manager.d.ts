import { Canvas, SKRSContext2D } from '@napi-rs/canvas';
import { DisplayConfig } from '../config/schema.js';
export declare class CanvasManager {
    private frontBuffer;
    private backBuffer;
    private frontCtx;
    private backCtx;
    private config;
    constructor(config: DisplayConfig);
    getBackContext(): SKRSContext2D;
    getFrontBuffer(): Canvas;
    getConfig(): DisplayConfig;
    clear(): void;
    swap(): void;
    getFrameData(): Buffer;
    getPreviewPng(): Promise<Buffer>;
}
