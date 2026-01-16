import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
import { drawText } from '../components/text.js';
import { colors, hexToRgba } from '../components/colors.js';
import {
  getAnimatedNumber,
  drawPulsingGlow,
  drawAnimatedProgressBar,
  formatCurrency,
} from '../components/animations.js';

export class ProjectMetricsSlide extends BaseSlide {
  render(ctx: SKRSContext2D, data: DataCache, deltaTime: number): void {
    // Update animations
    this.updateAnimationState(deltaTime);

    // Draw ambient effects first (behind everything)
    this.drawAmbientEffects(ctx);

    const headerHeight = this.drawMinimalHeader(ctx, this.config.title || 'Project Overview');

    const metrics = data.metrics.data;
    if (!metrics) {
      this.drawNoData(ctx, headerHeight);
      return;
    }

    const { width, height } = this.displayConfig;
    const padding = this.SCREEN_MARGIN;
    const centerY = headerHeight + (height - headerHeight) / 2 - 80;

    // Main hero section - big centered number
    this.drawHeroMetric(ctx, metrics.total, 'Active Projects', width / 2, centerY - 100);

    // Bottom stats row - 4 KPI cards with better spacing
    const cardHeight = 280;
    const cardY = height - cardHeight - padding;
    const cardGap = 50;
    const availableWidth = width - padding * 2;
    const cardWidth = (availableWidth - cardGap * 3) / 4;
    const startX = padding;

    this.drawKPICard(
      ctx,
      getAnimatedNumber(this.animationState, 'completed', metrics.completedThisMonth, 1200),
      'Completed This Month',
      `${metrics.completedThisWeek} this week`,
      startX,
      cardY,
      cardWidth,
      colors.success
    );

    this.drawKPICard(
      ctx,
      getAnimatedNumber(this.animationState, 'upcoming', metrics.upcomingDeadlines, 1400),
      'Due This Week',
      'upcoming deadlines',
      startX + cardWidth + cardGap,
      cardY,
      cardWidth,
      colors.warning
    );

    this.drawKPICard(
      ctx,
      getAnimatedNumber(this.animationState, 'overdue', metrics.overdueCount, 1600),
      'Overdue',
      'past deadline',
      startX + (cardWidth + cardGap) * 2,
      cardY,
      cardWidth,
      metrics.overdueCount > 0 ? colors.error : colors.success
    );

    // Status breakdown mini-visualization
    this.drawStatusMini(ctx, metrics.byStatus, startX + (cardWidth + cardGap) * 3, cardY, cardWidth);
  }

  private drawNoData(ctx: SKRSContext2D, headerHeight: number): void {
    drawText(ctx, 'Loading metrics...', this.displayConfig.width / 2, headerHeight + 300, {
      font: this.displayConfig.fontFamily,
      size: 48,
      color: hexToRgba(colors.white, 0.5),
      align: 'center',
    });
  }

  private drawHeroMetric(
    ctx: SKRSContext2D,
    value: number,
    label: string,
    x: number,
    y: number
  ): void {
    const animatedValue = getAnimatedNumber(this.animationState, 'heroTotal', value, 2000);

    // Pulsing glow behind the number
    drawPulsingGlow(ctx, x - 300, y - 150, 600, 300, this.animationState.pulsePhase, colors.primary);

    // Giant number
    drawText(ctx, animatedValue.toString(), x, y, {
      font: this.displayConfig.fontFamily,
      size: 280,
      weight: 800,
      color: colors.white,
      align: 'center',
      baseline: 'middle',
    });

    // Label below
    drawText(ctx, label.toUpperCase(), x, y + 170, {
      font: this.displayConfig.fontFamily,
      size: 48,
      weight: 600,
      color: colors.primaryLight,
      align: 'center',
    });

    // Accent underline
    const underlineWidth = 300;
    ctx.beginPath();
    ctx.moveTo(x - underlineWidth / 2, y + 210);
    ctx.lineTo(x + underlineWidth / 2, y + 210);
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  private drawKPICard(
    ctx: SKRSContext2D,
    value: number,
    title: string,
    subtitle: string,
    x: number,
    y: number,
    width: number,
    accentColor: string
  ): void {
    const height = 280;
    const padding = 40;

    // Card background with subtle border
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 16);
    ctx.fillStyle = hexToRgba(colors.white, 0.08);
    ctx.fill();

    // Accent top border - thicker
    ctx.beginPath();
    ctx.moveTo(x + 16, y);
    ctx.lineTo(x + width - 16, y);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 5;
    ctx.stroke();

    // Large number - bigger
    drawText(ctx, value.toString(), x + padding, y + 100, {
      font: this.displayConfig.fontFamily,
      size: 96,
      weight: 700,
      color: accentColor,
    });

    // Title - larger
    drawText(ctx, title, x + padding, y + 180, {
      font: this.displayConfig.fontFamily,
      size: 36,
      weight: 600,
      color: colors.white,
    });

    // Subtitle - larger
    drawText(ctx, subtitle, x + padding, y + 230, {
      font: this.displayConfig.fontFamily,
      size: 28,
      color: hexToRgba(colors.white, 0.7),
    });
  }

  private drawStatusMini(
    ctx: SKRSContext2D,
    byStatus: { status_name: string; status_color: string; count: number }[],
    x: number,
    y: number,
    width: number
  ): void {
    const height = 280;
    const padding = 40;

    // Card background
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 16);
    ctx.fillStyle = hexToRgba(colors.white, 0.08);
    ctx.fill();

    // Accent border - thicker
    ctx.beginPath();
    ctx.moveTo(x + 16, y);
    ctx.lineTo(x + width - 16, y);
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 5;
    ctx.stroke();

    // Title - larger
    drawText(ctx, 'By Status', x + padding, y + 50, {
      font: this.displayConfig.fontFamily,
      size: 36,
      weight: 600,
      color: colors.white,
    });

    // Status bars - larger
    const barStartY = y + 80;
    const barHeight = 36;
    const barGap = 10;
    const maxCount = Math.max(...byStatus.map(s => s.count), 1);
    const barWidth = width - padding * 2;

    byStatus.slice(0, 4).forEach((status, index) => {
      const itemY = barStartY + index * (barHeight + barGap);

      // Progress bar
      drawAnimatedProgressBar(
        ctx,
        x + padding,
        itemY,
        barWidth,
        barHeight,
        status.count / maxCount,
        this.animationState.pulsePhase,
        {
          fillColor: status.status_color,
          rounded: true,
        }
      );

      // Status name on the bar - larger text
      drawText(ctx, `${status.status_name} (${status.count})`, x + padding + 15, itemY + barHeight / 2, {
        font: this.displayConfig.fontFamily,
        size: 24,
        weight: 600,
        color: colors.white,
        baseline: 'middle',
      });
    });
  }
}
