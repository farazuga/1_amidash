import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
import { drawText } from '../components/text.js';
import { colors, hexToRgba } from '../components/colors.js';
import { StuckProject, OverdueProject } from '../../data/fetchers/dashboard-metrics.js';

export class AlertsDashboardSlide extends BaseSlide {
  private pulsePhase = 0;

  render(ctx: SKRSContext2D, data: DataCache, deltaTime: number): void {
    // Update animations
    this.updateAnimationState(deltaTime);
    this.pulsePhase += deltaTime * 3;

    // Draw ambient effects
    this.drawAmbientEffects(ctx);

    const headerHeight = this.drawMinimalHeader(ctx, this.config.title || 'Attention Required');

    const dashboardMetrics = data.dashboardMetrics.data;
    if (!dashboardMetrics) {
      this.drawNoData(ctx, headerHeight);
      this.drawConnectionStatus(ctx, data);
      return;
    }

    const { alerts } = dashboardMetrics;
    const { width, height } = this.displayConfig;
    const padding = 80;
    const contentY = headerHeight + 40;
    const contentHeight = height - contentY - padding;

    if (!alerts.hasAlerts) {
      this.drawAllClear(ctx, contentY, contentHeight);
      this.drawConnectionStatus(ctx, data);
      return;
    }

    // Split layout: left = overdue (red), right = stuck (amber)
    const columnWidth = (width - padding * 3) / 2;
    const leftX = padding;
    const rightX = padding * 2 + columnWidth;

    // Draw overdue section
    this.drawOverdueSection(ctx, alerts.overdueProjects, alerts.totalOverdue, alerts.overdueRevenue, leftX, contentY, columnWidth, contentHeight);

    // Draw stuck section
    this.drawStuckSection(ctx, alerts.stuckProjects, alerts.totalStuck, alerts.stuckRevenue, rightX, contentY, columnWidth, contentHeight);

    // Draw center divider
    const dividerX = leftX + columnWidth + padding / 2;
    ctx.beginPath();
    ctx.moveTo(dividerX, contentY);
    ctx.lineTo(dividerX, contentY + contentHeight);
    ctx.strokeStyle = hexToRgba(colors.white, 0.1);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw connection status indicator if not connected
    this.drawConnectionStatus(ctx, data);
  }

  private drawNoData(ctx: SKRSContext2D, headerHeight: number): void {
    drawText(ctx, 'Loading alerts...', this.displayConfig.width / 2, headerHeight + 200, {
      font: this.displayConfig.fontFamily,
      size: 64,
      color: hexToRgba(colors.white, 0.5),
      align: 'center',
    });
  }

  private drawAllClear(ctx: SKRSContext2D, contentY: number, contentHeight: number): void {
    const { width } = this.displayConfig;
    const centerX = width / 2;
    const centerY = contentY + contentHeight / 2;

    // Large checkmark circle with glow
    const circleRadius = 150;

    ctx.save();
    ctx.shadowColor = colors.success;
    ctx.shadowBlur = 40;

    ctx.beginPath();
    ctx.arc(centerX, centerY - 50, circleRadius, 0, Math.PI * 2);
    ctx.strokeStyle = colors.success;
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.restore();

    // Checkmark
    ctx.beginPath();
    ctx.moveTo(centerX - 60, centerY - 50);
    ctx.lineTo(centerX - 10, centerY);
    ctx.lineTo(centerX + 70, centerY - 100);
    ctx.strokeStyle = colors.success;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // "All Clear" text
    drawText(ctx, 'ALL CLEAR', centerX, centerY + circleRadius + 20, {
      font: this.displayConfig.fontFamily,
      size: 72,
      weight: 700,
      color: colors.success,
      align: 'center',
      letterSpacing: 6,
    });

    // Subtitle
    drawText(ctx, 'No overdue or stuck projects', centerX, centerY + circleRadius + 90, {
      font: this.displayConfig.fontFamily,
      size: 36,
      color: hexToRgba(colors.white, 0.6),
      align: 'center',
    });
  }

  private drawOverdueSection(
    ctx: SKRSContext2D,
    projects: OverdueProject[],
    total: number,
    totalRevenue: number,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    // Section header with pulsing effect
    const pulse = 0.7 + Math.sin(this.pulsePhase) * 0.3;

    // Header background
    ctx.beginPath();
    ctx.roundRect(x, y, width, 100, 12);
    ctx.fillStyle = hexToRgba(colors.error, 0.15 * pulse);
    ctx.fill();

    // Pulsing border
    ctx.save();
    ctx.shadowColor = colors.error;
    ctx.shadowBlur = 20 * pulse;
    ctx.beginPath();
    ctx.roundRect(x, y, width, 100, 12);
    ctx.strokeStyle = hexToRgba(colors.error, 0.8);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Section title and count
    drawText(ctx, 'OVERDUE', x + 30, y + 40, {
      font: this.displayConfig.fontFamily,
      size: 36,
      weight: 700,
      color: colors.error,
      letterSpacing: 3,
    });

    // Count badge
    const countBadgeX = x + width - 120;
    ctx.beginPath();
    ctx.arc(countBadgeX, y + 50, 40, 0, Math.PI * 2);
    ctx.fillStyle = colors.error;
    ctx.fill();

    drawText(ctx, total.toString(), countBadgeX, y + 50, {
      font: this.displayConfig.fontFamily,
      size: 48,
      weight: 700,
      color: colors.white,
      align: 'center',
      baseline: 'middle',
    });

    // Total revenue
    drawText(ctx, `$${this.formatNumber(totalRevenue)} at risk`, x + 30, y + 75, {
      font: this.displayConfig.fontFamily,
      size: 28,
      color: hexToRgba(colors.error, 0.8),
    });

    // Project list
    const listY = y + 130;
    const itemHeight = 100;
    const maxItems = Math.min(projects.length, 4);

    projects.slice(0, maxItems).forEach((project, index) => {
      this.drawOverdueItem(ctx, project, x, listY + index * itemHeight, width, itemHeight - 15);
    });

    if (total > maxItems) {
      drawText(ctx, `+${total - maxItems} more`, x + width / 2, listY + maxItems * itemHeight + 20, {
        font: this.displayConfig.fontFamily,
        size: 28,
        color: hexToRgba(colors.white, 0.5),
        align: 'center',
      });
    }
  }

  private drawOverdueItem(
    ctx: SKRSContext2D,
    project: OverdueProject,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    // Item background
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 8);
    ctx.fillStyle = hexToRgba(colors.white, 0.05);
    ctx.fill();

    // Left accent bar
    ctx.beginPath();
    ctx.roundRect(x, y, 6, height, [8, 0, 0, 8]);
    ctx.fillStyle = colors.error;
    ctx.fill();

    // Client name
    drawText(ctx, this.truncateText(project.clientName, 25), x + 25, y + 30, {
      font: this.displayConfig.fontFamily,
      size: 36,
      weight: 600,
      color: colors.white,
    });

    // Amount
    drawText(ctx, `$${this.formatNumber(project.salesAmount)}`, x + width - 30, y + 30, {
      font: this.displayConfig.fontFamily,
      size: 36,
      weight: 700,
      color: colors.error,
      align: 'right',
    });

    // Days overdue badge
    const daysText = `${project.daysOverdue} days overdue`;
    drawText(ctx, daysText, x + 25, y + 65, {
      font: this.displayConfig.fontFamily,
      size: 26,
      color: hexToRgba(colors.error, 0.8),
    });

    // Goal date
    drawText(ctx, `Due: ${project.goalDate}`, x + width - 30, y + 65, {
      font: this.displayConfig.fontFamily,
      size: 26,
      color: hexToRgba(colors.white, 0.5),
      align: 'right',
    });
  }

  private drawStuckSection(
    ctx: SKRSContext2D,
    projects: StuckProject[],
    total: number,
    totalRevenue: number,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const pulse = 0.7 + Math.sin(this.pulsePhase + 1) * 0.3;

    // Header background
    ctx.beginPath();
    ctx.roundRect(x, y, width, 100, 12);
    ctx.fillStyle = hexToRgba(colors.warning, 0.15 * pulse);
    ctx.fill();

    // Pulsing border
    ctx.save();
    ctx.shadowColor = colors.warning;
    ctx.shadowBlur = 20 * pulse;
    ctx.beginPath();
    ctx.roundRect(x, y, width, 100, 12);
    ctx.strokeStyle = hexToRgba(colors.warning, 0.8);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Section title
    drawText(ctx, 'STUCK PROJECTS', x + 30, y + 40, {
      font: this.displayConfig.fontFamily,
      size: 36,
      weight: 700,
      color: colors.warning,
      letterSpacing: 3,
    });

    // Count badge
    const countBadgeX = x + width - 120;
    ctx.beginPath();
    ctx.arc(countBadgeX, y + 50, 40, 0, Math.PI * 2);
    ctx.fillStyle = colors.warning;
    ctx.fill();

    drawText(ctx, total.toString(), countBadgeX, y + 50, {
      font: this.displayConfig.fontFamily,
      size: 48,
      weight: 700,
      color: colors.black,
      align: 'center',
      baseline: 'middle',
    });

    // Total revenue
    drawText(ctx, `$${this.formatNumber(totalRevenue)} blocked`, x + 30, y + 75, {
      font: this.displayConfig.fontFamily,
      size: 28,
      color: hexToRgba(colors.warning, 0.8),
    });

    // Project list
    const listY = y + 130;
    const itemHeight = 100;
    const maxItems = Math.min(projects.length, 4);

    projects.slice(0, maxItems).forEach((project, index) => {
      this.drawStuckItem(ctx, project, x, listY + index * itemHeight, width, itemHeight - 15);
    });

    if (total > maxItems) {
      drawText(ctx, `+${total - maxItems} more`, x + width / 2, listY + maxItems * itemHeight + 20, {
        font: this.displayConfig.fontFamily,
        size: 28,
        color: hexToRgba(colors.white, 0.5),
        align: 'center',
      });
    }
  }

  private drawStuckItem(
    ctx: SKRSContext2D,
    project: StuckProject,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    // Item background
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 8);
    ctx.fillStyle = hexToRgba(colors.white, 0.05);
    ctx.fill();

    // Left accent bar
    ctx.beginPath();
    ctx.roundRect(x, y, 6, height, [8, 0, 0, 8]);
    ctx.fillStyle = colors.warning;
    ctx.fill();

    // Client name
    drawText(ctx, this.truncateText(project.clientName, 25), x + 25, y + 30, {
      font: this.displayConfig.fontFamily,
      size: 36,
      weight: 600,
      color: colors.white,
    });

    // Amount
    drawText(ctx, `$${this.formatNumber(project.salesAmount)}`, x + width - 30, y + 30, {
      font: this.displayConfig.fontFamily,
      size: 36,
      weight: 700,
      color: colors.warning,
      align: 'right',
    });

    // Status and days stuck
    drawText(ctx, project.statusName, x + 25, y + 65, {
      font: this.displayConfig.fontFamily,
      size: 26,
      color: hexToRgba(colors.white, 0.6),
    });

    // Days badge
    const daysText = `${project.daysInStatus}d`;
    const badgeWidth = 70;
    ctx.beginPath();
    ctx.roundRect(x + width - badgeWidth - 20, y + 50, badgeWidth, 30, 6);
    ctx.fillStyle = hexToRgba(colors.warning, 0.3);
    ctx.fill();

    drawText(ctx, daysText, x + width - badgeWidth / 2 - 20, y + 65, {
      font: this.displayConfig.fontFamily,
      size: 24,
      weight: 700,
      color: colors.warning,
      align: 'center',
    });
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(0)}K`;
    }
    return num.toLocaleString();
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
}
