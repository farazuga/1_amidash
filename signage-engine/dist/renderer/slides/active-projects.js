import { BaseSlide } from './base-slide.js';
import { drawText, truncateText } from '../components/text.js';
import { colors, hexToRgba } from '../components/colors.js';
import { format, formatDistanceToNow, isPast } from 'date-fns';
export class ActiveProjectsSlide extends BaseSlide {
    render(ctx, data, deltaTime) {
        // Update animations
        this.updateAnimationState(deltaTime);
        // Draw ambient effects
        this.drawAmbientEffects(ctx);
        const headerHeight = this.drawMinimalHeader(ctx, this.config.title || 'Active Projects');
        const projects = data.projects.data.slice(0, this.config.maxItems || 4);
        const { width, height } = this.displayConfig;
        const padding = 80;
        const cardGap = 40;
        if (projects.length === 0) {
            this.drawNoData(ctx, headerHeight);
            return;
        }
        // Calculate card layout - 2 columns, 2 rows max for large readable cards
        const contentHeight = height - headerHeight - padding * 2;
        const cols = 2;
        const rows = Math.min(2, Math.ceil(projects.length / cols));
        const cardWidth = (width - padding * 2 - cardGap * (cols - 1)) / cols;
        const cardHeight = (contentHeight - cardGap * (rows - 1)) / rows;
        const startY = headerHeight + padding;
        projects.forEach((project, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const x = padding + col * (cardWidth + cardGap);
            const y = startY + row * (cardHeight + cardGap);
            this.drawProjectCard(ctx, project, x, y, cardWidth, cardHeight);
        });
    }
    drawNoData(ctx, headerHeight) {
        drawText(ctx, 'No active projects', this.displayConfig.width / 2, headerHeight + 200, {
            font: this.displayConfig.fontFamily,
            size: 64,
            color: hexToRgba(colors.white, 0.5),
            align: 'center',
        });
    }
    drawProjectCard(ctx, project, x, y, width, height) {
        const padding = 24;
        const isOverdue = project.due_date && isPast(new Date(project.due_date));
        // Card background with hover effect simulation
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 12);
        ctx.fillStyle = hexToRgba(colors.white, 0.06);
        ctx.fill();
        // Left accent bar based on status
        ctx.beginPath();
        ctx.roundRect(x, y, 6, height, [12, 0, 0, 12]);
        ctx.fillStyle = project.status_color || colors.primary;
        ctx.fill();
        // Status badge
        const statusBadgeWidth = Math.min(200, ctx.measureText(project.status).width + 60);
        ctx.beginPath();
        ctx.roundRect(x + padding + 10, y + padding, statusBadgeWidth, 44, 8);
        ctx.fillStyle = hexToRgba(project.status_color || colors.primary, 0.3);
        ctx.fill();
        drawText(ctx, project.status.toUpperCase(), x + padding + 10 + statusBadgeWidth / 2, y + padding + 28, {
            font: this.displayConfig.fontFamily,
            size: 28,
            weight: 700,
            color: project.status_color || colors.primary,
            align: 'center',
            baseline: 'middle',
            letterSpacing: 2,
        });
        // Project name - large and bold
        drawText(ctx, truncateText(ctx, project.name, width - padding * 2 - 20, this.displayConfig.fontFamily, 64), x + padding + 10, y + padding + 100, {
            font: this.displayConfig.fontFamily,
            size: 64,
            weight: 600,
            color: colors.white,
        });
        // Client name
        drawText(ctx, truncateText(ctx, project.client_name, width / 2 - padding, this.displayConfig.fontFamily, 42), x + padding + 10, y + padding + 160, {
            font: this.displayConfig.fontFamily,
            size: 42,
            color: hexToRgba(colors.white, 0.6),
        });
        // Right side: value and due date
        const rightX = x + width - padding;
        // Value - large teal number
        if (project.total_value > 0) {
            const valueStr = `$${project.total_value.toLocaleString()}`;
            drawText(ctx, valueStr, rightX, y + padding + 50, {
                font: this.displayConfig.fontFamily,
                size: 60,
                weight: 700,
                color: colors.primaryLight,
                align: 'right',
            });
        }
        // Due date
        if (project.due_date) {
            const dueDate = new Date(project.due_date);
            const dueDateStr = format(dueDate, 'MMM d');
            const relativeStr = formatDistanceToNow(dueDate, { addSuffix: true });
            drawText(ctx, dueDateStr, rightX, y + height - padding - 70, {
                font: this.displayConfig.fontFamily,
                size: 48,
                weight: 600,
                color: isOverdue ? colors.error : colors.white,
                align: 'right',
            });
            drawText(ctx, relativeStr, rightX, y + height - padding - 20, {
                font: this.displayConfig.fontFamily,
                size: 36,
                color: isOverdue ? hexToRgba(colors.error, 0.8) : hexToRgba(colors.white, 0.5),
                align: 'right',
            });
        }
        // Overdue indicator
        if (isOverdue) {
            ctx.beginPath();
            ctx.arc(x + width - 20, y + 20, 8, 0, Math.PI * 2);
            ctx.fillStyle = colors.error;
            ctx.fill();
            // Pulsing effect
            const pulse = Math.sin(this.animationState.pulsePhase * 3) * 0.3 + 0.7;
            ctx.beginPath();
            ctx.arc(x + width - 20, y + 20, 12, 0, Math.PI * 2);
            ctx.strokeStyle = hexToRgba(colors.error, pulse * 0.5);
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
}
//# sourceMappingURL=active-projects.js.map