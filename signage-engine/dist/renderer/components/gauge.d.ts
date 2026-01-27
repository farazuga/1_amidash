import { SKRSContext2D } from '@napi-rs/canvas';
export interface GaugeOptions {
    title?: string;
    subtitle?: string;
    valueLabel?: string;
    minValue?: number;
    maxValue?: number;
    thresholds?: {
        low: number;
        medium: number;
    };
    showNeedle?: boolean;
    animated?: boolean;
    animationProgress?: number;
}
/**
 * Draw a semi-circular speedometer gauge
 */
export declare function drawGauge(ctx: SKRSContext2D, value: number, centerX: number, centerY: number, radius: number, options?: GaugeOptions): void;
/**
 * Get the appropriate color based on value and thresholds
 */
export declare function getGaugeColor(percentage: number, thresholds: {
    low: number;
    medium: number;
}): string;
/**
 * Draw a mini gauge (compact version for smaller spaces)
 */
export declare function drawMiniGauge(ctx: SKRSContext2D, value: number, centerX: number, centerY: number, radius: number, label: string, thresholds?: {
    low: number;
    medium: number;
}): void;
/**
 * Draw a horizontal gauge bar (alternative style)
 */
export declare function drawHorizontalGauge(ctx: SKRSContext2D, value: number, x: number, y: number, width: number, height: number, options?: {
    label?: string;
    showValue?: boolean;
    thresholds?: {
        low: number;
        medium: number;
    };
}): void;
