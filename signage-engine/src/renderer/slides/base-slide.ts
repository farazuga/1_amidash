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

  // Font size constants for 4K TV readability (viewed from 10-20 feet)
  // Reference: DESIGN.md "Typography: Font Sizes for 4K"
  protected readonly FONT_SIZE = {
    HERO: 120,      // Giant KPI numbers
    LARGE: 72,      // Primary values
    HEADER: 56,     // Section headers
    BODY: 48,       // Card text, names
    LABEL: 40,      // Secondary labels
    MINIMUM: 36,    // Absolute minimum - NOTHING smaller
  };

  // Safe area constants per DESIGN.md "Layout & Grid: Screen Zones"
  // Ensures content never clips at edges and leaves room for footer banners
  protected readonly SAFE_AREA = {
    top: 180,      // Header zone height
    bottom: 240,   // Footer zone height (for banners, legends)
    left: 140,     // Side margin
    right: 140,    // Side margin
  } as const;

  // Spacing scale per DESIGN.md "Layout & Grid: Spacing Scale"
  protected readonly SPACING = {
    xs: 20,   // Tight internal padding
    sm: 40,   // Standard gaps between elements
    md: 60,   // Section separation
    lg: 80,   // Major section breaks
    xl: 120,  // Header/footer separation
  } as const;

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

  // Draw ambient background effects - DISABLED for cleaner look and better performance
  protected drawAmbientEffects(_ctx: SKRSContext2D): void {
    // Animations disabled for readability and performance
    // Previously: drawAmbientGradient + drawParticles
  }

  // Screen margin constant - use this for consistent spacing
  protected readonly SCREEN_MARGIN = 140;

  // New minimal header for full-screen slides
  protected drawMinimalHeader(ctx: SKRSContext2D, title: string): number {
    const headerHeight = 180;
    const padding = this.SCREEN_MARGIN;

    // Subtle gradient header background
    const gradient = ctx.createLinearGradient(0, 0, 0, headerHeight);
    gradient.addColorStop(0, hexToRgba(colors.primary, 0.3));
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.displayConfig.width, headerHeight);

    // Logo - larger for better visibility
    if (this.logo) {
      const logoHeight = 80;
      const logoWidth = (this.logo.width / this.logo.height) * logoHeight;
      ctx.drawImage(this.logo, padding, (headerHeight - logoHeight) / 2, logoWidth, logoHeight);
    }

    // Bold title - larger for readability from distance
    drawText(ctx, title.toUpperCase(), this.displayConfig.width / 2, headerHeight / 2, {
      font: this.displayConfig.fontFamily,
      size: 96,
      weight: 700,
      color: colors.white,
      align: 'center',
      baseline: 'middle',
    });

    // Timestamp with accent color - larger
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    drawText(ctx, now, this.displayConfig.width - padding, headerHeight / 2, {
      font: this.displayConfig.fontFamily,
      size: 64,
      weight: 600,
      color: colors.primaryLight,
      align: 'right',
      baseline: 'middle',
    });

    // Accent line under header
    ctx.beginPath();
    ctx.moveTo(padding, headerHeight - 2);
    ctx.lineTo(this.displayConfig.width - padding, headerHeight - 2);
    ctx.strokeStyle = hexToRgba(colors.primaryLight, 0.4);
    ctx.lineWidth = 3;
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
    const boxWidth = 480;
    const boxHeight = 80;

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
      size: this.FONT_SIZE.BODY,
      color: colors.black,
      align: 'center',
      baseline: 'middle',
    });
  }

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
  } {
    const x = this.SAFE_AREA.left;
    const y = this.SAFE_AREA.top;
    const width = this.displayConfig.width - this.SAFE_AREA.left - this.SAFE_AREA.right;
    const height = this.displayConfig.height - this.SAFE_AREA.top - this.SAFE_AREA.bottom;

    return {
      x,
      y,
      width,
      height,
      centerX: x + width / 2,
      centerY: y + height / 2,
    };
  }

  /**
   * Check if a rectangle would be clipped by safe area bounds
   * Use this to validate element positioning during development
   */
  protected isWithinSafeArea(
    elementX: number,
    elementY: number,
    elementWidth: number,
    elementHeight: number
  ): boolean {
    const bounds = this.getContentBounds();
    return (
      elementX >= bounds.x &&
      elementY >= bounds.y &&
      elementX + elementWidth <= bounds.x + bounds.width &&
      elementY + elementHeight <= bounds.y + bounds.height
    );
  }

  protected drawConnectionStatus(ctx: SKRSContext2D, data: DataCache): void {
    const { connectionStatus } = data;
    if (connectionStatus.isConnected && !connectionStatus.usingMockData) return;

    const boxWidth = 800;
    const boxHeight = 80;
    const x = (this.displayConfig.width - boxWidth) / 2;
    // Position in footer zone per DESIGN.md, not overlapping content
    const y = this.displayConfig.height - this.SAFE_AREA.bottom / 2 - boxHeight / 2;

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
    drawText(ctx, '⚠', x + 50, y + boxHeight / 2, {
      font: this.displayConfig.fontFamily,
      size: 44,
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
      size: this.FONT_SIZE.MINIMUM,
      weight: 600,
      color: colors.white,
      align: 'center',
      baseline: 'middle',
    });
  }
}
