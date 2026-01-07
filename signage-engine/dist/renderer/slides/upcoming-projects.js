import { BaseSlide } from './base-slide.js';
import { drawText } from '../components/text.js';
import { colors, hexToRgba } from '../components/colors.js';
import { roundRect } from '../components/charts.js';
import { format, addDays, differenceInDays } from 'date-fns';
export class UpcomingProjectsSlide extends BaseSlide {
    render(ctx, data, deltaTime) {
        // Update animations
        this.updateAnimationState(deltaTime);
        // Draw ambient effects
        this.drawAmbientEffects(ctx);
        const headerHeight = this.drawMinimalHeader(ctx, this.config.title || 'UPCOMING PROJECTS');
        const projects = data.projects.data;
        if (!projects || projects.length === 0) {
            this.drawEmptyState(ctx, headerHeight);
            return;
        }
        // Filter to projects starting in next 30 days (or configurable)
        const daysToShow = this.config.daysToShow || 30;
        const today = new Date();
        const cutoffDate = addDays(today, daysToShow);
        // Filter projects that have a start date within the range and prioritize Solutions
        const upcomingProjects = projects
            .filter(p => {
            if (!p.start_date)
                return false;
            const startDate = new Date(p.start_date);
            return startDate >= today && startDate <= cutoffDate;
        })
            .sort((a, b) => {
            // Sort by start date, then by value (higher first)
            const dateA = new Date(a.start_date);
            const dateB = new Date(b.start_date);
            if (dateA.getTime() !== dateB.getTime()) {
                return dateA.getTime() - dateB.getTime();
            }
            return (b.total_value || 0) - (a.total_value || 0);
        })
            .slice(0, this.config.maxItems || 8);
        if (upcomingProjects.length === 0) {
            this.drawEmptyState(ctx, headerHeight, 'No projects starting in the next ' + daysToShow + ' days');
            return;
        }
        this.drawProjectGrid(ctx, upcomingProjects, headerHeight);
    }
    drawEmptyState(ctx, headerHeight, message) {
        const centerX = this.displayConfig.width / 2;
        const centerY = (this.displayConfig.height + headerHeight) / 2;
        drawText(ctx, message || 'No upcoming projects', centerX, centerY, {
            font: this.displayConfig.fontFamily,
            size: 48,
            color: 'rgba(255, 255, 255, 0.5)',
            align: 'center',
            baseline: 'middle',
        });
    }
    drawProjectGrid(ctx, projects, headerHeight) {
        const padding = 60;
        const gap = 30;
        const contentY = headerHeight + 40;
        const availableWidth = this.displayConfig.width - padding * 2;
        const availableHeight = this.displayConfig.height - contentY - padding;
        // Calculate grid layout (2 rows, 4 columns for 8 items)
        const cols = Math.min(4, projects.length);
        const rows = Math.ceil(projects.length / cols);
        const cardWidth = (availableWidth - gap * (cols - 1)) / cols;
        const cardHeight = (availableHeight - gap * (rows - 1)) / rows;
        projects.forEach((project, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const x = padding + col * (cardWidth + gap);
            const y = contentY + row * (cardHeight + gap);
            this.drawProjectCard(ctx, project, x, y, cardWidth, cardHeight);
        });
    }
    drawProjectCard(ctx, project, x, y, width, height) {
        const padding = 24;
        const borderRadius = 16;
        // Card background with subtle gradient
        const gradient = ctx.createLinearGradient(x, y, x, y + height);
        gradient.addColorStop(0, hexToRgba(colors.white, 0.12));
        gradient.addColorStop(1, hexToRgba(colors.white, 0.06));
        roundRect(ctx, x, y, width, height, borderRadius);
        ctx.fillStyle = gradient;
        ctx.fill();
        // Accent bar on left side (using status color)
        ctx.fillStyle = project.status_color || colors.primary;
        roundRect(ctx, x, y, 6, height, borderRadius);
        ctx.fill();
        // Days until start
        if (project.start_date) {
            const daysUntil = differenceInDays(new Date(project.start_date), new Date());
            const daysText = daysUntil === 0 ? 'TODAY' :
                daysUntil === 1 ? 'TOMORROW' :
                    `IN ${daysUntil} DAYS`;
            // Days badge
            const badgeBg = daysUntil <= 7 ? colors.warning : colors.info;
            ctx.fillStyle = badgeBg;
            roundRect(ctx, x + width - padding - 100, y + padding, 100, 32, 6);
            ctx.fill();
            drawText(ctx, daysText, x + width - padding - 50, y + padding + 16, {
                font: this.displayConfig.fontFamily,
                size: 16,
                weight: 700,
                color: colors.black,
                align: 'center',
                baseline: 'middle',
            });
        }
        // Client name
        drawText(ctx, project.client_name, x + padding + 10, y + padding + 40, {
            font: this.displayConfig.fontFamily,
            size: 36,
            weight: 600,
            color: colors.white,
            maxWidth: width - padding * 2 - 120,
        });
        // Project type badge
        if (project.project_type) {
            const typeY = y + padding + 80;
            ctx.fillStyle = hexToRgba(colors.primaryLight, 0.3);
            const typeWidth = Math.min(ctx.measureText(project.project_type).width + 24, width - padding * 2);
            roundRect(ctx, x + padding + 10, typeY, typeWidth, 28, 4);
            ctx.fill();
            drawText(ctx, project.project_type, x + padding + 22, typeY + 14, {
                font: this.displayConfig.fontFamily,
                size: 18,
                color: colors.primaryLight,
                baseline: 'middle',
            });
        }
        // Start date
        if (project.start_date) {
            const startDate = format(new Date(project.start_date), 'MMM d, yyyy');
            drawText(ctx, `Starts: ${startDate}`, x + padding + 10, y + height - padding - 50, {
                font: this.displayConfig.fontFamily,
                size: 24,
                color: 'rgba(255, 255, 255, 0.7)',
            });
        }
        // Value
        if (project.total_value > 0) {
            const valueText = project.total_value >= 1000000
                ? `$${(project.total_value / 1000000).toFixed(1)}M`
                : `$${(project.total_value / 1000).toFixed(0)}K`;
            drawText(ctx, valueText, x + padding + 10, y + height - padding - 10, {
                font: this.displayConfig.fontFamily,
                size: 42,
                weight: 700,
                color: colors.success,
            });
        }
    }
}
//# sourceMappingURL=upcoming-projects.js.map