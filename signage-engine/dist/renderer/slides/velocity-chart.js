import { BaseSlide } from './base-slide.js';
import { drawText } from '../components/text.js';
import { colors, hexToRgba } from '../components/colors.js';
export class VelocityChartSlide extends BaseSlide {
    render(ctx, data, deltaTime) {
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
        // Use SAFE_AREA.bottom to account for connection banner
        const contentHeight = height - contentY - this.SAFE_AREA.bottom - 60;
        // Summary cards at top
        this.drawSummaryCards(ctx, velocity, padding, contentY, width - padding * 2);
        // Main bar chart - leave room for legend above banner
        const chartY = contentY + 160;
        const chartHeight = contentHeight - 160;
        this.drawVelocityChart(ctx, velocity.monthly, padding, chartY, width - padding * 2, chartHeight);
        // Legend above the banner zone
        this.drawLegend(ctx, padding, height - this.SAFE_AREA.bottom - 30, width - padding * 2);
        // Draw connection status indicator if not connected
        this.drawConnectionStatus(ctx, data);
    }
    drawNoData(ctx, headerHeight) {
        drawText(ctx, 'Loading velocity data...', this.displayConfig.width / 2, headerHeight + 200, {
            font: this.displayConfig.fontFamily,
            size: 64,
            color: hexToRgba(colors.white, 0.5),
            align: 'center',
        });
    }
    drawSummaryCards(ctx, velocity, x, y, width) {
        const cardWidth = (width - 60) / 3;
        const cardHeight = 120;
        const gap = 30;
        // POs Received card
        this.drawSummaryCard(ctx, 'POs Received (6mo)', velocity.totalPOs.toString(), '#3b82f6', x, y, cardWidth, cardHeight);
        // Invoiced card
        this.drawSummaryCard(ctx, 'Invoiced (6mo)', velocity.totalInvoiced.toString(), colors.success, x + cardWidth + gap, y, cardWidth, cardHeight);
        // Net Change card with trend indicator
        let trendColor;
        let trendIcon;
        let trendLabel;
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
        this.drawSummaryCard(ctx, 'Net Change', `${trendIcon} ${netDisplay}`, trendColor, x + (cardWidth + gap) * 2, y, cardWidth, cardHeight, trendLabel);
    }
    drawSummaryCard(ctx, title, value, color, x, y, width, height, subtitle) {
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
        // Value - per DESIGN.md KPI values should be FONT_SIZE.LARGE (72px)
        drawText(ctx, value, x + 25, y + 90, {
            font: this.displayConfig.fontFamily,
            size: this.FONT_SIZE.LARGE,
            weight: 700,
            color: color,
        });
        // Subtitle if provided
        if (subtitle) {
            drawText(ctx, subtitle, x + width - 25, y + height - 25, {
                font: this.displayConfig.fontFamily,
                size: this.FONT_SIZE.MINIMUM,
                color: hexToRgba(color, 0.8),
                align: 'right',
            });
        }
    }
    drawVelocityChart(ctx, monthly, x, y, width, height) {
        const barGroupWidth = width / monthly.length;
        const barWidth = barGroupWidth * 0.35;
        const maxValue = Math.max(...monthly.map((m) => Math.max(m.posReceived, m.invoiced)), 1);
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
                    size: this.FONT_SIZE.MINIMUM,
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
            // PO value on top of bar - ensure minimum spacing
            if (month.posReceived > 0) {
                const poLabelY = Math.min(poBarY - 35, y - 10);
                drawText(ctx, month.posReceived.toString(), poBarX + barWidth / 2, poLabelY, {
                    font: this.displayConfig.fontFamily,
                    size: 36,
                    weight: 700,
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
            // Invoice value on top of bar - ensure minimum spacing
            if (month.invoiced > 0) {
                const invLabelY = Math.min(invBarY - 35, y - 10);
                drawText(ctx, month.invoiced.toString(), invBarX + barWidth / 2, invLabelY, {
                    font: this.displayConfig.fontFamily,
                    size: 36,
                    weight: 700,
                    color: colors.success,
                    align: 'center',
                });
            }
            // Month label - larger for readability
            drawText(ctx, month.month, groupX, y + height + 50, {
                font: this.displayConfig.fontFamily,
                size: this.FONT_SIZE.MINIMUM,
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
    drawLegend(ctx, x, y, width) {
        const centerX = x + width / 2;
        const legendSpacing = 250;
        // PO legend
        ctx.beginPath();
        ctx.roundRect(centerX - legendSpacing - 20, y, 36, 36, 6);
        ctx.fillStyle = '#3b82f6';
        ctx.fill();
        drawText(ctx, 'POs Received', centerX - legendSpacing + 25, y + 18, {
            font: this.displayConfig.fontFamily,
            size: this.FONT_SIZE.MINIMUM,
            color: hexToRgba(colors.white, 0.7),
            baseline: 'middle',
        });
        // Invoice legend
        ctx.beginPath();
        ctx.roundRect(centerX + 50, y, 36, 36, 6);
        ctx.fillStyle = colors.success;
        ctx.fill();
        drawText(ctx, 'Invoiced', centerX + 100, y + 18, {
            font: this.displayConfig.fontFamily,
            size: this.FONT_SIZE.MINIMUM,
            color: hexToRgba(colors.white, 0.7),
            baseline: 'middle',
        });
    }
}
//# sourceMappingURL=velocity-chart.js.map