import type { CanvasRenderingContext2D, Image } from 'canvas';
import type { SlideConfig, DisplayConfig, StaleDataConfig } from '../../config/schema.js';
import { colors } from '../components/colors.js';
import { fontSizes, fontFamilies, drawText, drawTimestamp } from '../components/text.js';
import { drawRoundedRect } from '../components/charts.js';

export interface SlideRenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  config: SlideConfig;
  displayConfig: DisplayConfig;
  staleDataConfig: StaleDataConfig;
  logo: Image | null;
  isStale: boolean;
  lastUpdate: number;
}

/**
 * Base class for all slide types
 */
export abstract class BaseSlide {
  protected config: SlideConfig;

  constructor(config: SlideConfig) {
    this.config = config;
  }

  /**
   * Get the slide configuration
   */
  getConfig(): SlideConfig {
    return this.config;
  }

  /**
   * Update the slide configuration
   */
  updateConfig(config: SlideConfig): void {
    this.config = config;
  }

  /**
   * Render the slide - must be implemented by subclasses
   */
  abstract render(context: SlideRenderContext, data: unknown): void;

  /**
   * Get the slide type
   */
  getType(): string {
    return this.config.type;
  }

  /**
   * Check if the slide is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get slide duration in milliseconds
   */
  getDuration(): number {
    return this.config.duration;
  }

  // =====================
  // Common rendering helpers
  // =====================

  /**
   * Draw the slide background
   */
  protected drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number, color?: string): void {
    ctx.fillStyle = color || colors.background;
    ctx.fillRect(0, 0, width, height);
  }

  /**
   * Draw the slide header with logo and title
   */
  protected drawHeader(
    context: SlideRenderContext,
    title?: string
  ): number {
    const { ctx, width, logo, displayConfig } = context;
    const headerHeight = 180;
    const padding = 60;

    // Draw header background
    ctx.fillStyle = colors.backgroundDark;
    ctx.fillRect(0, 0, width, headerHeight);

    // Draw logo
    let logoEndX = padding;
    if (logo) {
      const logoHeight = 100;
      const logoWidth = (logo.width / logo.height) * logoHeight;
      ctx.drawImage(logo, padding, (headerHeight - logoHeight) / 2, logoWidth, logoHeight);
      logoEndX = padding + logoWidth + 40;
    }

    // Draw title
    const slideTitle = title || this.config.title || this.getType();
    ctx.font = `bold ${fontSizes.title}px ${fontFamilies.primary}`;
    ctx.fillStyle = colors.textPrimary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(slideTitle, logoEndX, headerHeight / 2);

    // Draw timestamp on right
    drawTimestamp(ctx, new Date(), width - padding, headerHeight / 2, {
      format: 'datetime',
      align: 'right',
    });

    return headerHeight;
  }

  /**
   * Draw the stale data indicator
   */
  protected drawStaleIndicator(context: SlideRenderContext): void {
    const { ctx, width, height, staleDataConfig, isStale, lastUpdate } = context;

    if (!isStale) return;

    const padding = 30;
    const indicatorWidth = 350;
    const indicatorHeight = 60;

    // Calculate position
    let x: number, y: number;
    switch (staleDataConfig.indicatorPosition) {
      case 'top-left':
        x = padding;
        y = padding;
        break;
      case 'top-right':
        x = width - indicatorWidth - padding;
        y = padding;
        break;
      case 'bottom-left':
        x = padding;
        y = height - indicatorHeight - padding;
        break;
      case 'bottom-right':
      default:
        x = width - indicatorWidth - padding;
        y = height - indicatorHeight - padding;
    }

    // Draw indicator background
    ctx.fillStyle = colors.staleWarning;
    drawRoundedRect(ctx, x, y, indicatorWidth, indicatorHeight, 10);
    ctx.fill();

    // Draw warning text
    ctx.font = `bold ${fontSizes.small}px ${fontFamilies.primary}`;
    ctx.fillStyle = colors.backgroundDark;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const staleMinutes = Math.floor((Date.now() - lastUpdate) / 60000);
    const message = staleMinutes > 0
      ? `Data may be stale (${staleMinutes}m ago)`
      : 'Data may be stale';
    ctx.fillText(message, x + indicatorWidth / 2, y + indicatorHeight / 2);
  }

  /**
   * Draw a "No Data" message
   */
  protected drawNoData(ctx: CanvasRenderingContext2D, width: number, height: number, message?: string): void {
    ctx.font = `${fontSizes.subtitle}px ${fontFamilies.primary}`;
    ctx.fillStyle = colors.textMuted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message || 'No data available', width / 2, height / 2);
  }

  /**
   * Draw a table header row
   */
  protected drawTableHeader(
    ctx: CanvasRenderingContext2D,
    columns: { label: string; x: number; width: number; align?: CanvasTextAlign }[],
    y: number
  ): void {
    ctx.font = `bold ${fontSizes.heading}px ${fontFamilies.primary}`;
    ctx.fillStyle = colors.textSecondary;

    columns.forEach((col) => {
      ctx.textAlign = col.align || 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(col.label.toUpperCase(), col.x, y);
    });
  }

  /**
   * Draw a horizontal divider line
   */
  protected drawDivider(ctx: CanvasRenderingContext2D, x: number, y: number, width: number): void {
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y);
    ctx.stroke();
  }

  /**
   * Draw a card/box with rounded corners
   */
  protected drawCard(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    options: {
      backgroundColor?: string;
      borderColor?: string;
      borderWidth?: number;
      borderRadius?: number;
    } = {}
  ): void {
    const {
      backgroundColor = colors.backgroundLight,
      borderColor,
      borderWidth = 2,
      borderRadius = 16,
    } = options;

    // Fill
    ctx.fillStyle = backgroundColor;
    drawRoundedRect(ctx, x, y, width, height, borderRadius);
    ctx.fill();

    // Border
    if (borderColor) {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      drawRoundedRect(ctx, x, y, width, height, borderRadius);
      ctx.stroke();
    }
  }
}
