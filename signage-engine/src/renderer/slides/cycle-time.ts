import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
import { drawText } from '../components/text.js';
import { colors, hexToRgba } from '../components/colors.js';

export class CycleTimeSlide extends BaseSlide {
  render(ctx: SKRSContext2D, data: DataCache, deltaTime: number): void {
    this.updateAnimationState(deltaTime);
    this.drawAmbientEffects(ctx);

    const headerHeight = this.drawMinimalHeader(ctx, this.config.title || 'Cycle Time Analysis');

    const dashboardMetrics = data.dashboardMetrics.data;
    if (!dashboardMetrics) {
      this.drawNoData(ctx, headerHeight);
      return;
    }

    const { cycleTime } = dashboardMetrics;
    const { width, height } = this.displayConfig;
    const padding = 100;
    const contentY = headerHeight + 60;
    const contentHeight = height - contentY - padding;

    // Total cycle time summary
    this.drawTotalCycleTime(ctx, cycleTime.totalAvgCycleTime, padding, contentY, width - padding * 2);

    // Horizontal bar chart of status cycle times
    const chartY = contentY + 180;
    const chartHeight = contentHeight - 200;
    this.drawCycleTimeChart(ctx, cycleTime.statuses, padding, chartY, width - padding * 2, chartHeight);
  }

  private drawNoData(ctx: SKRSContext2D, headerHeight: number): void {
    drawText(ctx, 'Loading cycle time data...', this.displayConfig.width / 2, headerHeight + 200, {
      font: this.displayConfig.fontFamily,
      size: 64,
      color: hexToRgba(colors.white, 0.5),
      align: 'center',
    });
  }

  private drawTotalCycleTime(ctx: SKRSContext2D, totalDays: number, x: number, y: number, width: number): void {
    const centerX = x + width / 2;

    // Background card
    const cardWidth = 600;
    const cardHeight = 120;
    const cardX = centerX - cardWidth / 2;

    ctx.beginPath();
    ctx.roundRect(cardX, y, cardWidth, cardHeight, 20);
    ctx.fillStyle = hexToRgba(colors.white, 0.06);
    ctx.fill();

    // Total days value
    ctx.save();
    ctx.shadowColor = colors.primaryLight;
    ctx.shadowBlur = 25;
    drawText(ctx, totalDays.toString(), centerX - 100, y + cardHeight / 2, {
      font: this.displayConfig.fontFamily,
      size: 80,
      weight: 700,
      color: colors.primaryLight,
      align: 'right',
      baseline: 'middle',
    });
    ctx.restore();

    // Label
    drawText(ctx, 'days', centerX - 70, y + cardHeight / 2 - 15, {
      font: this.displayConfig.fontFamily,
      size: 32,
      color: hexToRgba(colors.white, 0.6),
      baseline: 'middle',
    });

    drawText(ctx, 'avg total cycle', centerX - 70, y + cardHeight / 2 + 20, {
      font: this.displayConfig.fontFamily,
      size: 28,
      color: hexToRgba(colors.white, 0.5),
      baseline: 'middle',
    });

    // Description on right side
    drawText(ctx, 'Average time from PO receipt', centerX + 100, y + cardHeight / 2 - 15, {
      font: this.displayConfig.fontFamily,
      size: 26,
      color: hexToRgba(colors.white, 0.5),
      baseline: 'middle',
    });

    drawText(ctx, 'to project completion', centerX + 100, y + cardHeight / 2 + 15, {
      font: this.displayConfig.fontFamily,
      size: 26,
      color: hexToRgba(colors.white, 0.5),
      baseline: 'middle',
    });
  }

  private drawCycleTimeChart(
    ctx: SKRSContext2D,
    statuses: { name: string; avgDays: number; isBottleneck: boolean; color: string }[],
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    if (statuses.length === 0) return;

    const labelWidth = 250;
    const valueWidth = 100;
    const chartWidth = width - labelWidth - valueWidth;
    const chartX = x + labelWidth;

    const barHeight = Math.min(80, (height - 40) / statuses.length);
    const barGap = 15;
    const maxDays = Math.max(...statuses.map((s) => s.avgDays), 1);

    // Draw grid lines
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const lineX = chartX + (i / gridLines) * chartWidth;
      const value = Math.round((maxDays * i) / gridLines);

      // Grid line
      ctx.beginPath();
      ctx.moveTo(lineX, y);
      ctx.lineTo(lineX, y + height - 60);
      ctx.strokeStyle = hexToRgba(colors.white, 0.08);
      ctx.lineWidth = 1;
      ctx.stroke();

      // X-axis label
      drawText(ctx, `${value}d`, lineX, y + height - 30, {
        font: this.displayConfig.fontFamily,
        size: 24,
        color: hexToRgba(colors.white, 0.4),
        align: 'center',
      });
    }

    // Draw bars
    statuses.forEach((status, index) => {
      const barY = y + index * (barHeight + barGap);
      const barWidth = (status.avgDays / maxDays) * chartWidth;

      // Status label
      const displayName = status.name.length > 18 ? status.name.substring(0, 15) + '...' : status.name;
      drawText(ctx, displayName, x + labelWidth - 20, barY + barHeight / 2, {
        font: this.displayConfig.fontFamily,
        size: 32,
        weight: status.isBottleneck ? 700 : 400,
        color: status.isBottleneck ? colors.warning : colors.white,
        align: 'right',
        baseline: 'middle',
      });

      // Bar background
      ctx.beginPath();
      ctx.roundRect(chartX, barY + 5, chartWidth, barHeight - 10, 8);
      ctx.fillStyle = hexToRgba(colors.white, 0.04);
      ctx.fill();

      // Bar fill with gradient
      if (barWidth > 0) {
        const gradient = ctx.createLinearGradient(chartX, barY, chartX + barWidth, barY);
        gradient.addColorStop(0, hexToRgba(status.color, 0.9));
        gradient.addColorStop(1, hexToRgba(status.color, 0.6));

        ctx.beginPath();
        ctx.roundRect(chartX, barY + 5, barWidth, barHeight - 10, 8);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Glow for bottleneck
        if (status.isBottleneck) {
          ctx.save();
          ctx.shadowColor = colors.warning;
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.roundRect(chartX, barY + 5, barWidth, barHeight - 10, 8);
          ctx.strokeStyle = colors.warning;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }
      }

      // Days value
      ctx.save();
      if (status.isBottleneck) {
        ctx.shadowColor = colors.warning;
        ctx.shadowBlur = 10;
      }
      drawText(ctx, `${status.avgDays}d`, chartX + chartWidth + 20, barY + barHeight / 2, {
        font: this.displayConfig.fontFamily,
        size: 36,
        weight: 700,
        color: status.isBottleneck ? colors.warning : colors.white,
        baseline: 'middle',
      });
      ctx.restore();

      // Bottleneck indicator icon
      if (status.isBottleneck) {
        drawText(ctx, '⚠', chartX + chartWidth + 80, barY + barHeight / 2, {
          font: this.displayConfig.fontFamily,
          size: 30,
          color: colors.warning,
          baseline: 'middle',
        });
      }
    });

    // X-axis line
    ctx.beginPath();
    ctx.moveTo(chartX, y + height - 60);
    ctx.lineTo(chartX + chartWidth, y + height - 60);
    ctx.strokeStyle = hexToRgba(colors.white, 0.2);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Legend
    const legendY = y + height - 15;
    const legendX = x + width / 2;

    // Bottleneck indicator
    ctx.beginPath();
    ctx.roundRect(legendX - 150, legendY - 12, 20, 20, 4);
    ctx.fillStyle = colors.warning;
    ctx.fill();

    drawText(ctx, '= Potential bottleneck status', legendX - 120, legendY, {
      font: this.displayConfig.fontFamily,
      size: 24,
      color: hexToRgba(colors.white, 0.5),
      baseline: 'middle',
    });
  }
}
