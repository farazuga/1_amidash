import { CanvasRenderingContext2D } from 'canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
import { drawText, truncateText } from '../components/text.js';
import { roundRect, colors } from '../components/index.js';
import { format } from 'date-fns';

export class ActiveProjectsSlide extends BaseSlide {
  render(ctx: CanvasRenderingContext2D, data: DataCache, _deltaTime: number): void {
    const headerHeight = this.drawHeader(ctx, this.config.title || 'Active Projects');

    const projects = data.projects.data.slice(0, this.config.maxItems || 15);
    const padding = 60;
    const rowHeight = 100;
    const startY = headerHeight + 40;
    const colWidths = {
      status: 200,
      project: 800,
      client: 500,
      dates: 400,
      value: 300,
    };

    // Table header
    let headerX = padding;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(padding, startY, this.displayConfig.width - padding * 2, 60);

    const headers = [
      { text: 'Status', width: colWidths.status },
      { text: 'Project', width: colWidths.project },
      { text: 'Client', width: colWidths.client },
      { text: 'Dates', width: colWidths.dates },
      { text: 'Value', width: colWidths.value },
    ];

    headers.forEach((header) => {
      drawText(ctx, header.text, headerX + 20, startY + 30, {
        font: this.displayConfig.fontFamily,
        size: 24,
        color: 'rgba(255, 255, 255, 0.7)',
        baseline: 'middle',
      });
      headerX += header.width;
    });

    // Table rows
    projects.forEach((project, index) => {
      const rowY = startY + 60 + index * rowHeight;
      let rowX = padding;

      // Alternating row background
      if (index % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(padding, rowY, this.displayConfig.width - padding * 2, rowHeight);
      }

      // Status badge
      roundRect(ctx, rowX + 20, rowY + 30, 160, 40, 8);
      ctx.fillStyle = project.status_color || colors.gray[500];
      ctx.fill();
      drawText(
        ctx,
        truncateText(ctx, project.status, 140, this.displayConfig.fontFamily, 20),
        rowX + 100,
        rowY + 50,
        {
          font: this.displayConfig.fontFamily,
          size: 20,
          color: colors.white,
          align: 'center',
          baseline: 'middle',
        }
      );
      rowX += colWidths.status;

      // Project name
      drawText(
        ctx,
        truncateText(ctx, project.name, colWidths.project - 40, this.displayConfig.fontFamily, 28),
        rowX + 20,
        rowY + 50,
        {
          font: this.displayConfig.fontFamily,
          size: 28,
          color: colors.white,
          baseline: 'middle',
        }
      );
      rowX += colWidths.project;

      // Client
      drawText(
        ctx,
        truncateText(ctx, project.client_name, colWidths.client - 40, this.displayConfig.fontFamily, 24),
        rowX + 20,
        rowY + 50,
        {
          font: this.displayConfig.fontFamily,
          size: 24,
          color: 'rgba(255, 255, 255, 0.8)',
          baseline: 'middle',
        }
      );
      rowX += colWidths.client;

      // Dates
      const dateStr = project.due_date
        ? `Due: ${format(new Date(project.due_date), 'MMM d')}`
        : 'No due date';
      drawText(ctx, dateStr, rowX + 20, rowY + 50, {
        font: this.displayConfig.fontFamily,
        size: 22,
        color: 'rgba(255, 255, 255, 0.6)',
        baseline: 'middle',
      });
      rowX += colWidths.dates;

      // Value
      const valueStr = project.total_value
        ? `$${project.total_value.toLocaleString()}`
        : '-';
      drawText(ctx, valueStr, rowX + 20, rowY + 50, {
        font: this.displayConfig.fontFamily,
        size: 26,
        color: colors.success,
        baseline: 'middle',
      });
    });
  }
}
