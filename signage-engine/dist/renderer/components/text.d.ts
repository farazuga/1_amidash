import { SKRSContext2D } from '@napi-rs/canvas';
type TextAlign = 'left' | 'right' | 'center' | 'start' | 'end';
type TextBaseline = 'top' | 'hanging' | 'middle' | 'alphabetic' | 'ideographic' | 'bottom';
export interface TextStyle {
    font?: string;
    size?: number;
    weight?: number | string;
    color?: string;
    align?: TextAlign;
    baseline?: TextBaseline;
    maxWidth?: number;
    letterSpacing?: number;
}
export declare function drawText(ctx: SKRSContext2D, text: string, x: number, y: number, style?: TextStyle): void;
export declare function drawTextWrapped(ctx: SKRSContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, style?: TextStyle): number;
export declare function measureText(ctx: SKRSContext2D, text: string, font: string, size: number): number;
export declare function truncateText(ctx: SKRSContext2D, text: string, maxWidth: number, font: string, size: number): string;
export {};
