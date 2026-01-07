import { SKRSContext2D, loadImage, Image } from '@napi-rs/canvas';
import { DisplayConfig, SlideConfig } from '../../config/schema.js';
import { DataCache } from '../../data/polling-manager.js';
import { drawText } from '../components/text.js';
import { colors, hexToRgba } from '../components/colors.js';
import {
  AnimationState,
  createAnimationState,
  updateAnimations,
  drawParticles,
  drawAmbientGradient,
} from '../components/animations.js';

export abstract class BaseSlide {
  protected config: SlideConfig;
  protected displayConfig: DisplayConfig;
  protected logo: Image | null = null;
  protected animationState: AnimationState;

  constructor(config: SlideConfig, displayConfig: DisplayConfig) {
    this.config = config;
    this.displayConfig = displayConfig;
    this.animationState = createAnimationState();
  }

  async loadLogo(): Promise<void> {
    if (this.displayConfig.logoPath) {
      try {
        this.logo = await loadImage(this.displayConfig.logoPath);
      } catch {
        // Logo loading failed, continue without it
      }
    }
  }

  abstract render(ctx: SKRSContext2D, data: DataCache, deltaTime: number): void;

  // Update animations - call at start of render
  protected updateAnimationState(deltaTime: number): void {
    updateAnimations(this.animationState, deltaTime, this.displayConfig.width, this.displayConfig.height);
  }

  // Draw ambient background effects
  protected drawAmbientEffects(ctx: SKRSContext2D): void {
    drawAmbientGradient(ctx, this.displayConfig.width, this.displayConfig.height, this.animationState.pulsePhase);
    drawParticles(ctx, this.animationState);
  }

  // New minimal header for full-screen slides
  protected drawMinimalHeader(ctx: SKRSContext2D, title: string): number {
    const headerHeight = 120;
    const padding = 80;

    // Subtle gradient header background
    const gradient = ctx.createLinearGradient(0, 0, 0, headerHeight);
    gradient.addColorStop(0, hexToRgba(colors.primary, 0.3));
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.displayConfig.width, headerHeight);

    // Logo with glow
    if (this.logo) {
      const logoHeight = 50;
      const logoWidth = (this.logo.width / this.logo.height) * logoHeight;
      ctx.drawImage(this.logo, padding, (headerHeight - logoHeight) / 2, logoWidth, logoHeight);
    }

    // Bold title
    drawText(ctx, title.toUpperCase(), this.displayConfig.width / 2, headerHeight / 2, {
      font: this.displayConfig.fontFamily,
      size: 72,
      weight: 700,
      color: colors.white,
      align: 'center',
      baseline: 'middle',
      letterSpacing: 8,
    });

    // Timestamp with accent color
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    drawText(ctx, now, this.displayConfig.width - padding, headerHeight / 2, {
      font: this.displayConfig.fontFamily,
      size: 48,
      color: colors.primaryLight,
      align: 'right',
      baseline: 'middle',
    });

    // Accent line under header
    ctx.beginPath();
    ctx.moveTo(padding, headerHeight - 2);
    ctx.lineTo(this.displayConfig.width - padding, headerHeight - 2);
    ctx.strokeStyle = hexToRgba(colors.primary, 0.5);
    ctx.lineWidth = 2;
    ctx.stroke();

    return headerHeight;
  }

  // Legacy header for compatibility
  protected drawHeader(ctx: SKRSContext2D, title: string): number {
    return this.drawMinimalHeader(ctx, title);
  }

  protected drawStaleIndicator(
    ctx: SKRSContext2D,
    isStale: boolean,
    position: string
  ): void {
    if (!isStale) return;

    const padding = 20;
    const boxWidth = 200;
    const boxHeight = 40;

    let x: number, y: number;

    switch (position) {
      case 'top-left':
        x = padding;
        y = 130;
        break;
      case 'top-right':
        x = this.displayConfig.width - boxWidth - padding;
        y = 130;
        break;
      case 'bottom-left':
        x = padding;
        y = this.displayConfig.height - boxHeight - padding;
        break;
      case 'bottom-right':
      default:
        x = this.displayConfig.width - boxWidth - padding;
        y = this.displayConfig.height - boxHeight - padding;
    }

    ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
    ctx.fillRect(x, y, boxWidth, boxHeight);

    drawText(ctx, '⚠ Data may be stale', x + boxWidth / 2, y + boxHeight / 2, {
      font: this.displayConfig.fontFamily,
      size: 18,
      color: colors.black,
      align: 'center',
      baseline: 'middle',
    });
  }

  protected drawConnectionStatus(ctx: SKRSContext2D, data: DataCache): void {
    const { connectionStatus } = data;
    if (connectionStatus.isConnected && !connectionStatus.usingMockData) return;

    const padding = 40;
    const boxWidth = 480;
    const boxHeight = 60;
    const x = (this.displayConfig.width - boxWidth) / 2;
    const y = this.displayConfig.height - boxHeight - padding;

    // Semi-transparent red background with rounded corners
    ctx.beginPath();
    const radius = 12;
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + boxWidth - radius, y);
    ctx.quadraticCurveTo(x + boxWidth, y, x + boxWidth, y + radius);
    ctx.lineTo(x + boxWidth, y + boxHeight - radius);
    ctx.quadraticCurveTo(x + boxWidth, y + boxHeight, x + boxWidth - radius, y + boxHeight);
    ctx.lineTo(x + radius, y + boxHeight);
    ctx.quadraticCurveTo(x, y + boxHeight, x, y + boxHeight - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
    ctx.fill();

    // White border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Warning icon
    drawText(ctx, '⚠', x + 30, y + boxHeight / 2, {
      font: this.displayConfig.fontFamily,
      size: 32,
      color: colors.white,
      align: 'center',
      baseline: 'middle',
    });

    // Error message
    const message = connectionStatus.usingMockData
      ? 'NOT CONNECTED TO DATABASE - SHOWING DEMO DATA'
      : 'DATABASE CONNECTION ERROR';

    drawText(ctx, message, x + boxWidth / 2 + 15, y + boxHeight / 2, {
      font: this.displayConfig.fontFamily,
      size: 24,
      weight: 600,
      color: colors.white,
      align: 'center',
      baseline: 'middle',
      letterSpacing: 1,
    });
  }
}
