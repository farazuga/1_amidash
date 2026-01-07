import { SlideConfig, DisplayConfig, TransitionConfig } from '../config/schema.js';
import { DataCache } from '../data/polling-manager.js';
import { SignageSlide } from '../data/fetchers/slide-config.js';
import { CanvasManager } from './canvas-manager.js';
export declare class SlideManager {
    private slides;
    private currentSlideIndex;
    private slideStartTime;
    private transitionProgress;
    private isTransitioning;
    private displayConfig;
    private transitionConfig;
    private lastFrameTime;
    constructor(slideConfigs: SlideConfig[], displayConfig: DisplayConfig, transitionConfig: TransitionConfig);
    private createSlide;
    reloadFromDatabase(dbSlides: SignageSlide[]): Promise<void>;
    private mapSlideType;
    loadAssets(): Promise<void>;
    render(canvasManager: CanvasManager, data: DataCache): void;
    private startTransition;
    private renderTransition;
    private renderFadeTransition;
    private renderSlideTransition;
    private getSlideConfig;
    getCurrentSlideIndex(): number;
    getSlideCount(): number;
    reset(): void;
}
