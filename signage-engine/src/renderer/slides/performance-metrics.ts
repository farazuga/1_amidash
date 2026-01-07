import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
import { drawText } from '../components/text.js';
import { colors, hexToRgba } from '../components/colors.js';
import { drawMiniGauge, getGaugeColor } from '../components/gauge.js';

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
    const padding = 80;
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

    // Bottom-left: Backlog Depth
    this.drawBacklogCard(ctx, performance.backlogDepth, padding, contentY + cardHeight + cardGap, cardWidth, cardHeight);

    // Bottom-right: Customer Concentration
    this.drawConcentrationCard(
      ctx,
      performance.customerConcentration,
      performance.concentrationRisk,
      performance.topClients,
      padding + cardWidth + cardGap,
      contentY + cardHeight + cardGap,
      cardWidth,
      cardHeight
    );

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
      size: 32,
      weight: 700,
      color: hexToRgba(colors.white, 0.7),
      letterSpacing: 2,
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
      size: 28,
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
      size: 32,
      weight: 700,
      color: hexToRgba(colors.white, 0.7),
      letterSpacing: 2,
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

    // Value with glow
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 30;
    drawText(ctx, value.toString(), centerX, centerY, {
      font: this.displayConfig.fontFamily,
      size: 160,
      weight: 700,
      color: color,
      align: 'center',
      baseline: 'middle',
    });
    ctx.restore();

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
      size: 28,
      weight: 600,
      color: color,
      align: 'center',
    });
  }

  private drawBacklogCard(ctx: SKRSContext2D, value: number, x: number, y: number, width: number, height: number): void {
    this.drawCardBackground(ctx, x, y, width, height);

    // Title
    drawText(ctx, 'BACKLOG DEPTH', x + 40, y + 50, {
      font: this.displayConfig.fontFamily,
      size: 32,
      weight: 700,
      color: hexToRgba(colors.white, 0.7),
      letterSpacing: 2,
    });

    const centerX = x + width / 2;
    const centerY = y + height / 2 + 10;

    // Determine status (2-6 months is healthy)
    let color: string;
    let status: string;
    if (value < 2) {
      color = colors.warning;
      status = 'Low Backlog';
    } else if (value <= 6) {
      color = colors.success;
      status = 'Healthy Range';
    } else {
      color = colors.warning;
      status = 'High Backlog';
    }

    // Value with glow
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 30;
    drawText(ctx, value.toFixed(1), centerX, centerY, {
      font: this.displayConfig.fontFamily,
      size: 160,
      weight: 700,
      color: color,
      align: 'center',
      baseline: 'middle',
    });
    ctx.restore();

    // Unit
    drawText(ctx, 'months of work', centerX, centerY + 80, {
      font: this.displayConfig.fontFamily,
      size: 36,
      color: hexToRgba(colors.white, 0.5),
      align: 'center',
    });

    // Status
    drawText(ctx, status, centerX, y + height - 50, {
      font: this.displayConfig.fontFamily,
      size: 28,
      weight: 600,
      color: color,
      align: 'center',
    });
  }

  private drawConcentrationCard(
    ctx: SKRSContext2D,
    value: number,
    risk: 'low' | 'medium' | 'high',
    topClients: { name: string; revenue: number; percent: number }[],
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    this.drawCardBackground(ctx, x, y, width, height);

    // Title
    drawText(ctx, 'CUSTOMER CONCENTRATION', x + 40, y + 50, {
      font: this.displayConfig.fontFamily,
      size: 32,
      weight: 700,
      color: hexToRgba(colors.white, 0.7),
      letterSpacing: 2,
    });

    // Risk indicator
    let color: string;
    let riskLabel: string;
    switch (risk) {
      case 'low':
        color = colors.success;
        riskLabel = 'Low Risk';
        break;
      case 'medium':
        color = colors.warning;
        riskLabel = 'Medium Risk';
        break;
      case 'high':
        color = colors.error;
        riskLabel = 'High Risk';
        break;
    }

    // Large percentage
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    drawText(ctx, `${Math.round(value)}%`, x + 120, y + 160, {
      font: this.displayConfig.fontFamily,
      size: 100,
      weight: 700,
      color: color,
      align: 'center',
    });
    ctx.restore();

    drawText(ctx, 'from top 3', x + 120, y + 220, {
      font: this.displayConfig.fontFamily,
      size: 28,
      color: hexToRgba(colors.white, 0.5),
      align: 'center',
    });

    // Risk badge
    const badgeWidth = 150;
    const badgeX = x + 120 - badgeWidth / 2;
    ctx.beginPath();
    ctx.roundRect(badgeX, y + 250, badgeWidth, 40, 8);
    ctx.fillStyle = hexToRgba(color, 0.3);
    ctx.fill();

    drawText(ctx, riskLabel, x + 120, y + 270, {
      font: this.displayConfig.fontFamily,
      size: 24,
      weight: 600,
      color: color,
      align: 'center',
      baseline: 'middle',
    });

    // Top clients list
    const listX = x + 260;
    const listY = y + 110;
    const itemHeight = 70;

    topClients.slice(0, 3).forEach((client, index) => {
      const itemY = listY + index * itemHeight;

      // Rank badge
      ctx.beginPath();
      ctx.arc(listX + 20, itemY + 25, 20, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(colors.white, 0.1);
      ctx.fill();

      drawText(ctx, (index + 1).toString(), listX + 20, itemY + 25, {
        font: this.displayConfig.fontFamily,
        size: 24,
        weight: 700,
        color: colors.white,
        align: 'center',
        baseline: 'middle',
      });

      // Client name
      const truncatedName = client.name.length > 18 ? client.name.substring(0, 15) + '...' : client.name;
      drawText(ctx, truncatedName, listX + 55, itemY + 20, {
        font: this.displayConfig.fontFamily,
        size: 30,
        weight: 600,
        color: colors.white,
      });

      // Percentage
      drawText(ctx, `${Math.round(client.percent)}%`, listX + 55, itemY + 52, {
        font: this.displayConfig.fontFamily,
        size: 24,
        color: hexToRgba(colors.white, 0.5),
      });

      // Mini progress bar
      const barWidth = width - 340;
      const barHeight = 8;
      const barX = listX + 130;
      const barY = itemY + 47;

      ctx.beginPath();
      ctx.roundRect(barX, barY, barWidth, barHeight, 4);
      ctx.fillStyle = hexToRgba(colors.white, 0.1);
      ctx.fill();

      ctx.beginPath();
      ctx.roundRect(barX, barY, (client.percent / 100) * barWidth, barHeight, 4);
      ctx.fillStyle = index === 0 ? color : hexToRgba(color, 0.6);
      ctx.fill();
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
