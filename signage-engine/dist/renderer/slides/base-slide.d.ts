import { SKRSContext2D, Image } from '@napi-rs/canvas';
import { DisplayConfig, SlideConfig } from '../../config/schema.js';
import { DataCache } from '../../data/polling-manager.js';
import { AnimationState } from '../components/animations.js';
export declare abstract class BaseSlide {
    protected config: SlideConfig;
    protected displayConfig: DisplayConfig;
    protected logo: Image | null;
    protected animationState: AnimationState;
    constructor(config: SlideConfig, displayConfig: DisplayConfig);
    loadLogo(): Promise<void>;
    abstract render(ctx: SKRSContext2D, data: DataCache, deltaTime: number): void;
    protected updateAnimationState(deltaTime: number): void;
    protected drawAmbientEffects(ctx: SKRSContext2D): void;
    protected drawMinimalHeader(ctx: SKRSContext2D, title: string): number;
    protected drawHeader(ctx: SKRSContext2D, title: string): number;
    protected drawStaleIndicator(ctx: SKRSContext2D, isStale: boolean, position: string): void;
}
