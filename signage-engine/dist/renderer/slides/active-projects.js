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
        const { width } = this.displayConfig;
        const padding = this.SCREEN_MARGIN;
        const cardGap = 50;
        if (projects.length === 0) {
            this.drawNoData(ctx, headerHeight);
            return;
        }
        // Use safe area bounds per DESIGN.md
        const bounds = this.getContentBounds();
        const projectCount = projects.length;
        // Dynamic grid logic - adjust based on project count
        let cols;
        let rows;
        if (projectCount === 1) {
            cols = 1;
            rows = 1;
        }
        else if (projectCount === 2) {
            cols = 2;
            rows = 1;
        }
        else if (projectCount === 3) {
            // Special case: 3 projects in a single row
            cols = 3;
            rows = 1;
        }
        else if (projectCount <= 4) {
            cols = 2;
            rows = 2;
        }
        else if (projectCount <= 6) {
            cols = 3;
            rows = 2;
        }
        else {
            cols = 3;
            rows = Math.ceil(projectCount / 3);
        }
        // Calculate card dimensions based on grid
        const cardWidth = (width - padding * 2 - cardGap * (cols - 1)) / cols;
        const cardHeight = (bounds.height - cardGap * (rows - 1)) / rows;
        // Vertical centering when content doesn't fill all rows
        const actualRows = Math.ceil(projectCount / cols);
        const totalContentHeight = actualRows * cardHeight + (actualRows - 1) * cardGap;
        const verticalOffset = (bounds.height - totalContentHeight) / 2;
        const startY = bounds.y + verticalOffset;
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
        const padding = 40;
        const isOverdue = project.due_date && isPast(new Date(project.due_date));
        // Card background
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 16);
        ctx.fillStyle = hexToRgba(colors.white, 0.08);
        ctx.fill();
        // Left accent bar based on status
        ctx.beginPath();
        ctx.roundRect(x, y, 8, height, [16, 0, 0, 16]);
        ctx.fillStyle = project.status_color || colors.primary;
        ctx.fill();
        // Status badge - larger and more prominent
        ctx.font = `700 36px ${this.displayConfig.fontFamily}`;
        const statusBadgeWidth = Math.min(320, ctx.measureText(project.status.toUpperCase()).width + 80);
        ctx.beginPath();
        ctx.roundRect(x + padding + 16, y + padding, statusBadgeWidth, 56, 10);
        ctx.fillStyle = hexToRgba(project.status_color || colors.primary, 0.35);
        ctx.fill();
        drawText(ctx, project.status.toUpperCase(), x + padding + 16 + statusBadgeWidth / 2, y + padding + 32, {
            font: this.displayConfig.fontFamily,
            size: 36,
            weight: 700,
            color: project.status_color || colors.primary,
            align: 'center',
            baseline: 'middle',
        });
        // Project name - larger and bold
        drawText(ctx, truncateText(ctx, project.name, width - padding * 2 - 20, this.displayConfig.fontFamily, 72), x + padding + 16, y + padding + 130, {
            font: this.displayConfig.fontFamily,
            size: 72,
            weight: 600,
            color: colors.white,
        });
        // Client name - larger
        drawText(ctx, truncateText(ctx, project.client_name, width * 0.55, this.displayConfig.fontFamily, 48), x + padding + 16, y + padding + 200, {
            font: this.displayConfig.fontFamily,
            size: 48,
            color: hexToRgba(colors.white, 0.7),
        });
        // Right side: value and due date
        const rightX = x + width - padding - 16;
        // Value - large teal number
        if (project.total_value > 0) {
            const valueStr = `$${project.total_value.toLocaleString()}`;
            drawText(ctx, valueStr, rightX, y + padding + 60, {
                font: this.displayConfig.fontFamily,
                size: 72,
                weight: 700,
                color: colors.primaryLight,
                align: 'right',
            });
        }
        // Due date - larger
        if (project.due_date) {
            const dueDate = new Date(project.due_date);
            const dueDateStr = format(dueDate, 'MMM d');
            const relativeStr = formatDistanceToNow(dueDate, { addSuffix: true });
            drawText(ctx, dueDateStr, rightX, y + height - padding - 90, {
                font: this.displayConfig.fontFamily,
                size: 56,
                weight: 600,
                color: isOverdue ? colors.error : colors.white,
                align: 'right',
            });
            drawText(ctx, relativeStr, rightX, y + height - padding - 30, {
                font: this.displayConfig.fontFamily,
                size: 42,
                color: isOverdue ? hexToRgba(colors.error, 0.9) : hexToRgba(colors.white, 0.6),
                align: 'right',
            });
        }
        // Overdue indicator - static, no animation
        if (isOverdue) {
            ctx.beginPath();
            ctx.arc(x + width - 30, y + 30, 12, 0, Math.PI * 2);
            ctx.fillStyle = colors.error;
            ctx.fill();
        }
    }
}
//# sourceMappingURL=active-projects.js.map