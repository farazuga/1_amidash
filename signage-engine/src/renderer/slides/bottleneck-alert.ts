import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
import { drawText } from '../components/text.js';
import { roundRect, drawProgressBar } from '../components/charts.js';
import { colors, hexToRgba } from '../components/colors.js';

interface BottleneckStatus {
  name: string;
  color: string;
  count: number;
  value: number;
  projects: Array<{
    client_name: string;
    total_value: number;
  }>;
}

export class BottleneckAlertSlide extends BaseSlide {
  render(ctx: SKRSContext2D, data: DataCache, deltaTime: number): void {
    // Update animations
    this.updateAnimationState(deltaTime);

    // Draw ambient effects
    this.drawAmbientEffects(ctx);

    const headerHeight = this.drawMinimalHeader(ctx, this.config.title || 'BOTTLENECK ALERT');

    const projects = data.projects.data;
    if (!projects || projects.length === 0) {
      this.drawEmptyState(ctx, headerHeight, 'No active projects');
      return;
    }

    // Identify bottleneck statuses
    const bottleneckStatuses = ['engineering', 'procurement', 'hold', 'waiting', 'review'];
    const statusMap = new Map<string, BottleneckStatus>();

    projects.forEach(project => {
      const statusLower = (project.status || '').toLowerCase();
      const isBottleneck = bottleneckStatuses.some(b => statusLower.includes(b));

      if (isBottleneck) {
        const existing = statusMap.get(project.status);
        if (existing) {
          existing.count++;
          existing.value += project.total_value || 0;
          existing.projects.push({
            client_name: project.client_name,
            total_value: project.total_value || 0,
          });
        } else {
          statusMap.set(project.status, {
            name: project.status,
            color: project.status_color || colors.warning,
            count: 1,
            value: project.total_value || 0,
            projects: [{
              client_name: project.client_name,
              total_value: project.total_value || 0,
            }],
          });
        }
      }
    });

    const bottlenecks = Array.from(statusMap.values())
      .sort((a, b) => b.value - a.value); // Sort by value impact

    if (bottlenecks.length === 0) {
      this.drawHealthyState(ctx, headerHeight);
      return;
    }

    this.drawBottleneckDashboard(ctx, bottlenecks, headerHeight, projects.length);
  }

  private drawEmptyState(ctx: SKRSContext2D, headerHeight: number, message: string): void {
    const centerX = this.displayConfig.width / 2;
    const centerY = (this.displayConfig.height + headerHeight) / 2;

    drawText(ctx, message, centerX, centerY, {
      font: this.displayConfig.fontFamily,
      size: 48,
      color: 'rgba(255, 255, 255, 0.5)',
      align: 'center',
      baseline: 'middle',
    });
  }

  private drawHealthyState(ctx: SKRSContext2D, headerHeight: number): void {
    const centerX = this.displayConfig.width / 2;
    const centerY = (this.displayConfig.height + headerHeight) / 2;

    // Large checkmark circle
    ctx.beginPath();
    ctx.arc(centerX, centerY - 50, 120, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(colors.success, 0.2);
    ctx.fill();
    ctx.strokeStyle = colors.success;
    ctx.lineWidth = 6;
    ctx.stroke();

    // Checkmark
    ctx.beginPath();
    ctx.moveTo(centerX - 50, centerY - 50);
    ctx.lineTo(centerX - 10, centerY - 10);
    ctx.lineTo(centerX + 60, centerY - 100);
    ctx.strokeStyle = colors.success;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    drawText(ctx, 'ALL CLEAR', centerX, centerY + 100, {
      font: this.displayConfig.fontFamily,
      size: 64,
      weight: 700,
      color: colors.success,
      align: 'center',
    });

    drawText(ctx, 'No bottlenecks detected in the workflow', centerX, centerY + 170, {
      font: this.displayConfig.fontFamily,
      size: 32,
      color: 'rgba(255, 255, 255, 0.6)',
      align: 'center',
    });
  }

  private drawBottleneckDashboard(
    ctx: SKRSContext2D,
    bottlenecks: BottleneckStatus[],
    headerHeight: number,
    totalProjects: number
  ): void {
    const padding = 80;
    const contentY = headerHeight + 50;
    const availableHeight = this.displayConfig.height - contentY - padding;

    // Summary bar at top
    const summaryHeight = 100;
    this.drawSummaryBar(ctx, bottlenecks, padding, contentY, this.displayConfig.width - padding * 2, summaryHeight, totalProjects);

    // Bottleneck cards
    const cardsY = contentY + summaryHeight + 40;
    const cardsHeight = availableHeight - summaryHeight - 40;

    // Display up to 3 bottleneck categories
    const topBottlenecks = bottlenecks.slice(0, 3);
    const cardWidth = (this.displayConfig.width - padding * 2 - 40 * (topBottlenecks.length - 1)) / topBottlenecks.length;

    topBottlenecks.forEach((bottleneck, index) => {
      const x = padding + index * (cardWidth + 40);
      this.drawBottleneckCard(ctx, bottleneck, x, cardsY, cardWidth, cardsHeight);
    });
  }

  private drawSummaryBar(
    ctx: SKRSContext2D,
    bottlenecks: BottleneckStatus[],
    x: number,
    y: number,
    width: number,
    height: number,
    totalProjects: number
  ): void {
    const totalBottlenecked = bottlenecks.reduce((sum, b) => sum + b.count, 0);
    const totalValue = bottlenecks.reduce((sum, b) => sum + b.value, 0);
    const bottleneckPercent = totalProjects > 0 ? (totalBottlenecked / totalProjects) * 100 : 0;

    // Warning background
    roundRect(ctx, x, y, width, height, 16);
    const severity = bottleneckPercent > 50 ? colors.error : bottleneckPercent > 25 ? colors.warning : colors.info;
    ctx.fillStyle = hexToRgba(severity, 0.2);
    ctx.fill();

    // Left side: count
    drawText(ctx, totalBottlenecked.toString(), x + 50, y + height / 2, {
      font: this.displayConfig.fontFamily,
      size: 56,
      weight: 700,
      color: severity,
      baseline: 'middle',
    });

    drawText(ctx, 'PROJECTS BOTTLENECKED', x + 140, y + height / 2, {
      font: this.displayConfig.fontFamily,
      size: 24,
      color: colors.white,
      baseline: 'middle',
    });

    // Center: percentage bar
    const barX = x + width * 0.4;
    const barWidth = width * 0.25;
    drawProgressBar(
      ctx,
      bottleneckPercent,
      100,
      barX,
      y + height / 2 - 12,
      barWidth,
      24,
      {
        fillColor: severity,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 8,
      }
    );

    drawText(ctx, `${Math.round(bottleneckPercent)}% of active projects`, barX + barWidth + 20, y + height / 2, {
      font: this.displayConfig.fontFamily,
      size: 20,
      color: 'rgba(255, 255, 255, 0.7)',
      baseline: 'middle',
    });

    // Right: value at risk
    const valueText = totalValue >= 1000000
      ? `$${(totalValue / 1000000).toFixed(1)}M`
      : `$${(totalValue / 1000).toFixed(0)}K`;

    drawText(ctx, 'VALUE AT RISK', x + width - 200, y + height / 2 - 15, {
      font: this.displayConfig.fontFamily,
      size: 16,
      color: 'rgba(255, 255, 255, 0.6)',
    });

    drawText(ctx, valueText, x + width - 200, y + height / 2 + 20, {
      font: this.displayConfig.fontFamily,
      size: 36,
      weight: 700,
      color: colors.warning,
    });
  }

  private drawBottleneckCard(
    ctx: SKRSContext2D,
    bottleneck: BottleneckStatus,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const borderRadius = 16;
    const padding = 30;

    // Card background
    roundRect(ctx, x, y, width, height, borderRadius);
    ctx.fillStyle = hexToRgba(bottleneck.color, 0.15);
    ctx.fill();

    // Top accent bar
    ctx.fillStyle = bottleneck.color;
    roundRect(ctx, x, y, width, 8, borderRadius);
    ctx.fill();

    // Status name
    drawText(ctx, bottleneck.name.toUpperCase(), x + padding, y + 60, {
      font: this.displayConfig.fontFamily,
      size: 28,
      weight: 700,
      color: bottleneck.color,
      letterSpacing: 2,
    });

    // Count and value
    drawText(ctx, bottleneck.count.toString(), x + padding, y + 130, {
      font: this.displayConfig.fontFamily,
      size: 72,
      weight: 700,
      color: colors.white,
    });

    drawText(ctx, bottleneck.count === 1 ? 'project' : 'projects', x + padding + 90, y + 130, {
      font: this.displayConfig.fontFamily,
      size: 28,
      color: 'rgba(255, 255, 255, 0.6)',
      baseline: 'middle',
    });

    const valueText = bottleneck.value >= 1000000
      ? `$${(bottleneck.value / 1000000).toFixed(1)}M`
      : `$${(bottleneck.value / 1000).toFixed(0)}K`;

    drawText(ctx, valueText, x + padding, y + 180, {
      font: this.displayConfig.fontFamily,
      size: 36,
      weight: 600,
      color: colors.warning,
    });

    // Project list (top 4)
    const listY = y + 240;
    const topProjects = bottleneck.projects
      .sort((a, b) => b.total_value - a.total_value)
      .slice(0, 4);

    topProjects.forEach((project, index) => {
      const itemY = listY + index * 50;

      // Bullet
      ctx.beginPath();
      ctx.arc(x + padding + 8, itemY + 10, 4, 0, Math.PI * 2);
      ctx.fillStyle = bottleneck.color;
      ctx.fill();

      // Project name
      drawText(ctx, project.client_name, x + padding + 25, itemY + 10, {
        font: this.displayConfig.fontFamily,
        size: 24,
        color: colors.white,
        maxWidth: width - padding * 2 - 100,
        baseline: 'middle',
      });

      // Value
      const projValue = project.total_value >= 1000
        ? `$${(project.total_value / 1000).toFixed(0)}K`
        : `$${project.total_value}`;

      drawText(ctx, projValue, x + width - padding, itemY + 10, {
        font: this.displayConfig.fontFamily,
        size: 22,
        color: 'rgba(255, 255, 255, 0.6)',
        align: 'right',
        baseline: 'middle',
      });
    });

    // "And X more" if there are more
    if (bottleneck.projects.length > 4) {
      drawText(ctx, `+${bottleneck.projects.length - 4} more`, x + padding, listY + 4 * 50 + 20, {
        font: this.displayConfig.fontFamily,
        size: 20,
        color: 'rgba(255, 255, 255, 0.4)',
      });
    }
  }
}
