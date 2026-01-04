import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
import { drawText } from '../components/text.js';
import { drawKPICard, drawProgressBar, roundRect } from '../components/charts.js';
import { colors, hexToRgba } from '../components/colors.js';
import { format } from 'date-fns';

export class MonthlyScorecardSlide extends BaseSlide {
  render(ctx: SKRSContext2D, data: DataCache, deltaTime: number): void {
    // Update animations
    this.updateAnimationState(deltaTime);

    // Draw ambient effects
    this.drawAmbientEffects(ctx);

    const currentMonth = format(new Date(), 'MMMM yyyy').toUpperCase();
    const headerHeight = this.drawMinimalHeader(ctx, this.config.title || `${currentMonth} SCORECARD`);

    const revenue = data.revenue.data;
    const metrics = data.metrics.data;

    if (!revenue && !metrics) {
      this.drawEmptyState(ctx, headerHeight);
      return;
    }

    const padding = 80;
    const gap = 40;
    const contentY = headerHeight + 50;

    // Calculate layout
    const sectionWidth = (this.displayConfig.width - padding * 2 - gap) / 2;

    // Left side: Revenue metrics (large and prominent)
    this.drawRevenueSection(ctx, revenue, padding, contentY, sectionWidth);

    // Right side: Project metrics
    this.drawProjectMetricsSection(ctx, metrics, padding + sectionWidth + gap, contentY, sectionWidth);
  }

  private drawEmptyState(ctx: SKRSContext2D, headerHeight: number): void {
    const centerX = this.displayConfig.width / 2;
    const centerY = (this.displayConfig.height + headerHeight) / 2;

    drawText(ctx, 'Loading scorecard data...', centerX, centerY, {
      font: this.displayConfig.fontFamily,
      size: 48,
      color: 'rgba(255, 255, 255, 0.5)',
      align: 'center',
      baseline: 'middle',
    });
  }

  private drawRevenueSection(
    ctx: SKRSContext2D,
    revenue: DataCache['revenue']['data'],
    x: number,
    y: number,
    width: number
  ): void {
    const sectionHeight = this.displayConfig.height - y - 80;

    // Section background
    roundRect(ctx, x, y, width, sectionHeight, 20);
    ctx.fillStyle = hexToRgba(colors.primary, 0.15);
    ctx.fill();

    // Section header
    drawText(ctx, 'REVENUE', x + 40, y + 50, {
      font: this.displayConfig.fontFamily,
      size: 28,
      weight: 600,
      color: colors.primaryLight,
      letterSpacing: 4,
    });

    const innerPadding = 40;
    const innerY = y + 100;
    const cardHeight = (sectionHeight - 150) / 2 - 20;

    if (revenue) {
      // POs Received - Main metric (top)
      const posProgress = revenue.currentMonthGoal > 0
        ? (revenue.currentMonthRevenue / revenue.currentMonthGoal * 100)
        : 0;
      const posOnTrack = posProgress >= 80;

      this.drawLargeMetricCard(
        ctx,
        'POs RECEIVED',
        `$${this.formatValue(revenue.currentMonthRevenue)}`,
        `Goal: $${this.formatValue(revenue.currentMonthGoal)}`,
        posProgress,
        posOnTrack,
        x + innerPadding,
        innerY,
        width - innerPadding * 2,
        cardHeight
      );

      // Invoiced - Second metric (bottom)
      // Note: Using a calculated value for now - would need invoiced data
      const invoicedY = innerY + cardHeight + 30;
      const ytdProgress = revenue.yearToDateGoal > 0
        ? (revenue.yearToDateRevenue / revenue.yearToDateGoal * 100)
        : 0;

      this.drawLargeMetricCard(
        ctx,
        'YEAR TO DATE',
        `$${this.formatValue(revenue.yearToDateRevenue)}`,
        `Goal: $${this.formatValue(revenue.yearToDateGoal)}`,
        ytdProgress,
        ytdProgress >= 80,
        x + innerPadding,
        invoicedY,
        width - innerPadding * 2,
        cardHeight
      );
    }
  }

  private drawProjectMetricsSection(
    ctx: SKRSContext2D,
    metrics: DataCache['metrics']['data'],
    x: number,
    y: number,
    width: number
  ): void {
    const sectionHeight = this.displayConfig.height - y - 80;

    // Section background
    roundRect(ctx, x, y, width, sectionHeight, 20);
    ctx.fillStyle = hexToRgba(colors.info, 0.1);
    ctx.fill();

    // Section header
    drawText(ctx, 'PROJECTS', x + 40, y + 50, {
      font: this.displayConfig.fontFamily,
      size: 28,
      weight: 600,
      color: colors.info,
      letterSpacing: 4,
    });

    const innerPadding = 40;
    const innerY = y + 100;

    if (metrics) {
      // 2x2 grid of KPI cards
      const cardWidth = (width - innerPadding * 3) / 2;
      const cardHeight = (sectionHeight - 180) / 2;
      const gap = innerPadding;

      // Completed This Month
      drawKPICard(
        ctx,
        'Completed',
        metrics.completedThisMonth.toString(),
        'This Month',
        x + innerPadding,
        innerY,
        cardWidth,
        cardHeight,
        {
          backgroundColor: hexToRgba(colors.success, 0.2),
          valueColor: colors.success,
        }
      );

      // Active Projects
      drawKPICard(
        ctx,
        'Active',
        metrics.total.toString(),
        'Total Projects',
        x + innerPadding + cardWidth + gap,
        innerY,
        cardWidth,
        cardHeight,
        {
          backgroundColor: hexToRgba(colors.info, 0.2),
          valueColor: colors.info,
        }
      );

      // Upcoming Deadlines
      drawKPICard(
        ctx,
        'Due Soon',
        metrics.upcomingDeadlines.toString(),
        'Next 7 Days',
        x + innerPadding,
        innerY + cardHeight + gap,
        cardWidth,
        cardHeight,
        {
          backgroundColor: hexToRgba(colors.warning, 0.2),
          valueColor: colors.warning,
        }
      );

      // Overdue
      drawKPICard(
        ctx,
        'Overdue',
        metrics.overdueCount.toString(),
        'Needs Attention',
        x + innerPadding + cardWidth + gap,
        innerY + cardHeight + gap,
        cardWidth,
        cardHeight,
        {
          backgroundColor: hexToRgba(metrics.overdueCount > 0 ? colors.error : colors.success, 0.2),
          valueColor: metrics.overdueCount > 0 ? colors.error : colors.success,
        }
      );
    }
  }

  private drawLargeMetricCard(
    ctx: SKRSContext2D,
    title: string,
    value: string,
    subtitle: string,
    progress: number,
    isOnTrack: boolean,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const borderRadius = 16;

    // Card background
    roundRect(ctx, x, y, width, height, borderRadius);
    ctx.fillStyle = hexToRgba(colors.white, 0.08);
    ctx.fill();

    const padding = 30;

    // Title
    drawText(ctx, title, x + padding, y + padding + 20, {
      font: this.displayConfig.fontFamily,
      size: 24,
      weight: 600,
      color: 'rgba(255, 255, 255, 0.7)',
      letterSpacing: 2,
    });

    // Large value
    drawText(ctx, value, x + padding, y + height / 2 + 15, {
      font: this.displayConfig.fontFamily,
      size: 72,
      weight: 700,
      color: colors.white,
    });

    // Progress bar
    const progressY = y + height - padding - 50;
    drawProgressBar(
      ctx,
      Math.min(progress, 100),
      100,
      x + padding,
      progressY,
      width - padding * 2,
      24,
      {
        fillColor: isOnTrack ? colors.success : colors.warning,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 8,
      }
    );

    // Progress percentage and subtitle
    drawText(ctx, `${Math.round(progress)}%`, x + width - padding, progressY + 12, {
      font: this.displayConfig.fontFamily,
      size: 24,
      weight: 600,
      color: isOnTrack ? colors.success : colors.warning,
      align: 'right',
      baseline: 'middle',
    });

    drawText(ctx, subtitle, x + padding, y + height - padding - 10, {
      font: this.displayConfig.fontFamily,
      size: 20,
      color: 'rgba(255, 255, 255, 0.5)',
    });
  }

  private formatValue(value: number): string {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return value.toLocaleString();
  }
}
