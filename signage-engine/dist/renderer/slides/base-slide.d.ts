import { SKRSContext2D, Image } from '@napi-rs/canvas';
import { DisplayConfig, SlideConfig } from '../../config/schema.js';
import { DataCache } from '../../data/polling-manager.js';
import { AnimationState } from '../components/animations.js';
export declare abstract class BaseSlide {
    protected config: SlideConfig;
    protected displayConfig: DisplayConfig;
    protected logo: Image | null;
    protected animationState: AnimationState;
    protected readonly FONT_SIZE: {
        HERO: number;
        LARGE: number;
        HEADER: number;
        BODY: number;
        LABEL: number;
        MINIMUM: number;
    };
    protected readonly SAFE_AREA: {
        readonly top: 180;
        readonly bottom: 240;
        readonly left: 140;
        readonly right: 140;
    };
    protected readonly SPACING: {
        readonly xs: 20;
        readonly sm: 40;
        readonly md: 60;
        readonly lg: 80;
        readonly xl: 120;
    };
    constructor(config: SlideConfig, displayConfig: DisplayConfig);
    loadLogo(): Promise<void>;
    abstract render(ctx: SKRSContext2D, data: DataCache, deltaTime: number): void;
    protected updateAnimationState(deltaTime: number): void;
    protected drawAmbientEffects(_ctx: SKRSContext2D): void;
    protected readonly SCREEN_MARGIN = 140;
    protected drawMinimalHeader(ctx: SKRSContext2D, title: string): number;
    protected drawHeader(ctx: SKRSContext2D, title: string): number;
    protected drawStaleIndicator(ctx: SKRSContext2D, isStale: boolean, position: string): void;
    /**
     * Get the safe content bounds per DESIGN.md "Layout & Grid: Screen Zones"
     * Returns the area where content should be rendered to avoid clipping
     */
    protected getContentBounds(): {
        x: number;
        y: number;
        width: number;
        height: number;
        centerX: number;
        centerY: number;
    };
    /**
     * Check if a rectangle would be clipped by safe area bounds
     * Use this to validate element positioning during development
     */
    protected isWithinSafeArea(elementX: number, elementY: number, elementWidth: number, elementHeight: number): boolean;
    protected drawConnectionStatus(ctx: SKRSContext2D, data: DataCache): void;
}
