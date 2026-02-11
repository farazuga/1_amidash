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
    protected readonly CARD: {
        readonly borderRadius: 16;
        readonly borderRadiusSmall: 12;
        readonly borderRadiusBadge: 6;
        readonly padding: 24;
        readonly paddingLarge: 40;
        readonly shadowBlur: 20;
    };
    protected readonly HEADER: {
        readonly height: 180;
        readonly logoHeight: 80;
        readonly titleSize: 96;
        readonly timestampSize: 64;
    };
    protected readonly ANIMATION: {
        readonly transitionDuration: 500;
        readonly fadeInDelay: 100;
        readonly scrollSpeed: 2;
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
    /**
     * Check if data is stale and draw an indicator if needed.
     * Call this at the end of render() for slides that should show stale data warnings.
     * @param lastUpdated The timestamp when data was last fetched
     * @param thresholdMs How old data can be before it's considered stale (default 60s)
     */
    protected drawStaleDataWarning(ctx: SKRSContext2D, lastUpdated: Date | null, thresholdMs?: number): void;
    /**
     * Draw debug overlay with development information.
     * Shows safe area boundaries, data timestamps, and slide info.
     * Only visible when debug mode is enabled in config.
     */
    protected drawDebugOverlay(ctx: SKRSContext2D, data: DataCache, slideIndex: number, slideCount: number, fps?: number): void;
    /** Format number as currency with K/M suffix ($2K, $1.50M) */
    protected formatCurrency(value: number, decimalsForMillions?: number): string;
    /** Format number with K/M suffix (2K, 1.5M) */
    protected formatNumber(value: number, decimalsForMillions?: number): string;
    /** Truncate text with ellipsis if too long */
    protected truncateText(text: string, maxLength: number): string;
    /** Format value as percentage */
    protected formatPercent(value: number, decimals?: number): string;
    /** Format date as short readable string (Jan 15, 2024) */
    protected formatDate(date: Date | string): string;
    /** Format days remaining/overdue (5 days left, 3 days overdue) */
    protected formatDaysRemaining(days: number): string;
}
