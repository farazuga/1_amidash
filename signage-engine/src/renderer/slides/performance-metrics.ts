import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
import { drawText } from '../components/text.js';
import { colors, hexToRgba } from '../components/colors.js';
import { drawMiniGauge, getGaugeColor } from '../components/gauge.js';

/**
 * Performance Metrics Slide
 *
 * Displays 4 key performance indicators in a 2x2 grid:
 * - On-Time Completion % (top-left)
 * - DTI - Days to Invoice (top-right)
 * - Sales Health gauge (bottom-left)
 * - Ops Health gauge (bottom-right)
 *
 * Data source: dashboardMetrics.performance and dashboardMetrics.health
 */
export class PerformanceMetricsSlide extends BaseSlide {
  render(ctx: SKRSContext2D, data: DataCache, deltaTime: number): void {
    this.updateAnimationState(deltaTime);
    this.drawAmbientEffects(ctx);

    const headerHeight = this.drawMinimalHeader(ctx, this.config.title || 'Performance');

    const dashboardMetrics = data.dashboardMetrics.data;
    if (!dashboardMetrics) {
      this.drawNoData(ctx, headerHeight);
      this.drawConnectionStatus(ctx, data);
      return;
    }

    const { performance } = dashboardMetrics;
    const { width, height } = this.displayConfig;
    const padding = this.SCREEN_MARGIN;
    const contentY = headerHeight + 60;
    const contentHeight = height - contentY - padding;

    // 2x2 grid of large KPI cards
    const cardGap = 50;
    const cardWidth = (width - padding * 2 - cardGap) / 2;
    const cardHeight = (contentHeight - cardGap) / 2;

    // Top-left: On-Time %
    this.drawOnTimeCard(ctx, performance.onTimePercent, padding, contentY, cardWidth, cardHeight);

    // Top-right: DTI
    this.drawDTICard(ctx, performance.dti, padding + cardWidth + cardGap, contentY, cardWidth, cardHeight);

    // Bottom-left: Sales Health
    const { health } = dashboardMetrics;
    this.drawSalesHealthCard(ctx, health.salesHealth, padding, contentY + cardHeight + cardGap, cardWidth, cardHeight);

    // Bottom-right: Ops Health
    this.drawOpsHealthCard(ctx, health.opsHealth, padding + cardWidth + cardGap, contentY + cardHeight + cardGap, cardWidth, cardHeight);

    // Draw stale data warning if data is old
    this.drawStaleDataWarning(ctx, data.dashboardMetrics.lastUpdated);

    // Draw connection status indicator if not connected
    this.drawConnectionStatus(ctx, data);
  }

  private drawNoData(ctx: SKRSContext2D, headerHeight: number): void {
    drawText(ctx, 'Loading performance data...', this.displayConfig.width / 2, headerHeight + 200, {
      font: this.displayConfig.fontFamily,
      size: 64,
      color: hexToRgba(colors.white, 0.5),
      align: 'center',
    });
  }

  private drawOnTimeCard(ctx: SKRSContext2D, value: number, x: number, y: number, width: number, height: number): void {
    this.drawCardBackground(ctx, x, y, width, height);

    // Title
    drawText(ctx, 'ON-TIME COMPLETION', x + 40, y + 50, {
      font: this.displayConfig.fontFamily,
      size: 40,
      weight: 700,
      color: hexToRgba(colors.white, 0.7),
    });

    // Large gauge
    const gaugeRadius = Math.min(width, height) * 0.25;
    const gaugeX = x + width / 2;
    const gaugeY = y + height / 2 + 30;

    drawMiniGauge(ctx, value, gaugeX, gaugeY, gaugeRadius, 'of projects', { low: 60, medium: 80 });

    // Threshold indicator
    const color = getGaugeColor(value, { low: 60, medium: 80 });
    const status = value >= 80 ? 'Healthy' : value >= 60 ? 'Needs Attention' : 'Critical';

    drawText(ctx, status, gaugeX, y + height - 50, {
      font: this.displayConfig.fontFamily,
      size: this.FONT_SIZE.MINIMUM,
      weight: 600,
      color: color,
      align: 'center',
    });
  }

  private drawDTICard(ctx: SKRSContext2D, value: number, x: number, y: number, width: number, height: number): void {
    this.drawCardBackground(ctx, x, y, width, height);

    // Title
    drawText(ctx, 'DAYS TO INVOICE', x + 40, y + 50, {
      font: this.displayConfig.fontFamily,
      size: 40,
      weight: 700,
      color: hexToRgba(colors.white, 0.7),
    });

    // Large value
    const centerX = x + width / 2;
    const centerY = y + height / 2 + 10;

    // Determine color based on DTI (lower is better)
    let color: string;
    let status: string;
    if (value <= 30) {
      color = colors.success;
      status = 'Excellent';
    } else if (value <= 45) {
      color = colors.primaryLight;
      status = 'Good';
    } else if (value <= 60) {
      color = colors.warning;
      status = 'Average';
    } else {
      color = colors.error;
      status = 'Needs Improvement';
    }

    // Value (no glow for readability)
    drawText(ctx, value.toString(), centerX, centerY, {
      font: this.displayConfig.fontFamily,
      size: 160,
      weight: 700,
      color: color,
      align: 'center',
      baseline: 'middle',
    });

    // Unit
    drawText(ctx, 'days avg', centerX, centerY + 80, {
      font: this.displayConfig.fontFamily,
      size: 36,
      color: hexToRgba(colors.white, 0.5),
      align: 'center',
    });

    // Status
    drawText(ctx, status, centerX, y + height - 50, {
      font: this.displayConfig.fontFamily,
      size: this.FONT_SIZE.MINIMUM,
      weight: 600,
      color: color,
      align: 'center',
    });
  }

  private drawSalesHealthCard(ctx: SKRSContext2D, value: number, x: number, y: number, width: number, height: number): void {
    this.drawCardBackground(ctx, x, y, width, height);

    // Title
    drawText(ctx, 'SALES HEALTH', x + 40, y + 50, {
      font: this.displayConfig.fontFamily,
      size: 40,
      weight: 700,
      color: hexToRgba(colors.white, 0.7),
    });

    // Large gauge (same style as On-Time Completion)
    const gaugeRadius = Math.min(width, height) * 0.25;
    const gaugeX = x + width / 2;
    const gaugeY = y + height / 2 + 30;

    drawMiniGauge(ctx, value, gaugeX, gaugeY, gaugeRadius, 'POs vs Goal', { low: 60, medium: 80 });

    // Threshold indicator
    const color = getGaugeColor(value, { low: 60, medium: 80 });
    const status = value >= 80 ? 'Healthy' : value >= 60 ? 'Needs Attention' : 'Critical';

    drawText(ctx, status, gaugeX, y + height - 50, {
      font: this.displayConfig.fontFamily,
      size: this.FONT_SIZE.MINIMUM,
      weight: 600,
      color: color,
      align: 'center',
    });
  }

  private drawOpsHealthCard(ctx: SKRSContext2D, value: number, x: number, y: number, width: number, height: number): void {
    this.drawCardBackground(ctx, x, y, width, height);

    // Title
    drawText(ctx, 'OPS HEALTH', x + 40, y + 50, {
      font: this.displayConfig.fontFamily,
      size: 40,
      weight: 700,
      color: hexToRgba(colors.white, 0.7),
    });

    // Large gauge (same style as On-Time Completion)
    const gaugeRadius = Math.min(width, height) * 0.25;
    const gaugeX = x + width / 2;
    const gaugeY = y + height / 2 + 30;

    drawMiniGauge(ctx, value, gaugeX, gaugeY, gaugeRadius, 'Invoiced vs POs', { low: 60, medium: 80 });

    // Threshold indicator
    const color = getGaugeColor(value, { low: 60, medium: 80 });
    const status = value >= 80 ? 'Healthy' : value >= 60 ? 'Needs Attention' : 'Critical';

    drawText(ctx, status, gaugeX, y + height - 50, {
      font: this.displayConfig.fontFamily,
      size: this.FONT_SIZE.MINIMUM,
      weight: 600,
      color: color,
      align: 'center',
    });
  }

  private drawCardBackground(ctx: SKRSContext2D, x: number, y: number, width: number, height: number): void {
    // Card background with subtle border
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 20);
    ctx.fillStyle = hexToRgba(colors.white, 0.06);
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 20);
    ctx.strokeStyle = hexToRgba(colors.white, 0.1);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
