import { CanvasRenderingContext2D, loadImage, Image } from 'canvas';
import { DisplayConfig, SlideConfig } from '../../config/schema.js';
import { DataCache } from '../../data/polling-manager.js';
import { drawText } from '../components/text.js';
import { colors } from '../components/colors.js';

export abstract class BaseSlide {
  protected config: SlideConfig;
  protected displayConfig: DisplayConfig;
  protected logo: Image | null = null;

  constructor(config: SlideConfig, displayConfig: DisplayConfig) {
    this.config = config;
    this.displayConfig = displayConfig;
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

  abstract render(ctx: CanvasRenderingContext2D, data: DataCache, deltaTime: number): void;

  protected drawHeader(ctx: CanvasRenderingContext2D, title: string): number {
    const headerHeight = 120;
    const padding = 60;

    // Header background
    ctx.fillStyle = this.displayConfig.accentColor;
    ctx.fillRect(0, 0, this.displayConfig.width, headerHeight);

    // Logo
    if (this.logo) {
      const logoHeight = 60;
      const logoWidth = (this.logo.width / this.logo.height) * logoHeight;
      ctx.drawImage(this.logo, padding, (headerHeight - logoHeight) / 2, logoWidth, logoHeight);
    }

    // Title
    drawText(ctx, title, this.displayConfig.width / 2, headerHeight / 2, {
      font: this.displayConfig.fontFamily,
      size: 48,
      color: colors.white,
      align: 'center',
      baseline: 'middle',
    });

    // Timestamp
    const now = new Date().toLocaleTimeString();
    drawText(ctx, now, this.displayConfig.width - padding, headerHeight / 2, {
      font: this.displayConfig.fontFamily,
      size: 24,
      color: 'rgba(255, 255, 255, 0.7)',
      align: 'right',
      baseline: 'middle',
    });

    return headerHeight;
  }

  protected drawStaleIndicator(
    ctx: CanvasRenderingContext2D,
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
}
