import { BaseSlide } from './base-slide.js';
import { drawText } from '../components/text.js';
import { colors, hexToRgba } from '../components/colors.js';
/**
 * Status Pipeline Slide
 *
 * Displays project workflow stages as a horizontal pipeline.
 * Each stage shows the count and total revenue of projects in that status.
 * Includes animated flow effect and bottleneck indicators.
 *
 * Data source: dashboardMetrics.pipeline
 */
export class StatusPipelineSlide extends BaseSlide {
    flowOffset = 0;
    render(ctx, data, deltaTime) {
        this.updateAnimationState(deltaTime);
        this.drawAmbientEffects(ctx);
        // Animate flow effect
        this.flowOffset += deltaTime * 50;
        if (this.flowOffset > 30)
            this.flowOffset = 0;
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
    drawNoData(ctx, headerHeight) {
        drawText(ctx, 'Loading pipeline data...', this.displayConfig.width / 2, headerHeight + 200, {
            font: this.displayConfig.fontFamily,
            size: 64,
            color: hexToRgba(colors.white, 0.5),
            align: 'center',
        });
    }
    drawSummary(ctx, totalProjects, totalRevenue, x, y, width) {
        const centerX = x + width / 2;
        // Use proportional spacing to prevent overlap
        const sectionOffset = Math.min(300, width * 0.2);
        // Total projects - left section (adjusted Y positions for better spacing)
        drawText(ctx, totalProjects.toString(), centerX - sectionOffset, y + 40, {
            font: this.displayConfig.fontFamily,
            size: 72,
            weight: 700,
            color: colors.primaryLight,
            align: 'center',
        });
        drawText(ctx, 'Active Projects', centerX - sectionOffset, y + 90, {
            font: this.displayConfig.fontFamily,
            size: 32,
            color: hexToRgba(colors.white, 0.7),
            align: 'center',
        });
        // Divider
        ctx.beginPath();
        ctx.moveTo(centerX, y + 10);
        ctx.lineTo(centerX, y + 100);
        ctx.strokeStyle = hexToRgba(colors.white, 0.3);
        ctx.lineWidth = 3;
        ctx.stroke();
        // Total revenue - right section
        drawText(ctx, `$${this.formatNumber(totalRevenue)}`, centerX + sectionOffset, y + 40, {
            font: this.displayConfig.fontFamily,
            size: 72,
            weight: 700,
            color: colors.success,
            align: 'center',
        });
        drawText(ctx, 'Pipeline Value', centerX + sectionOffset, y + 90, {
            font: this.displayConfig.fontFamily,
            size: 32,
            color: hexToRgba(colors.white, 0.7),
            align: 'center',
        });
    }
    drawPipeline(ctx, statuses, x, y, width, height) {
        if (statuses.length === 0)
            return;
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
    drawFlowLines(ctx, stageCount, x, y, width, height, stageWidth, stageGap) {
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
    drawStage(ctx, status, x, y, width, height, totalCount) {
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
        // Status name - inside box at top
        const displayName = status.name.length > 12 ? status.name.substring(0, 10) + '...' : status.name;
        drawText(ctx, displayName.toUpperCase(), x + width / 2, stageY + 45, {
            font: this.displayConfig.fontFamily,
            size: 32,
            weight: 700,
            color: status.isBottleneck ? colors.warning : colors.white,
            align: 'center',
        });
        // Count (large, centered below label) - no shadow glow
        drawText(ctx, status.count.toString(), x + width / 2, stageY + stageHeight / 2 + 20, {
            font: this.displayConfig.fontFamily,
            size: 80,
            weight: 700,
            color: status.isBottleneck ? colors.warning : colors.white,
            align: 'center',
            baseline: 'middle',
        });
        // Revenue - below count
        drawText(ctx, `$${this.formatNumber(status.revenue)}`, x + width / 2, stageY + stageHeight / 2 + 85, {
            font: this.displayConfig.fontFamily,
            size: 36,
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
}
//# sourceMappingURL=status-pipeline.js.map