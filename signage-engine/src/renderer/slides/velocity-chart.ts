import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
import { drawText } from '../components/text.js';
import { colors, hexToRgba } from '../components/colors.js';

export class VelocityChartSlide extends BaseSlide {
  render(ctx: SKRSContext2D, data: DataCache, deltaTime: number): void {
    this.updateAnimationState(deltaTime);
    this.drawAmbientEffects(ctx);

    const headerHeight = this.drawMinimalHeader(ctx, this.config.title || 'PO vs Invoice Velocity');

    const dashboardMetrics = data.dashboardMetrics.data;
    if (!dashboardMetrics) {
      this.drawNoData(ctx, headerHeight);
      this.drawConnectionStatus(ctx, data);
      return;
    }

    const { velocity } = dashboardMetrics;
    const { width, height } = this.displayConfig;
    const padding = this.SCREEN_MARGIN;
    const contentY = headerHeight + 80;
    const contentHeight = height - contentY - padding - 100;

    // Summary cards at top
    this.drawSummaryCards(ctx, velocity, padding, contentY, width - padding * 2);

    // Main bar chart
    const chartY = contentY + 180;
    const chartHeight = contentHeight - 100;
    this.drawVelocityChart(ctx, velocity.monthly, padding, chartY, width - padding * 2, chartHeight);

    // Legend at bottom
    this.drawLegend(ctx, padding, chartY + chartHeight + 40, width - padding * 2);

    // Draw connection status indicator if not connected
    this.drawConnectionStatus(ctx, data);
  }

  private drawNoData(ctx: SKRSContext2D, headerHeight: number): void {
    drawText(ctx, 'Loading velocity data...', this.displayConfig.width / 2, headerHeight + 200, {
      font: this.displayConfig.fontFamily,
      size: 64,
      color: hexToRgba(colors.white, 0.5),
      align: 'center',
    });
  }

  private drawSummaryCards(
    ctx: SKRSContext2D,
    velocity: {
      totalPOs: number;
      totalInvoiced: number;
      netChange: number;
      trend: 'growing' | 'shrinking' | 'stable';
    },
    x: number,
    y: number,
    width: number
  ): void {
    const cardWidth = (width - 60) / 3;
    const cardHeight = 120;
    const gap = 30;

    // POs Received card
    this.drawSummaryCard(
      ctx,
      'POs Received (6mo)',
      velocity.totalPOs.toString(),
      '#3b82f6',
      x,
      y,
      cardWidth,
      cardHeight
    );

    // Invoiced card
    this.drawSummaryCard(
      ctx,
      'Invoiced (6mo)',
      velocity.totalInvoiced.toString(),
      colors.success,
      x + cardWidth + gap,
      y,
      cardWidth,
      cardHeight
    );

    // Net Change card with trend indicator
    let trendColor: string;
    let trendIcon: string;
    let trendLabel: string;

    switch (velocity.trend) {
      case 'growing':
        trendColor = '#3b82f6';
        trendIcon = '↑';
        trendLabel = 'Backlog Growing';
        break;
      case 'shrinking':
        trendColor = colors.success;
        trendIcon = '↓';
        trendLabel = 'Backlog Shrinking';
        break;
      default:
        trendColor = hexToRgba(colors.white, 0.7);
        trendIcon = '→';
        trendLabel = 'Stable';
    }

    const netDisplay = velocity.netChange >= 0 ? `+${velocity.netChange}` : velocity.netChange.toString();

    this.drawSummaryCard(
      ctx,
      'Net Change',
      `${trendIcon} ${netDisplay}`,
      trendColor,
      x + (cardWidth + gap) * 2,
      y,
      cardWidth,
      cardHeight,
      trendLabel
    );
  }

  private drawSummaryCard(
    ctx: SKRSContext2D,
    title: string,
    value: string,
    color: string,
    x: number,
    y: number,
    width: number,
    height: number,
    subtitle?: string
  ): void {
    // Card background
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 16);
    ctx.fillStyle = hexToRgba(colors.white, 0.06);
    ctx.fill();

    // Top accent line
    ctx.beginPath();
    ctx.roundRect(x, y, width, 6, [16, 16, 0, 0]);
    ctx.fillStyle = color;
    ctx.fill();

    // Title
    drawText(ctx, title, x + 25, y + 40, {
      font: this.displayConfig.fontFamily,
      size: 36,
      color: hexToRgba(colors.white, 0.6),
    });

    // Value (no glow for readability)
    drawText(ctx, value, x + 25, y + 85, {
      font: this.displayConfig.fontFamily,
      size: 52,
      weight: 700,
      color: color,
    });

    // Subtitle if provided
    if (subtitle) {
      drawText(ctx, subtitle, x + width - 25, y + height - 25, {
        font: this.displayConfig.fontFamily,
        size: 22,
        color: hexToRgba(color, 0.8),
        align: 'right',
      });
    }
  }

  private drawVelocityChart(
    ctx: SKRSContext2D,
    monthly: { month: string; posReceived: number; invoiced: number }[],
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const barGroupWidth = width / monthly.length;
    const barWidth = barGroupWidth * 0.35;
    const maxValue = Math.max(
      ...monthly.map((m) => Math.max(m.posReceived, m.invoiced)),
      1
    );

    // Draw grid lines
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const lineY = y + (i / gridLines) * height;
      const value = Math.round(maxValue * (1 - i / gridLines));

      // Grid line
      ctx.beginPath();
      ctx.moveTo(x, lineY);
      ctx.lineTo(x + width, lineY);
      ctx.strokeStyle = hexToRgba(colors.white, 0.08);
      ctx.lineWidth = 1;
      ctx.stroke();

      // Y-axis label
      if (i < gridLines) {
        drawText(ctx, value.toString(), x - 20, lineY, {
          font: this.displayConfig.fontFamily,
          size: 28,
          color: hexToRgba(colors.white, 0.4),
          align: 'right',
          baseline: 'middle',
        });
      }
    }

    // Draw bars for each month
    monthly.forEach((month, index) => {
      const groupX = x + index * barGroupWidth + barGroupWidth / 2;

      // PO bar (blue)
      const poHeight = (month.posReceived / maxValue) * height;
      const poBarX = groupX - barWidth - 5;
      const poBarY = y + height - poHeight;

      // Draw PO bar with gradient
      const poGradient = ctx.createLinearGradient(poBarX, poBarY, poBarX, y + height);
      poGradient.addColorStop(0, '#3b82f6');
      poGradient.addColorStop(1, hexToRgba('#3b82f6', 0.6));

      ctx.beginPath();
      ctx.roundRect(poBarX, poBarY, barWidth, poHeight, [8, 8, 0, 0]);
      ctx.fillStyle = poGradient;
      ctx.fill();

      // PO value on top of bar
      if (month.posReceived > 0) {
        drawText(ctx, month.posReceived.toString(), poBarX + barWidth / 2, poBarY - 15, {
          font: this.displayConfig.fontFamily,
          size: 32,
          weight: 600,
          color: '#3b82f6',
          align: 'center',
        });
      }

      // Invoice bar (green)
      const invHeight = (month.invoiced / maxValue) * height;
      const invBarX = groupX + 5;
      const invBarY = y + height - invHeight;

      // Draw Invoice bar with gradient
      const invGradient = ctx.createLinearGradient(invBarX, invBarY, invBarX, y + height);
      invGradient.addColorStop(0, colors.success);
      invGradient.addColorStop(1, hexToRgba(colors.success, 0.6));

      ctx.beginPath();
      ctx.roundRect(invBarX, invBarY, barWidth, invHeight, [8, 8, 0, 0]);
      ctx.fillStyle = invGradient;
      ctx.fill();

      // Invoice value on top of bar
      if (month.invoiced > 0) {
        drawText(ctx, month.invoiced.toString(), invBarX + barWidth / 2, invBarY - 15, {
          font: this.displayConfig.fontFamily,
          size: 32,
          weight: 600,
          color: colors.success,
          align: 'center',
        });
      }

      // Month label
      drawText(ctx, month.month, groupX, y + height + 40, {
        font: this.displayConfig.fontFamily,
        size: 32,
        weight: 600,
        color: colors.white,
        align: 'center',
      });
    });

    // X-axis line
    ctx.beginPath();
    ctx.moveTo(x, y + height);
    ctx.lineTo(x + width, y + height);
    ctx.strokeStyle = hexToRgba(colors.white, 0.3);
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawLegend(ctx: SKRSContext2D, x: number, y: number, width: number): void {
    const centerX = x + width / 2;
    const legendSpacing = 250;

    // PO legend
    ctx.beginPath();
    ctx.roundRect(centerX - legendSpacing - 20, y, 30, 30, 6);
    ctx.fillStyle = '#3b82f6';
    ctx.fill();

    drawText(ctx, 'POs Received', centerX - legendSpacing + 25, y + 15, {
      font: this.displayConfig.fontFamily,
      size: 28,
      color: hexToRgba(colors.white, 0.7),
      baseline: 'middle',
    });

    // Invoice legend
    ctx.beginPath();
    ctx.roundRect(centerX + 50, y, 30, 30, 6);
    ctx.fillStyle = colors.success;
    ctx.fill();

    drawText(ctx, 'Invoiced', centerX + 95, y + 15, {
      font: this.displayConfig.fontFamily,
      size: 28,
      color: hexToRgba(colors.white, 0.7),
      baseline: 'middle',
    });
  }
}
