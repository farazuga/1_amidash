import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
import { drawText } from '../components/text.js';
import { colors, hexToRgba } from '../components/colors.js';
import {
  getAnimatedNumber,
  drawPulsingGlow,
} from '../components/animations.js';

export class VidpodSalesSlide extends BaseSlide {
  render(ctx: SKRSContext2D, data: DataCache, deltaTime: number): void {
    // Update animations
    this.updateAnimationState(deltaTime);

    // Draw ambient effects
    this.drawAmbientEffects(ctx);

    const headerHeight = this.drawMinimalHeader(ctx, this.config.title || 'VidPOD Sales');

    const dashboardMetrics = data.dashboardMetrics.data;
    if (!dashboardMetrics) {
      this.drawNoData(ctx, headerHeight);
      this.drawConnectionStatus(ctx, data);
      return;
    }

    const { totalSold } = dashboardMetrics.vidpodSales;
    const { width, height } = this.displayConfig;

    // Center the hero metric vertically in the content area
    const contentHeight = height - headerHeight;
    const centerY = headerHeight + contentHeight / 2 - 40;

    // Pulsing glow behind the number
    drawPulsingGlow(
      ctx,
      width / 2 - 300,
      centerY - 200,
      600,
      300,
      this.animationState.pulsePhase,
      colors.primaryLight
    );

    // Animated hero number
    const animatedValue = getAnimatedNumber(
      this.animationState,
      'vidpodTotal',
      totalSold,
      2000
    );

    drawText(ctx, animatedValue.toString(), width / 2, centerY, {
      font: this.displayConfig.fontFamily,
      size: 280,
      weight: 800,
      color: colors.white,
      align: 'center',
      baseline: 'middle',
    });

    // Label below the number
    drawText(ctx, 'TOTAL VIDPODS SOLD', width / 2, centerY + 170, {
      font: this.displayConfig.fontFamily,
      size: 48,
      weight: 600,
      color: colors.primaryLight,
      align: 'center',
    });

    // Accent underline
    const underlineWidth = 400;
    ctx.beginPath();
    ctx.moveTo(width / 2 - underlineWidth / 2, centerY + 210);
    ctx.lineTo(width / 2 + underlineWidth / 2, centerY + 210);
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Stale data / connection indicators
    this.drawStaleDataWarning(ctx, data.dashboardMetrics.lastUpdated);
    this.drawConnectionStatus(ctx, data);
  }

  private drawNoData(ctx: SKRSContext2D, headerHeight: number): void {
    drawText(ctx, 'Loading VidPOD data...', this.displayConfig.width / 2, headerHeight + 300, {
      font: this.displayConfig.fontFamily,
      size: 48,
      color: hexToRgba(colors.white, 0.5),
      align: 'center',
    });
  }
}
