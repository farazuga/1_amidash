import { NDIConfig, DisplayConfig } from '../config/schema.js';
export interface NDISender {
    sendFrame(frame: {
        data: Buffer;
        width: number;
        height: number;
        frameRateN: number;
        frameRateD: number;
    }): void;
    destroy(): void;
}
export declare class NDIOutput {
    private sender;
    private config;
    private displayConfig;
    private frameCount;
    private startTime;
    constructor(config: NDIConfig, displayConfig: DisplayConfig);
    initialize(): Promise<void>;
    sendFrame(frameData: Buffer): void;
    getFPS(): number;
    getFrameCount(): number;
    destroy(): void;
}
