import { SKRSContext2D } from '@napi-rs/canvas';
import { colors, hexToRgba } from './colors.js';

// Animation state management
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

// Create initial animation state
export function createAnimationState(): AnimationState {
  return {
    particles: [],
    countingNumbers: new Map(),
    time: 0,
    pulsePhase: 0,
  };
}

// Update animation state each frame
export function updateAnimations(state: AnimationState, deltaTime: number, width: number, height: number): void {
  state.time += deltaTime;
  state.pulsePhase = (state.pulsePhase + deltaTime * 0.002) % (Math.PI * 2);

  // Update particles
  state.particles = state.particles.filter(p => {
    p.x += p.vx * deltaTime * 0.001;
    p.y += p.vy * deltaTime * 0.001;
    p.life -= deltaTime;
    p.alpha = Math.max(0, (p.life / p.maxLife) * 0.6);
    return p.life > 0;
  });

  // Spawn new particles occasionally
  if (state.particles.length < 50 && Math.random() < 0.1) {
    state.particles.push(createParticle(width, height));
  }
}

function createParticle(width: number, height: number): Particle {
  const edge = Math.floor(Math.random() * 4);
  let x: number, y: number, vx: number, vy: number;

  switch (edge) {
    case 0: // Top
      x = Math.random() * width;
      y = -10;
      vx = (Math.random() - 0.5) * 20;
      vy = Math.random() * 30 + 10;
      break;
    case 1: // Right
      x = width + 10;
      y = Math.random() * height;
      vx = -(Math.random() * 30 + 10);
      vy = (Math.random() - 0.5) * 20;
      break;
    case 2: // Bottom
      x = Math.random() * width;
      y = height + 10;
      vx = (Math.random() - 0.5) * 20;
      vy = -(Math.random() * 30 + 10);
      break;
    default: // Left
      x = -10;
      y = Math.random() * height;
      vx = Math.random() * 30 + 10;
      vy = (Math.random() - 0.5) * 20;
  }

  // Use brand palette colors for particles
  const brandColors = [
    colors.primary,       // Main Dark Green
    colors.primaryLight,  // Main Light Green
    colors.mauve,         // Mauve accent
    colors.coral,         // Coral accent
    colors.amber,         // Amber accent
  ];
  const randomColor = brandColors[Math.floor(Math.random() * brandColors.length)];

  return {
    x, y, vx, vy,
    size: Math.random() * 4 + 2,
    alpha: 0.5,
    color: randomColor,
    life: Math.random() * 15000 + 10000,
    maxLife: 20000,
  };
}

// Draw ambient particle effects
export function drawParticles(ctx: SKRSContext2D, state: AnimationState): void {
  state.particles.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(p.color, p.alpha);
    ctx.fill();
  });
}

// Draw subtle gradient overlay for depth
export function drawAmbientGradient(
  ctx: SKRSContext2D,
  width: number,
  height: number,
  phase: number
): void {
  // Radial glow from corners
  const glowIntensity = 0.03 + Math.sin(phase) * 0.01;

  // Top-left teal glow
  const gradient1 = ctx.createRadialGradient(0, 0, 0, 0, 0, width * 0.6);
  gradient1.addColorStop(0, hexToRgba(colors.primary, glowIntensity * 1.5));
  gradient1.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient1;
  ctx.fillRect(0, 0, width, height);

  // Bottom-right accent glow
  const gradient2 = ctx.createRadialGradient(width, height, 0, width, height, width * 0.5);
  gradient2.addColorStop(0, hexToRgba(colors.accent, glowIntensity));
  gradient2.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient2;
  ctx.fillRect(0, 0, width, height);
}

// Get animated counting number value
export function getAnimatedNumber(
  state: AnimationState,
  key: string,
  targetValue: number,
  duration: number = 1500
): number {
  const existing = state.countingNumbers.get(key);

  if (!existing || existing.target !== targetValue) {
    state.countingNumbers.set(key, {
      current: existing?.current ?? 0,
      target: targetValue,
      startTime: state.time,
      duration,
    });
  }

  const counter = state.countingNumbers.get(key)!;
  const elapsed = state.time - counter.startTime;
  const progress = Math.min(1, elapsed / counter.duration);

  // Ease-out cubic
  const eased = 1 - Math.pow(1 - progress, 3);

  return Math.round(counter.current + (counter.target - counter.current) * eased);
}

// Draw pulsing glow behind an element
export function drawPulsingGlow(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  phase: number,
  color: string = colors.primary
): void {
  const pulseIntensity = 0.15 + Math.sin(phase * 2) * 0.05;
  const blurSize = 40 + Math.sin(phase * 2) * 10;

  const gradient = ctx.createRadialGradient(
    x + width / 2, y + height / 2, 0,
    x + width / 2, y + height / 2, Math.max(width, height) * 0.8
  );
  gradient.addColorStop(0, hexToRgba(color, pulseIntensity));
  gradient.addColorStop(0.5, hexToRgba(color, pulseIntensity * 0.5));
  gradient.addColorStop(1, 'transparent');

  ctx.fillStyle = gradient;
  ctx.fillRect(x - blurSize, y - blurSize, width + blurSize * 2, height + blurSize * 2);
}

// Draw animated progress bar that fills up
export function drawAnimatedProgressBar(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  progress: number,
  phase: number,
  options: {
    backgroundColor?: string;
    fillColor?: string;
    glowColor?: string;
    rounded?: boolean;
  } = {}
): void {
  const {
    backgroundColor = 'rgba(255, 255, 255, 0.1)',
    fillColor = colors.primary,
    glowColor = colors.primaryGlow,
    rounded = true,
  } = options;

  const radius = rounded ? height / 2 : 0;

  // Background track
  ctx.beginPath();
  if (rounded) {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.rect(x, y, width, height);
  }
  ctx.fillStyle = backgroundColor;
  ctx.fill();

  // Filled portion with shimmer
  const fillWidth = width * Math.min(1, progress);
  if (fillWidth > 0) {
    // Glow effect
    const glowGradient = ctx.createLinearGradient(x, y, x + fillWidth, y);
    glowGradient.addColorStop(0, hexToRgba(glowColor, 0.3));
    glowGradient.addColorStop(0.5, hexToRgba(glowColor, 0.1));
    glowGradient.addColorStop(1, hexToRgba(glowColor, 0.3));

    ctx.beginPath();
    if (rounded) {
      ctx.roundRect(x - 5, y - 5, fillWidth + 10, height + 10, radius + 5);
    } else {
      ctx.rect(x - 5, y - 5, fillWidth + 10, height + 10);
    }
    ctx.fillStyle = glowGradient;
    ctx.fill();

    // Main fill with animated shimmer
    const shimmerOffset = (phase * 100) % (width * 2);
    const fillGradient = ctx.createLinearGradient(x, y, x + fillWidth, y);
    fillGradient.addColorStop(0, fillColor);
    fillGradient.addColorStop(Math.max(0, (shimmerOffset - 50) / width), fillColor);
    fillGradient.addColorStop(Math.min(1, shimmerOffset / width), hexToRgba('#ffffff', 0.3));
    fillGradient.addColorStop(Math.min(1, (shimmerOffset + 50) / width), fillColor);
    fillGradient.addColorStop(1, fillColor);

    ctx.beginPath();
    if (rounded) {
      ctx.roundRect(x, y, fillWidth, height, radius);
    } else {
      ctx.rect(x, y, fillWidth, height);
    }
    ctx.fillStyle = fillGradient;
    ctx.fill();
  }
}

// Format large numbers with K/M suffixes
export function formatLargeNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

// Format currency
export function formatCurrency(amount: number, animated: boolean = false): string {
  if (animated) {
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
}
