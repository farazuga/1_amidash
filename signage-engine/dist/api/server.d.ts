import { Express } from 'express';
import { SignageConfig, APIConfig } from '../config/schema.js';
import { CanvasManager } from '../renderer/canvas-manager.js';
import { SlideManager } from '../renderer/slide-manager.js';
import { PollingManager } from '../data/polling-manager.js';
import { NDIOutput } from '../ndi/output.js';
export interface EngineState {
    isRunning: boolean;
    startTime: Date | null;
    config: SignageConfig;
    canvasManager: CanvasManager | null;
    slideManager: SlideManager | null;
    pollingManager: PollingManager | null;
    ndiOutput: NDIOutput | null;
}
export type StartCallback = () => Promise<void>;
export type StopCallback = () => Promise<void>;
export declare function createAPIServer(config: APIConfig, getState: () => EngineState, onStart: StartCallback, onStop: StopCallback, updateConfig: (config: Partial<SignageConfig>) => SignageConfig): Express;
export declare function startServer(app: Express, config: APIConfig): void;
