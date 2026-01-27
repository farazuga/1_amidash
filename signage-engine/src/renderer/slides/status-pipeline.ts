import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
import { drawText } from '../components/text.js';
import { colors, hexToRgba } from '../components/colors.js';

export class StatusPipelineSlide extends BaseSlide {
  private flowOffset = 0;

  render(ctx: SKRSContext2D, data: DataCache, deltaTime: number): void {
    this.updateAnimationState(deltaTime);
    this.drawAmbientEffects(ctx);

    // Animate flow effect
    this.flowOffset += deltaTime * 50;
    if (this.flowOffset > 30) this.flowOffset = 0;

    const headerHeight = this.drawMinimalHeader(ctx, this.config.title || 'Project Pipeline');

    const dashboardMetrics = data.dashboardMetrics.data;
    if (!dashboardMetrics) {
      this.drawNoData(ctx, headerHeight);
      this.drawConnectionStatus(ctx, data);
      return;
    }

    const { pipeline } = dashboardMetrics;
    const { width, height } = this.displayConfig;
    const padding = this.SCREEN_MARGIN;
    const contentY = headerHeight + 40;
    const contentHeight = height - contentY - padding;

    // Summary at top
    this.drawSummary(ctx, pipeline.totalProjects, pipeline.totalRevenue, padding, contentY, width - padding * 2);

    // Main pipeline visualization
    const pipelineY = contentY + 150;
    const pipelineHeight = contentHeight - 200;
    this.drawPipeline(ctx, pipeline.statuses, padding, pipelineY, width - padding * 2, pipelineHeight);

    // Draw connection status indicator if not connected
    this.drawConnectionStatus(ctx, data);
  }

  private drawNoData(ctx: SKRSContext2D, headerHeight: number): void {
    drawText(ctx, 'Loading pipeline data...', this.displayConfig.width / 2, headerHeight + 200, {
      font: this.displayConfig.fontFamily,
      size: 64,
      color: hexToRgba(colors.white, 0.5),
      align: 'center',
    });
  }

  private drawSummary(ctx: SKRSContext2D, totalProjects: number, totalRevenue: number, x: number, y: number, width: number): void {
    const centerX = x + width / 2;
    // Use proportional spacing to prevent overlap
    const sectionOffset = Math.min(300, width * 0.2);

    // Total projects - left section
    drawText(ctx, totalProjects.toString(), centerX - sectionOffset, y + 50, {
      font: this.displayConfig.fontFamily,
      size: 80,
      weight: 700,
      color: colors.primaryLight,
      align: 'center',
    });

    drawText(ctx, 'Active Projects', centerX - sectionOffset, y + 105, {
      font: this.displayConfig.fontFamily,
      size: this.FONT_SIZE.MINIMUM,
      color: hexToRgba(colors.white, 0.7),
      align: 'center',
    });

    // Divider
    ctx.beginPath();
    ctx.moveTo(centerX, y + 20);
    ctx.lineTo(centerX, y + 110);
    ctx.strokeStyle = hexToRgba(colors.white, 0.3);
    ctx.lineWidth = 3;
    ctx.stroke();

    // Total revenue - right section
    drawText(ctx, `$${this.formatNumber(totalRevenue)}`, centerX + sectionOffset, y + 50, {
      font: this.displayConfig.fontFamily,
      size: 80,
      weight: 700,
      color: colors.success,
      align: 'center',
    });

    drawText(ctx, 'Pipeline Value', centerX + sectionOffset, y + 105, {
      font: this.displayConfig.fontFamily,
      size: this.FONT_SIZE.MINIMUM,
      color: hexToRgba(colors.white, 0.7),
      align: 'center',
    });
  }

  private drawPipeline(
    ctx: SKRSContext2D,
    statuses: { name: string; count: number; revenue: number; color: string; isBottleneck: boolean }[],
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    if (statuses.length === 0) return;

    const stageGap = 12;
    const totalCount = statuses.reduce((sum, s) => sum + s.count, 0);
    const stageWidth = (width - stageGap * (statuses.length - 1)) / statuses.length;

    // Draw connecting flow lines
    this.drawFlowLines(ctx, statuses.length, x, y, width, height, stageWidth, stageGap);

    // Draw each stage
    statuses.forEach((status, index) => {
      const stageX = x + index * (stageWidth + stageGap);
      this.drawStage(ctx, status, stageX, y, stageWidth, height, totalCount);
    });
  }

  private drawFlowLines(
    ctx: SKRSContext2D,
    stageCount: number,
    x: number,
    y: number,
    width: number,
    height: number,
    stageWidth: number,
    stageGap: number
  ): void {
    const arrowY = y + height / 2;

    for (let i = 0; i < stageCount - 1; i++) {
      const startX = x + (i + 1) * stageWidth + i * stageGap;
      const endX = startX + stageGap;

      // Animated dashed line
      ctx.save();
      ctx.setLineDash([10, 10]);
      ctx.lineDashOffset = -this.flowOffset;

      // Draw arrow line
      ctx.beginPath();
      ctx.moveTo(startX + 5, arrowY);
      ctx.lineTo(endX - 15, arrowY);
      ctx.strokeStyle = hexToRgba(colors.primaryLight, 0.4);
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.restore();

      // Arrow head
      ctx.beginPath();
      ctx.moveTo(endX - 15, arrowY - 10);
      ctx.lineTo(endX - 5, arrowY);
      ctx.lineTo(endX - 15, arrowY + 10);
      ctx.strokeStyle = hexToRgba(colors.primaryLight, 0.6);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }

  private drawStage(
    ctx: SKRSContext2D,
    status: { name: string; count: number; revenue: number; color: string; isBottleneck: boolean },
    x: number,
    y: number,
    width: number,
    height: number,
    totalCount: number
  ): void {
    const proportion = totalCount > 0 ? status.count / totalCount : 0;
    const stageHeight = height * 0.75;
    const stageY = y + (height - stageHeight) / 2;

    // Stage background with funnel effect
    const topWidth = width * 0.95;
    const bottomWidth = width * 0.85;
    const heightOffset = 20;

    ctx.beginPath();
    ctx.moveTo(x + (width - topWidth) / 2, stageY);
    ctx.lineTo(x + (width + topWidth) / 2, stageY);
    ctx.lineTo(x + (width + bottomWidth) / 2, stageY + stageHeight);
    ctx.lineTo(x + (width - bottomWidth) / 2, stageY + stageHeight);
    ctx.closePath();

    // Fill with bottleneck highlighting
    const fillColor = status.isBottleneck
      ? hexToRgba(colors.warning, 0.25)
      : hexToRgba(colors.white, 0.08);
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Border
    ctx.strokeStyle = status.isBottleneck
      ? hexToRgba(colors.warning, 0.6)
      : hexToRgba(colors.white, 0.15);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bottleneck glow effect
    if (status.isBottleneck) {
      ctx.save();
      ctx.shadowColor = colors.warning;
      ctx.shadowBlur = 20;
      ctx.strokeStyle = hexToRgba(colors.warning, 0.4);
      ctx.stroke();
      ctx.restore();
    }

    // Fill indicator based on proportion
    const fillHeight = stageHeight * Math.min(proportion * 2, 1);
    const fillY = stageY + stageHeight - fillHeight;

    if (fillHeight > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x + (width - topWidth) / 2, stageY);
      ctx.lineTo(x + (width + topWidth) / 2, stageY);
      ctx.lineTo(x + (width + bottomWidth) / 2, stageY + stageHeight);
      ctx.lineTo(x + (width - bottomWidth) / 2, stageY + stageHeight);
      ctx.closePath();
      ctx.clip();

      const gradient = ctx.createLinearGradient(x, fillY, x, stageY + stageHeight);
      gradient.addColorStop(0, hexToRgba(status.color, 0.6));
      gradient.addColorStop(1, hexToRgba(status.color, 0.3));

      ctx.fillStyle = gradient;
      ctx.fillRect(x, fillY, width, fillHeight);
      ctx.restore();
    }

    // Status name - use LABEL size for readability
    const displayName = status.name.length > 20 ? status.name.substring(0, 18) + '...' : status.name;
    drawText(ctx, displayName.toUpperCase(), x + width / 2, stageY - 30, {
      font: this.displayConfig.fontFamily,
      size: this.FONT_SIZE.LABEL,
      weight: 700,
      color: status.isBottleneck ? colors.warning : colors.white,
      align: 'center',
    });

    // Count (large, centered) - no shadow glow
    drawText(ctx, status.count.toString(), x + width / 2, stageY + stageHeight / 2 - 10, {
      font: this.displayConfig.fontFamily,
      size: 84,
      weight: 700,
      color: status.isBottleneck ? colors.warning : colors.white,
      align: 'center',
      baseline: 'middle',
    });

    // Revenue - larger
    drawText(ctx, `$${this.formatNumber(status.revenue)}`, x + width / 2, stageY + stageHeight / 2 + 60, {
      font: this.displayConfig.fontFamily,
      size: 40,
      color: hexToRgba(colors.white, 0.7),
      align: 'center',
    });

    // Bottleneck indicator - larger
    if (status.isBottleneck) {
      drawText(ctx, '⚠ Bottleneck', x + width / 2, stageY + stageHeight + 40, {
        font: this.displayConfig.fontFamily,
        size: this.FONT_SIZE.MINIMUM,
        weight: 600,
        color: colors.warning,
        align: 'center',
      });
    }
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(0)}K`;
    }
    return num.toLocaleString();
  }
}
