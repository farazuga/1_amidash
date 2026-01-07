import { SKRSContext2D } from '@napi-rs/canvas';
export interface BarChartData {
    label: string;
    value: number;
    color?: string;
    secondaryValue?: number;
    secondaryColor?: string;
}
export declare function drawBarChart(ctx: SKRSContext2D, data: BarChartData[], x: number, y: number, width: number, height: number, options?: {
    barGap?: number;
    labelColor?: string;
    fontSize?: number;
    showLabels?: boolean;
    maxValue?: number;
}): void;
export declare function drawProgressBar(ctx: SKRSContext2D, value: number, max: number, x: number, y: number, width: number, height: number, options?: {
    backgroundColor?: string;
    fillColor?: string;
    borderRadius?: number;
}): void;
export declare function roundRect(ctx: SKRSContext2D, x: number, y: number, width: number, height: number, radius: number): void;
export declare function drawKPICard(ctx: SKRSContext2D, title: string, value: string, subtitle: string, x: number, y: number, width: number, height: number, options?: {
    backgroundColor?: string;
    titleColor?: string;
    valueColor?: string;
    subtitleColor?: string;
    borderRadius?: number;
}): void;
