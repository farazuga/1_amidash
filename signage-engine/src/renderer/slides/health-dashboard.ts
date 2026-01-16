import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
import { drawGauge, getGaugeColor } from '../components/gauge.js';
import { drawText } from '../components/text.js';
import { colors, hexToRgba } from '../components/colors.js';

export class HealthDashboardSlide extends BaseSlide {
  render(ctx: SKRSContext2D, data: DataCache, deltaTime: number): void {
    // Update animations
    this.updateAnimationState(deltaTime);

    // Draw ambient effects
    this.drawAmbientEffects(ctx);

    const headerHeight = this.drawMinimalHeader(ctx, this.config.title || 'Business Health');

    const dashboardMetrics = data.dashboardMetrics.data;
    if (!dashboardMetrics) {
      this.drawNoData(ctx, headerHeight);
      this.drawConnectionStatus(ctx, data);
      return;
    }

    const { health } = dashboardMetrics;
    const { width, height } = this.displayConfig;
    const padding = this.SCREEN_MARGIN;
    const contentY = headerHeight + 60;
    const contentHeight = height - contentY - padding;

    // Layout: Two large gauges side by side with diagnosis below
    const gaugeRadius = Math.min(contentHeight * 0.35, (width - padding * 3) / 4);
    const gaugeY = contentY + contentHeight * 0.35;

    // Left gauge: Sales Health
    const leftGaugeX = width * 0.3;
    drawGauge(ctx, health.salesHealth, leftGaugeX, gaugeY, gaugeRadius, {
      title: 'Sales Health',
      subtitle: 'POs vs Goal',
      thresholds: { low: 60, medium: 80 },
      showNeedle: true,
    });

    // Right gauge: Operations Health
    const rightGaugeX = width * 0.7;
    drawGauge(ctx, health.opsHealth, rightGaugeX, gaugeY, gaugeRadius, {
      title: 'Ops Health',
      subtitle: 'Invoice vs PO Ratio',
      thresholds: { low: 60, medium: 80 },
      showNeedle: true,
    });

    // Draw diagnosis section below gauges
    const diagnosisY = gaugeY + gaugeRadius + 100;
    this.drawDiagnosis(ctx, health.diagnosis, health.message, diagnosisY);

    // Draw bottleneck indicators (with more space to avoid overlap)
    const bottleneckY = diagnosisY + 180;
    this.drawBottleneckIndicators(ctx, health.bottlenecks, bottleneckY);

    // Draw connection status indicator if not connected
    this.drawConnectionStatus(ctx, data);
  }

  private drawNoData(ctx: SKRSContext2D, headerHeight: number): void {
    drawText(ctx, 'Loading health data...', this.displayConfig.width / 2, headerHeight + 200, {
      font: this.displayConfig.fontFamily,
      size: 64,
      color: hexToRgba(colors.white, 0.5),
      align: 'center',
    });
  }

  private drawDiagnosis(
    ctx: SKRSContext2D,
    diagnosis: 'healthy' | 'sales' | 'operations' | 'both',
    message: string,
    y: number
  ): void {
    const { width } = this.displayConfig;
    const centerX = width / 2;

    // Diagnosis badge
    const badgeWidth = 500;
    const badgeHeight = 80;
    const badgeX = centerX - badgeWidth / 2;

    let badgeColor: string;
    let statusText: string;
    let statusIcon: string;

    switch (diagnosis) {
      case 'healthy':
        badgeColor = colors.success;
        statusText = 'ALL SYSTEMS HEALTHY';
        statusIcon = '✓';
        break;
      case 'sales':
        badgeColor = colors.warning;
        statusText = 'SALES ATTENTION NEEDED';
        statusIcon = '⚠';
        break;
      case 'operations':
        badgeColor = colors.warning;
        statusText = 'OPS ATTENTION NEEDED';
        statusIcon = '⚠';
        break;
      case 'both':
        badgeColor = colors.error;
        statusText = 'ACTION REQUIRED';
        statusIcon = '⚠';
        break;
    }

    // Draw badge background (no glow for readability)
    ctx.beginPath();
    ctx.roundRect(badgeX, y, badgeWidth, badgeHeight, 16);
    ctx.fillStyle = hexToRgba(badgeColor, 0.3);
    ctx.fill();

    // Badge border
    ctx.beginPath();
    ctx.roundRect(badgeX, y, badgeWidth, badgeHeight, 16);
    ctx.strokeStyle = badgeColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Status text with icon
    drawText(ctx, `${statusIcon}  ${statusText}`, centerX, y + badgeHeight / 2, {
      font: this.displayConfig.fontFamily,
      size: 42,
      weight: 700,
      color: badgeColor,
      align: 'center',
      baseline: 'middle',
    });

    // Message below badge
    drawText(ctx, message, centerX, y + badgeHeight + 50, {
      font: this.displayConfig.fontFamily,
      size: 32,
      color: hexToRgba(colors.white, 0.7),
      align: 'center',
    });
  }

  private drawBottleneckIndicators(
    ctx: SKRSContext2D,
    bottlenecks: { procurement: number; engineering: number },
    y: number
  ): void {
    const { width } = this.displayConfig;
    const centerX = width / 2;

    if (bottlenecks.procurement === 0 && bottlenecks.engineering === 0) {
      return;
    }

    // Container for bottleneck badges
    const totalWidth = 500;
    const badgeWidth = 200;
    const badgeHeight = 60;
    const gap = 40;

    const startX = centerX - totalWidth / 2;

    // Procurement badge
    if (bottlenecks.procurement > 0) {
      const procX = startX;
      ctx.beginPath();
      ctx.roundRect(procX, y, badgeWidth, badgeHeight, 12);
      ctx.fillStyle = hexToRgba(colors.warning, 0.2);
      ctx.fill();
      ctx.strokeStyle = colors.warning;
      ctx.lineWidth = 2;
      ctx.stroke();

      drawText(ctx, `Procurement: ${bottlenecks.procurement}`, procX + badgeWidth / 2, y + badgeHeight / 2, {
        font: this.displayConfig.fontFamily,
        size: 32,
        weight: 600,
        color: colors.warning,
        align: 'center',
        baseline: 'middle',
      });
    }

    // Engineering badge
    if (bottlenecks.engineering > 0) {
      const engX = startX + badgeWidth + gap;
      ctx.beginPath();
      ctx.roundRect(engX, y, badgeWidth, badgeHeight, 12);
      ctx.fillStyle = hexToRgba(colors.info, 0.2);
      ctx.fill();
      ctx.strokeStyle = colors.info;
      ctx.lineWidth = 2;
      ctx.stroke();

      drawText(ctx, `Engineering: ${bottlenecks.engineering}`, engX + badgeWidth / 2, y + badgeHeight / 2, {
        font: this.displayConfig.fontFamily,
        size: 32,
        weight: 600,
        color: colors.info,
        align: 'center',
        baseline: 'middle',
      });
    }
  }
}
