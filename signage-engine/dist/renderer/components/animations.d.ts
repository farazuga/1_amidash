import { SKRSContext2D } from '@napi-rs/canvas';
export interface AnimationState {
    particles: Particle[];
    countingNumbers: Map<string, CountingNumber>;
    time: number;
    pulsePhase: number;
}
interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    alpha: number;
    color: string;
    life: number;
    maxLife: number;
}
interface CountingNumber {
    current: number;
    target: number;
    startTime: number;
    duration: number;
}
export declare function createAnimationState(): AnimationState;
export declare function updateAnimations(state: AnimationState, deltaTime: number, width: number, height: number): void;
export declare function drawParticles(ctx: SKRSContext2D, state: AnimationState): void;
export declare function drawAmbientGradient(ctx: SKRSContext2D, width: number, height: number, phase: number): void;
export declare function getAnimatedNumber(state: AnimationState, key: string, targetValue: number, duration?: number): number;
export declare function drawPulsingGlow(ctx: SKRSContext2D, x: number, y: number, width: number, height: number, phase: number, color?: string): void;
export declare function drawAnimatedProgressBar(ctx: SKRSContext2D, x: number, y: number, width: number, height: number, progress: number, phase: number, options?: {
    backgroundColor?: string;
    fillColor?: string;
    glowColor?: string;
    rounded?: boolean;
}): void;
export declare function formatLargeNumber(num: number): string;
export declare function formatCurrency(amount: number, animated?: boolean): string;
export {};
