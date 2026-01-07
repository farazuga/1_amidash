import { BaseSlide } from './base-slide.js';
import { drawText } from '../components/text.js';
import { colors, hexToRgba } from '../components/colors.js';
import { getAnimatedNumber, drawPulsingGlow, drawAnimatedProgressBar, } from '../components/animations.js';
export class ProjectMetricsSlide extends BaseSlide {
    render(ctx, data, deltaTime) {
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
        const centerY = headerHeight + (height - headerHeight) / 2;
        // Main hero section - big centered number
        this.drawHeroMetric(ctx, metrics.total, 'Active Projects', width / 2, centerY - 150);
        // Bottom stats row - 4 KPI cards
        const cardY = height - 320;
        const cardWidth = (width - 200) / 4;
        const cardGap = 40;
        const startX = 100;
        this.drawKPICard(ctx, getAnimatedNumber(this.animationState, 'completed', metrics.completedThisMonth, 1200), 'Completed This Month', `${metrics.completedThisWeek} this week`, startX, cardY, cardWidth - cardGap, colors.success);
        this.drawKPICard(ctx, getAnimatedNumber(this.animationState, 'upcoming', metrics.upcomingDeadlines, 1400), 'Due This Week', 'upcoming deadlines', startX + cardWidth, cardY, cardWidth - cardGap, colors.warning);
        this.drawKPICard(ctx, getAnimatedNumber(this.animationState, 'overdue', metrics.overdueCount, 1600), 'Overdue', 'past deadline', startX + cardWidth * 2, cardY, cardWidth - cardGap, metrics.overdueCount > 0 ? colors.error : colors.success);
        // Status breakdown mini-visualization
        this.drawStatusMini(ctx, metrics.byStatus, startX + cardWidth * 3, cardY, cardWidth - cardGap);
    }
    drawNoData(ctx, headerHeight) {
        drawText(ctx, 'Loading metrics...', this.displayConfig.width / 2, headerHeight + 300, {
            font: this.displayConfig.fontFamily,
            size: 48,
            color: hexToRgba(colors.white, 0.5),
            align: 'center',
        });
    }
    drawHeroMetric(ctx, value, label, x, y) {
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
            letterSpacing: 8,
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
    drawKPICard(ctx, value, title, subtitle, x, y, width, accentColor) {
        const height = 220;
        const padding = 30;
        // Card background with subtle border
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 16);
        ctx.fillStyle = hexToRgba(colors.white, 0.05);
        ctx.fill();
        // Accent top border
        ctx.beginPath();
        ctx.moveTo(x + 16, y);
        ctx.lineTo(x + width - 16, y);
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 3;
        ctx.stroke();
        // Large number
        drawText(ctx, value.toString(), x + padding, y + 80, {
            font: this.displayConfig.fontFamily,
            size: 72,
            weight: 700,
            color: accentColor,
        });
        // Title
        drawText(ctx, title, x + padding, y + 140, {
            font: this.displayConfig.fontFamily,
            size: 24,
            weight: 600,
            color: colors.white,
        });
        // Subtitle
        drawText(ctx, subtitle, x + padding, y + 175, {
            font: this.displayConfig.fontFamily,
            size: 18,
            color: hexToRgba(colors.white, 0.6),
        });
    }
    drawStatusMini(ctx, byStatus, x, y, width) {
        const height = 220;
        const padding = 25;
        // Card background
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 16);
        ctx.fillStyle = hexToRgba(colors.white, 0.05);
        ctx.fill();
        // Accent border
        ctx.beginPath();
        ctx.moveTo(x + 16, y);
        ctx.lineTo(x + width - 16, y);
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 3;
        ctx.stroke();
        // Title
        drawText(ctx, 'By Status', x + padding, y + 35, {
            font: this.displayConfig.fontFamily,
            size: 20,
            weight: 600,
            color: colors.white,
        });
        // Status bars
        const barStartY = y + 55;
        const barHeight = 24;
        const barGap = 8;
        const maxCount = Math.max(...byStatus.map(s => s.count), 1);
        const barWidth = width - padding * 2;
        byStatus.slice(0, 5).forEach((status, index) => {
            const itemY = barStartY + index * (barHeight + barGap);
            const fillWidth = (status.count / maxCount) * barWidth;
            // Animated progress bar
            drawAnimatedProgressBar(ctx, x + padding, itemY, barWidth, barHeight, status.count / maxCount, this.animationState.pulsePhase, {
                fillColor: status.status_color,
                glowColor: status.status_color,
                rounded: true,
            });
            // Status name on the bar
            drawText(ctx, `${status.status_name} (${status.count})`, x + padding + 10, itemY + barHeight / 2, {
                font: this.displayConfig.fontFamily,
                size: 14,
                weight: 600,
                color: colors.white,
                baseline: 'middle',
            });
        });
    }
}
//# sourceMappingURL=project-metrics.js.map