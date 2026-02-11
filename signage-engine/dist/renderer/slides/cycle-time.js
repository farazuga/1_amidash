import { BaseSlide } from './base-slide.js';
import { drawText } from '../components/text.js';
import { colors, hexToRgba } from '../components/colors.js';
/**
 * Cycle Time Analysis Slide
 *
 * Displays average time projects spend in each workflow stage.
 * Shows horizontal bars for each status with average days.
 * Helps identify slow stages in the project workflow.
 *
 * Data source: dashboardMetrics.cycleTime
 */
export class CycleTimeSlide extends BaseSlide {
    render(ctx, data, deltaTime) {
        this.updateAnimationState(deltaTime);
        this.drawAmbientEffects(ctx);
        const headerHeight = this.drawMinimalHeader(ctx, this.config.title || 'Cycle Time Analysis');
        const dashboardMetrics = data.dashboardMetrics.data;
        if (!dashboardMetrics) {
            this.drawNoData(ctx, headerHeight);
            this.drawConnectionStatus(ctx, data);
            return;
        }
        const { cycleTime } = dashboardMetrics;
        const { width, height } = this.displayConfig;
        const padding = this.SCREEN_MARGIN;
        const contentY = headerHeight + 40;
        // Use SAFE_AREA.bottom to account for connection banner
        const contentHeight = height - contentY - this.SAFE_AREA.bottom - 40;
        // Total cycle time summary
        this.drawTotalCycleTime(ctx, cycleTime.totalAvgCycleTime, padding, contentY, width - padding * 2);
        // Horizontal bar chart of status cycle times
        const chartY = contentY + 160;
        const chartHeight = contentHeight - 160;
        this.drawCycleTimeChart(ctx, cycleTime.statuses, padding, chartY, width - padding * 2, chartHeight);
        // Draw connection status indicator if not connected
        this.drawConnectionStatus(ctx, data);
    }
    drawNoData(ctx, headerHeight) {
        drawText(ctx, 'Loading cycle time data...', this.displayConfig.width / 2, headerHeight + 200, {
            font: this.displayConfig.fontFamily,
            size: 64,
            color: hexToRgba(colors.white, 0.5),
            align: 'center',
        });
    }
    drawTotalCycleTime(ctx, totalDays, x, y, width) {
        const centerX = x + width / 2;
        // Background card - larger
        const cardWidth = 800;
        const cardHeight = 140;
        const cardX = centerX - cardWidth / 2;
        ctx.beginPath();
        ctx.roundRect(cardX, y, cardWidth, cardHeight, 20);
        ctx.fillStyle = hexToRgba(colors.white, 0.08);
        ctx.fill();
        // Total days value - no shadow/glow
        drawText(ctx, totalDays.toString(), centerX - 120, y + cardHeight / 2, {
            font: this.displayConfig.fontFamily,
            size: 96,
            weight: 700,
            color: colors.primaryLight,
            align: 'right',
            baseline: 'middle',
        });
        // Label - larger
        drawText(ctx, 'days', centerX - 80, y + cardHeight / 2 - 18, {
            font: this.displayConfig.fontFamily,
            size: 40,
            color: hexToRgba(colors.white, 0.7),
            baseline: 'middle',
        });
        drawText(ctx, 'avg total cycle', centerX - 80, y + cardHeight / 2 + 24, {
            font: this.displayConfig.fontFamily,
            size: this.FONT_SIZE.MINIMUM,
            color: hexToRgba(colors.white, 0.6),
            baseline: 'middle',
        });
        // Description on right side - larger
        drawText(ctx, 'Average time from PO receipt', centerX + 150, y + cardHeight / 2 - 18, {
            font: this.displayConfig.fontFamily,
            size: this.FONT_SIZE.MINIMUM,
            color: hexToRgba(colors.white, 0.6),
            baseline: 'middle',
        });
        drawText(ctx, 'to project completion', centerX + 150, y + cardHeight / 2 + 18, {
            font: this.displayConfig.fontFamily,
            size: this.FONT_SIZE.MINIMUM,
            color: hexToRgba(colors.white, 0.6),
            baseline: 'middle',
        });
    }
    drawCycleTimeChart(ctx, statuses, x, y, width, height) {
        if (statuses.length === 0)
            return;
        const labelWidth = 320;
        const valueWidth = 120;
        const chartWidth = width - labelWidth - valueWidth;
        const chartX = x + labelWidth;
        // Reserve space for X-axis labels (55px) and legend (60px) at bottom
        const bottomPadding = 120;
        const barHeight = Math.min(90, (height - bottomPadding) / statuses.length);
        const barGap = 18;
        const maxDays = Math.max(...statuses.map((s) => s.avgDays), 1);
        // Calculate bar area height (excludes bottom padding for labels)
        const barAreaHeight = height - bottomPadding;
        // Draw grid lines
        const gridLines = 5;
        for (let i = 0; i <= gridLines; i++) {
            const lineX = chartX + (i / gridLines) * chartWidth;
            const value = Math.round((maxDays * i) / gridLines);
            // Grid line - only extends to bar area
            ctx.beginPath();
            ctx.moveTo(lineX, y);
            ctx.lineTo(lineX, y + barAreaHeight);
            ctx.strokeStyle = hexToRgba(colors.white, 0.08);
            ctx.lineWidth = 1;
            ctx.stroke();
            // X-axis label - below bar area
            drawText(ctx, `${value}d`, lineX, y + barAreaHeight + 40, {
                font: this.displayConfig.fontFamily,
                size: this.FONT_SIZE.MINIMUM,
                color: hexToRgba(colors.white, 0.5),
                align: 'center',
            });
        }
        // Draw bars
        statuses.forEach((status, index) => {
            const barY = y + index * (barHeight + barGap);
            const barWidth = (status.avgDays / maxDays) * chartWidth;
            // Status label - larger
            const displayName = status.name.length > 20 ? status.name.substring(0, 17) + '...' : status.name;
            drawText(ctx, displayName, x + labelWidth - 30, barY + barHeight / 2, {
                font: this.displayConfig.fontFamily,
                size: 38,
                weight: status.isBottleneck ? 700 : 400,
                color: status.isBottleneck ? colors.warning : colors.white,
                align: 'right',
                baseline: 'middle',
            });
            // Bar background
            ctx.beginPath();
            ctx.roundRect(chartX, barY + 8, chartWidth, barHeight - 16, 10);
            ctx.fillStyle = hexToRgba(colors.white, 0.05);
            ctx.fill();
            // Bar fill with gradient - no glow
            if (barWidth > 0) {
                const gradient = ctx.createLinearGradient(chartX, barY, chartX + barWidth, barY);
                gradient.addColorStop(0, hexToRgba(status.color, 0.9));
                gradient.addColorStop(1, hexToRgba(status.color, 0.6));
                ctx.beginPath();
                ctx.roundRect(chartX, barY + 8, barWidth, barHeight - 16, 10);
                ctx.fillStyle = gradient;
                ctx.fill();
                // Border for bottleneck (no glow)
                if (status.isBottleneck) {
                    ctx.beginPath();
                    ctx.roundRect(chartX, barY + 8, barWidth, barHeight - 16, 10);
                    ctx.strokeStyle = colors.warning;
                    ctx.lineWidth = 3;
                    ctx.stroke();
                }
            }
            // Days value - larger, no shadow
            drawText(ctx, `${status.avgDays}d`, chartX + chartWidth + 25, barY + barHeight / 2, {
                font: this.displayConfig.fontFamily,
                size: 44,
                weight: 700,
                color: status.isBottleneck ? colors.warning : colors.white,
                baseline: 'middle',
            });
            // Bottleneck indicator icon - larger
            if (status.isBottleneck) {
                drawText(ctx, '⚠', chartX + chartWidth + 100, barY + barHeight / 2, {
                    font: this.displayConfig.fontFamily,
                    size: 36,
                    color: colors.warning,
                    baseline: 'middle',
                });
            }
        });
        // X-axis line - at bottom of bar area
        ctx.beginPath();
        ctx.moveTo(chartX, y + barAreaHeight);
        ctx.lineTo(chartX + chartWidth, y + barAreaHeight);
        ctx.strokeStyle = hexToRgba(colors.white, 0.25);
        ctx.lineWidth = 2;
        ctx.stroke();
        // Legend - positioned below X-axis labels
        const legendY = y + barAreaHeight + 85;
        const legendX = x + width / 2;
        // Bottleneck indicator - larger box and text
        ctx.beginPath();
        ctx.roundRect(legendX - 220, legendY - 16, 28, 28, 6);
        ctx.fillStyle = colors.warning;
        ctx.fill();
        drawText(ctx, '= Potential bottleneck status', legendX - 180, legendY, {
            font: this.displayConfig.fontFamily,
            size: this.FONT_SIZE.MINIMUM,
            color: hexToRgba(colors.white, 0.7),
            baseline: 'middle',
        });
    }
}
//# sourceMappingURL=cycle-time.js.map