import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
import { drawText } from '../components/text.js';
import { drawProgressBar, roundRect } from '../components/charts.js';
import { colors, hexToRgba } from '../components/colors.js';
import { differenceInDays, format } from 'date-fns';

export class InProgressSlide extends BaseSlide {
  render(ctx: SKRSContext2D, data: DataCache, deltaTime: number): void {
    // Update animations
    this.updateAnimationState(deltaTime);

    // Draw ambient effects
    this.drawAmbientEffects(ctx);

    const headerHeight = this.drawMinimalHeader(ctx, this.config.title || 'CURRENTLY IN PROGRESS');

    const projects = data.projects.data;
    if (!projects || projects.length === 0) {
      this.drawEmptyState(ctx, headerHeight);
      return;
    }

    // Filter to projects with "in progress" or "active" status, prioritize by value
    const inProgressStatuses = ['in progress', 'active', 'in production', 'installation'];
    const inProgressProjects = projects
      .filter(p => {
        const statusLower = (p.status || '').toLowerCase();
        return inProgressStatuses.some(s => statusLower.includes(s));
      })
      .sort((a, b) => (b.total_value || 0) - (a.total_value || 0))
      .slice(0, this.config.maxItems || 6);

    if (inProgressProjects.length === 0) {
      this.drawEmptyState(ctx, headerHeight, 'No projects currently in progress');
      return;
    }

    this.drawProjectList(ctx, inProgressProjects, headerHeight);
  }

  private drawEmptyState(ctx: SKRSContext2D, headerHeight: number, message?: string): void {
    const centerX = this.displayConfig.width / 2;
    const centerY = (this.displayConfig.height + headerHeight) / 2;

    drawText(ctx, message || 'No projects in progress', centerX, centerY, {
      font: this.displayConfig.fontFamily,
      size: 48,
      color: 'rgba(255, 255, 255, 0.5)',
      align: 'center',
      baseline: 'middle',
    });
  }

  private drawProjectList(
    ctx: SKRSContext2D,
    projects: Array<{
      client_name: string;
      status: string;
      status_color: string;
      project_type: string | null;
      start_date: string | null;
      due_date: string | null;
      total_value: number;
    }>,
    headerHeight: number
  ): void {
    const padding = 80;
    const gap = 24;
    const contentY = headerHeight + 50;
    const availableHeight = this.displayConfig.height - contentY - padding;
    const rowHeight = (availableHeight - gap * (projects.length - 1)) / projects.length;

    projects.forEach((project, index) => {
      const y = contentY + index * (rowHeight + gap);
      this.drawProjectRow(ctx, project, padding, y, this.displayConfig.width - padding * 2, rowHeight, index);
    });
  }

  private drawProjectRow(
    ctx: SKRSContext2D,
    project: {
      client_name: string;
      status: string;
      status_color: string;
      project_type: string | null;
      start_date: string | null;
      due_date: string | null;
      total_value: number;
    },
    x: number,
    y: number,
    width: number,
    height: number,
    index: number
  ): void {
    const borderRadius = 12;

    // Alternating background
    const bgOpacity = index % 2 === 0 ? 0.08 : 0.04;
    ctx.fillStyle = hexToRgba(colors.white, bgOpacity);
    roundRect(ctx, x, y, width, height, borderRadius);
    ctx.fill();

    // Status indicator bar
    ctx.fillStyle = project.status_color || colors.info;
    ctx.fillRect(x, y, 8, height);

    const innerPadding = 30;
    const colX = x + innerPadding + 16;

    // Client name - large and prominent
    drawText(ctx, project.client_name, colX, y + height / 2 - 20, {
      font: this.displayConfig.fontFamily,
      size: 44,
      weight: 600,
      color: colors.white,
      baseline: 'middle',
      maxWidth: width * 0.35,
    });

    // Status badge
    const statusBadgeX = colX;
    const statusBadgeY = y + height / 2 + 20;
    ctx.fillStyle = hexToRgba(project.status_color || colors.info, 0.3);
    const statusWidth = Math.min(200, width * 0.15);
    roundRect(ctx, statusBadgeX, statusBadgeY, statusWidth, 32, 4);
    ctx.fill();

    drawText(ctx, project.status, statusBadgeX + statusWidth / 2, statusBadgeY + 16, {
      font: this.displayConfig.fontFamily,
      size: 18,
      weight: 600,
      color: project.status_color || colors.info,
      align: 'center',
      baseline: 'middle',
    });

    // Progress indicator (based on dates if available)
    const progressX = x + width * 0.42;
    const progressWidth = width * 0.25;
    let progressPercent = 50; // Default to 50% if no dates

    if (project.start_date && project.due_date) {
      const startDate = new Date(project.start_date);
      const dueDate = new Date(project.due_date);
      const today = new Date();
      const totalDays = differenceInDays(dueDate, startDate);
      const elapsedDays = differenceInDays(today, startDate);
      progressPercent = totalDays > 0 ? Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100)) : 50;
    }

    drawText(ctx, 'Timeline Progress', progressX, y + height / 2 - 25, {
      font: this.displayConfig.fontFamily,
      size: 18,
      color: 'rgba(255, 255, 255, 0.6)',
    });

    drawProgressBar(
      ctx,
      progressPercent,
      100,
      progressX,
      y + height / 2 - 5,
      progressWidth,
      20,
      {
        fillColor: progressPercent >= 80 ? colors.warning : colors.info,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 6,
      }
    );

    drawText(ctx, `${Math.round(progressPercent)}%`, progressX + progressWidth + 15, y + height / 2 + 5, {
      font: this.displayConfig.fontFamily,
      size: 24,
      weight: 600,
      color: colors.white,
      baseline: 'middle',
    });

    // Due date with days remaining
    const dueDateX = x + width * 0.72;
    if (project.due_date) {
      const dueDate = new Date(project.due_date);
      const daysRemaining = differenceInDays(dueDate, new Date());
      const isOverdue = daysRemaining < 0;

      drawText(ctx, 'Due Date', dueDateX, y + height / 2 - 25, {
        font: this.displayConfig.fontFamily,
        size: 18,
        color: 'rgba(255, 255, 255, 0.6)',
      });

      drawText(ctx, format(dueDate, 'MMM d, yyyy'), dueDateX, y + height / 2 + 5, {
        font: this.displayConfig.fontFamily,
        size: 28,
        weight: 600,
        color: isOverdue ? colors.error : colors.white,
      });

      const daysText = isOverdue
        ? `${Math.abs(daysRemaining)} days overdue`
        : `${daysRemaining} days left`;
      drawText(ctx, daysText, dueDateX, y + height / 2 + 40, {
        font: this.displayConfig.fontFamily,
        size: 20,
        color: isOverdue ? colors.error : 'rgba(255, 255, 255, 0.6)',
      });
    }

    // Value - right aligned
    const valueX = x + width - innerPadding;
    if (project.total_value > 0) {
      const valueText = project.total_value >= 1000000
        ? `$${(project.total_value / 1000000).toFixed(2)}M`
        : `$${(project.total_value / 1000).toFixed(0)}K`;

      drawText(ctx, valueText, valueX, y + height / 2, {
        font: this.displayConfig.fontFamily,
        size: 48,
        weight: 700,
        color: colors.success,
        align: 'right',
        baseline: 'middle',
      });
    }
  }
}
