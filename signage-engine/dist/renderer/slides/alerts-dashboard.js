import { BaseSlide } from './base-slide.js';
import { drawText } from '../components/text.js';
import { colors, hexToRgba } from '../components/colors.js';
export class AlertsDashboardSlide extends BaseSlide {
    render(ctx, data, deltaTime) {
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
        // Draw connection status indicator if not connected
        this.drawConnectionStatus(ctx, data);
    }
    drawNoData(ctx, headerHeight) {
        drawText(ctx, 'Loading alerts...', this.displayConfig.width / 2, headerHeight + 200, {
            font: this.displayConfig.fontFamily,
            size: 64,
            color: hexToRgba(colors.white, 0.5),
            align: 'center',
        });
    }
    drawAllClear(ctx, contentY, contentHeight) {
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
    drawOverdueSection(ctx, projects, total, totalRevenue, x, y, width, height) {
        // Header background - static, no pulsing
        ctx.beginPath();
        ctx.roundRect(x, y, width, 120, 12);
        ctx.fillStyle = hexToRgba(colors.error, 0.15);
        ctx.fill();
        // Border
        ctx.beginPath();
        ctx.roundRect(x, y, width, 120, 12);
        ctx.strokeStyle = hexToRgba(colors.error, 0.6);
        ctx.lineWidth = 3;
        ctx.stroke();
        // Section title - larger
        drawText(ctx, 'OVERDUE', x + 40, y + 50, {
            font: this.displayConfig.fontFamily,
            size: 48,
            weight: 700,
            color: colors.error,
        });
        // Count badge - larger
        const countBadgeX = x + width - 100;
        ctx.beginPath();
        ctx.arc(countBadgeX, y + 60, 50, 0, Math.PI * 2);
        ctx.fillStyle = colors.error;
        ctx.fill();
        drawText(ctx, total.toString(), countBadgeX, y + 60, {
            font: this.displayConfig.fontFamily,
            size: 56,
            weight: 700,
            color: colors.white,
            align: 'center',
            baseline: 'middle',
        });
        // Total revenue - larger
        drawText(ctx, `$${this.formatNumber(totalRevenue)} at risk`, x + 40, y + 95, {
            font: this.displayConfig.fontFamily,
            size: 32,
            color: hexToRgba(colors.error, 0.9),
        });
        // Project list - fill available height with up to 8 items
        const listY = y + 140;
        const availableHeight = height - 180; // Leave room for "+X more" text
        const maxItems = Math.min(projects.length, 8);
        const itemHeight = Math.floor(availableHeight / maxItems);
        const itemGap = 8;
        projects.slice(0, maxItems).forEach((project, index) => {
            this.drawOverdueItem(ctx, project, x, listY + index * itemHeight, width, itemHeight - itemGap);
        });
        if (total > maxItems) {
            drawText(ctx, `+${total - maxItems} more`, x + width / 2, listY + maxItems * itemHeight + 20, {
                font: this.displayConfig.fontFamily,
                size: 36,
                color: hexToRgba(colors.white, 0.6),
                align: 'center',
            });
        }
    }
    drawOverdueItem(ctx, project, x, y, width, height) {
        // Item background
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 10);
        ctx.fillStyle = hexToRgba(colors.white, 0.05);
        ctx.fill();
        // Left accent bar
        ctx.beginPath();
        ctx.roundRect(x, y, 8, height, [10, 0, 0, 10]);
        ctx.fillStyle = colors.error;
        ctx.fill();
        // Client name - larger for TV readability
        drawText(ctx, this.truncateText(project.clientName, 20), x + 28, y + height * 0.32, {
            font: this.displayConfig.fontFamily,
            size: 44,
            weight: 600,
            color: colors.white,
        });
        // Amount - prominent
        drawText(ctx, `$${this.formatNumber(project.salesAmount)}`, x + width - 28, y + height * 0.32, {
            font: this.displayConfig.fontFamily,
            size: 44,
            weight: 700,
            color: colors.error,
            align: 'right',
        });
        // Days overdue - minimum 36px per DESIGN.md
        const daysText = `${project.daysOverdue}d overdue`;
        drawText(ctx, daysText, x + 28, y + height * 0.72, {
            font: this.displayConfig.fontFamily,
            size: 36,
            color: hexToRgba(colors.error, 0.8),
        });
        // Goal date
        drawText(ctx, `Due: ${project.goalDate}`, x + width - 28, y + height * 0.72, {
            font: this.displayConfig.fontFamily,
            size: 36,
            color: hexToRgba(colors.white, 0.5),
            align: 'right',
        });
    }
    drawStuckSection(ctx, projects, total, totalRevenue, x, y, width, height) {
        // Header background - static, no pulsing
        ctx.beginPath();
        ctx.roundRect(x, y, width, 120, 12);
        ctx.fillStyle = hexToRgba(colors.warning, 0.15);
        ctx.fill();
        // Border
        ctx.beginPath();
        ctx.roundRect(x, y, width, 120, 12);
        ctx.strokeStyle = hexToRgba(colors.warning, 0.6);
        ctx.lineWidth = 3;
        ctx.stroke();
        // Section title - larger
        drawText(ctx, 'STUCK PROJECTS', x + 40, y + 50, {
            font: this.displayConfig.fontFamily,
            size: 48,
            weight: 700,
            color: colors.warning,
        });
        // Count badge - larger
        const countBadgeX = x + width - 100;
        ctx.beginPath();
        ctx.arc(countBadgeX, y + 60, 50, 0, Math.PI * 2);
        ctx.fillStyle = colors.warning;
        ctx.fill();
        drawText(ctx, total.toString(), countBadgeX, y + 60, {
            font: this.displayConfig.fontFamily,
            size: 56,
            weight: 700,
            color: colors.black,
            align: 'center',
            baseline: 'middle',
        });
        // Total revenue - larger
        drawText(ctx, `$${this.formatNumber(totalRevenue)} blocked`, x + 40, y + 95, {
            font: this.displayConfig.fontFamily,
            size: 32,
            color: hexToRgba(colors.warning, 0.9),
        });
        // Project list - fill available height with up to 8 items
        const listY = y + 140;
        const availableHeight = height - 180;
        const maxItems = Math.min(projects.length, 8);
        const itemHeight = Math.floor(availableHeight / maxItems);
        const itemGap = 8;
        projects.slice(0, maxItems).forEach((project, index) => {
            this.drawStuckItem(ctx, project, x, listY + index * itemHeight, width, itemHeight - itemGap);
        });
        if (total > maxItems) {
            drawText(ctx, `+${total - maxItems} more`, x + width / 2, listY + maxItems * itemHeight + 20, {
                font: this.displayConfig.fontFamily,
                size: 36,
                color: hexToRgba(colors.white, 0.6),
                align: 'center',
            });
        }
    }
    drawStuckItem(ctx, project, x, y, width, height) {
        // Item background
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 10);
        ctx.fillStyle = hexToRgba(colors.white, 0.05);
        ctx.fill();
        // Left accent bar
        ctx.beginPath();
        ctx.roundRect(x, y, 8, height, [10, 0, 0, 10]);
        ctx.fillStyle = colors.warning;
        ctx.fill();
        // Client name - larger for TV readability
        drawText(ctx, this.truncateText(project.clientName, 20), x + 28, y + height * 0.32, {
            font: this.displayConfig.fontFamily,
            size: 44,
            weight: 600,
            color: colors.white,
        });
        // Amount - prominent
        drawText(ctx, `$${this.formatNumber(project.salesAmount)}`, x + width - 28, y + height * 0.32, {
            font: this.displayConfig.fontFamily,
            size: 44,
            weight: 700,
            color: colors.warning,
            align: 'right',
        });
        // Status name - minimum 36px per DESIGN.md
        drawText(ctx, project.statusName, x + 28, y + height * 0.72, {
            font: this.displayConfig.fontFamily,
            size: 36,
            color: hexToRgba(colors.white, 0.6),
        });
        // Days badge
        const daysText = `${project.daysInStatus}d`;
        const badgeWidth = 80;
        ctx.beginPath();
        ctx.roundRect(x + width - badgeWidth - 28, y + height * 0.58, badgeWidth, 40, 8);
        ctx.fillStyle = hexToRgba(colors.warning, 0.3);
        ctx.fill();
        drawText(ctx, daysText, x + width - badgeWidth / 2 - 28, y + height * 0.72, {
            font: this.displayConfig.fontFamily,
            size: 36,
            weight: 700,
            color: colors.warning,
            align: 'center',
        });
    }
    formatNumber(num) {
        if (num >= 1000000) {
            return `${(num / 1000000).toFixed(1)}M`;
        }
        else if (num >= 1000) {
            return `${(num / 1000).toFixed(0)}K`;
        }
        return num.toLocaleString();
    }
    truncateText(text, maxLength) {
        if (text.length <= maxLength)
            return text;
        return text.substring(0, maxLength - 3) + '...';
    }
}
//# sourceMappingURL=alerts-dashboard.js.map