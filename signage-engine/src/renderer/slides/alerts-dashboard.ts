import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
import { drawText } from '../components/text.js';
import { colors, hexToRgba } from '../components/colors.js';
import { StuckProject, OverdueProject } from '../../data/fetchers/dashboard-metrics.js';

/**
 * Alerts Dashboard Slide
 *
 * Displays project alerts in a split layout:
 * - Left column (red): Overdue projects past their goal date
 * - Right column (amber): Stuck projects (in same status too long)
 *
 * Shows "All Clear" message when no alerts exist.
 *
 * Data source: dashboardMetrics.alerts
 */
export class AlertsDashboardSlide extends BaseSlide {
  render(ctx: SKRSContext2D, data: DataCache, deltaTime: number): void {
    // Update animations
    this.updateAnimationState(deltaTime);

    // Draw ambient effects
    this.drawAmbientEffects(ctx);

    const headerHeight = this.drawMinimalHeader(ctx, this.config.title || 'Alerts');

    const dashboardMetrics = data.dashboardMetrics.data;
    if (!dashboardMetrics) {
      this.drawNoData(ctx, headerHeight);
      this.drawConnectionStatus(ctx, data);
      return;
    }

    const { alerts } = dashboardMetrics;
    const { width, height } = this.displayConfig;
    const padding = this.SCREEN_MARGIN;
    const contentY = headerHeight + 20;
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

    // Draw stale data warning if data is old
    this.drawStaleDataWarning(ctx, data.dashboardMetrics.lastUpdated);

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
    const headerHeight = 140;
    const centerX = x + width / 2;

    // Header background - static, no pulsing
    ctx.beginPath();
    ctx.roundRect(x, y, width, headerHeight, 12);
    ctx.fillStyle = hexToRgba(colors.error, 0.15);
    ctx.fill();

    // Border
    ctx.beginPath();
    ctx.roundRect(x, y, width, headerHeight, 12);
    ctx.strokeStyle = hexToRgba(colors.error, 0.6);
    ctx.lineWidth = 3;
    ctx.stroke();

    // Section title - centered, larger
    drawText(ctx, 'OVERDUE', centerX, y + 55, {
      font: this.displayConfig.fontFamily,
      size: 56,
      weight: 700,
      color: colors.error,
      align: 'center',
    });

    // Count badge - positioned to right of title
    const countBadgeX = x + width - 80;
    ctx.beginPath();
    ctx.arc(countBadgeX, y + 55, 45, 0, Math.PI * 2);
    ctx.fillStyle = colors.error;
    ctx.fill();

    drawText(ctx, total.toString(), countBadgeX, y + 55, {
      font: this.displayConfig.fontFamily,
      size: 52,
      weight: 700,
      color: colors.white,
      align: 'center',
      baseline: 'middle',
    });

    // Total revenue - centered below title
    drawText(ctx, `$${this.formatNumber(totalRevenue)} at risk`, centerX, y + 110, {
      font: this.displayConfig.fontFamily,
      size: 36,
      color: hexToRgba(colors.error, 0.9),
      align: 'center',
    });

    // Project list - fill available height with up to 6 items for larger text
    const listY = y + headerHeight + 20;
    const availableHeight = height - headerHeight - 60;
    const maxItems = Math.min(projects.length, 6);
    const itemHeight = Math.floor(availableHeight / Math.max(maxItems, 1));
    const itemGap = 12;

    projects.slice(0, maxItems).forEach((project, index) => {
      this.drawOverdueItem(ctx, project, x, listY + index * itemHeight, width, itemHeight - itemGap);
    });

    if (total > maxItems) {
      drawText(ctx, `+${total - maxItems} more`, centerX, listY + maxItems * itemHeight + 20, {
        font: this.displayConfig.fontFamily,
        size: 40,
        color: hexToRgba(colors.white, 0.6),
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
    ctx.roundRect(x, y, width, height, 12);
    ctx.fillStyle = hexToRgba(colors.white, 0.05);
    ctx.fill();

    // Left accent bar
    ctx.beginPath();
    ctx.roundRect(x, y, 10, height, [12, 0, 0, 12]);
    ctx.fillStyle = colors.error;
    ctx.fill();

    // Calculate safe widths to prevent text overlap
    const leftPadding = 36;
    const rightPadding = 36;
    const amountWidth = 140; // Reserve space for amount
    const maxNameWidth = width - leftPadding - rightPadding - amountWidth - 20;
    const maxNameChars = Math.floor(maxNameWidth / 28); // Approximate chars that fit

    // Client name - larger for TV readability, truncated to prevent overlap
    drawText(ctx, this.truncateText(project.clientName, maxNameChars), x + leftPadding, y + height * 0.35, {
      font: this.displayConfig.fontFamily,
      size: 48,
      weight: 600,
      color: colors.white,
    });

    // Amount - prominent, right aligned
    drawText(ctx, `$${this.formatNumber(project.salesAmount)}`, x + width - rightPadding, y + height * 0.35, {
      font: this.displayConfig.fontFamily,
      size: 48,
      weight: 700,
      color: colors.error,
      align: 'right',
    });

    // Days overdue - larger
    const daysText = `${project.daysOverdue}d overdue`;
    drawText(ctx, daysText, x + leftPadding, y + height * 0.75, {
      font: this.displayConfig.fontFamily,
      size: 40,
      color: hexToRgba(colors.error, 0.8),
    });

    // Goal date
    drawText(ctx, `Due: ${project.goalDate}`, x + width - rightPadding, y + height * 0.75, {
      font: this.displayConfig.fontFamily,
      size: 40,
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
    const headerHeight = 140;
    const centerX = x + width / 2;

    // Header background - static, no pulsing
    ctx.beginPath();
    ctx.roundRect(x, y, width, headerHeight, 12);
    ctx.fillStyle = hexToRgba(colors.warning, 0.15);
    ctx.fill();

    // Border
    ctx.beginPath();
    ctx.roundRect(x, y, width, headerHeight, 12);
    ctx.strokeStyle = hexToRgba(colors.warning, 0.6);
    ctx.lineWidth = 3;
    ctx.stroke();

    // Section title - centered, larger
    drawText(ctx, 'STUCK PROJECTS', centerX, y + 55, {
      font: this.displayConfig.fontFamily,
      size: 56,
      weight: 700,
      color: colors.warning,
      align: 'center',
    });

    // Count badge - positioned to right of title
    const countBadgeX = x + width - 80;
    ctx.beginPath();
    ctx.arc(countBadgeX, y + 55, 45, 0, Math.PI * 2);
    ctx.fillStyle = colors.warning;
    ctx.fill();

    drawText(ctx, total.toString(), countBadgeX, y + 55, {
      font: this.displayConfig.fontFamily,
      size: 52,
      weight: 700,
      color: colors.black,
      align: 'center',
      baseline: 'middle',
    });

    // Total revenue - centered below title
    drawText(ctx, `$${this.formatNumber(totalRevenue)} blocked`, centerX, y + 110, {
      font: this.displayConfig.fontFamily,
      size: 36,
      color: hexToRgba(colors.warning, 0.9),
      align: 'center',
    });

    // Project list - fill available height with up to 6 items for larger text
    const listY = y + headerHeight + 20;
    const availableHeight = height - headerHeight - 60;
    const maxItems = Math.min(projects.length, 6);
    const itemHeight = Math.floor(availableHeight / Math.max(maxItems, 1));
    const itemGap = 12;

    projects.slice(0, maxItems).forEach((project, index) => {
      this.drawStuckItem(ctx, project, x, listY + index * itemHeight, width, itemHeight - itemGap);
    });

    if (total > maxItems) {
      drawText(ctx, `+${total - maxItems} more`, centerX, listY + maxItems * itemHeight + 20, {
        font: this.displayConfig.fontFamily,
        size: 40,
        color: hexToRgba(colors.white, 0.6),
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
    ctx.roundRect(x, y, width, height, 12);
    ctx.fillStyle = hexToRgba(colors.white, 0.05);
    ctx.fill();

    // Left accent bar
    ctx.beginPath();
    ctx.roundRect(x, y, 10, height, [12, 0, 0, 12]);
    ctx.fillStyle = colors.warning;
    ctx.fill();

    // Calculate safe widths to prevent text overlap
    const leftPadding = 36;
    const rightPadding = 36;
    const amountWidth = 140; // Reserve space for amount
    const maxNameWidth = width - leftPadding - rightPadding - amountWidth - 20;
    const maxNameChars = Math.floor(maxNameWidth / 28); // Approximate chars that fit

    // Client name - larger for TV readability, truncated to prevent overlap
    drawText(ctx, this.truncateText(project.clientName, maxNameChars), x + leftPadding, y + height * 0.35, {
      font: this.displayConfig.fontFamily,
      size: 48,
      weight: 600,
      color: colors.white,
    });

    // Amount - prominent, right aligned
    drawText(ctx, `$${this.formatNumber(project.salesAmount)}`, x + width - rightPadding, y + height * 0.35, {
      font: this.displayConfig.fontFamily,
      size: 48,
      weight: 700,
      color: colors.warning,
      align: 'right',
    });

    // Status name - larger, truncated
    drawText(ctx, this.truncateText(project.statusName, 15), x + leftPadding, y + height * 0.75, {
      font: this.displayConfig.fontFamily,
      size: 40,
      color: hexToRgba(colors.white, 0.6),
    });

    // Days badge - larger
    const daysText = `${project.daysInStatus}d`;
    const badgeWidth = 90;
    const badgeHeight = 48;
    ctx.beginPath();
    ctx.roundRect(x + width - badgeWidth - rightPadding, y + height * 0.55, badgeWidth, badgeHeight, 10);
    ctx.fillStyle = hexToRgba(colors.warning, 0.3);
    ctx.fill();

    drawText(ctx, daysText, x + width - badgeWidth / 2 - rightPadding, y + height * 0.75, {
      font: this.displayConfig.fontFamily,
      size: 40,
      weight: 700,
      color: colors.warning,
      align: 'center',
    });
  }

  // formatNumber and truncateText inherited from BaseSlide
}
