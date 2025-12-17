import { CanvasRenderingContext2D } from 'canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
import { drawText, truncateText } from '../components/text.js';
import { roundRect, colors } from '../components/index.js';
import { format, addDays, startOfDay, differenceInDays } from 'date-fns';

export class TeamScheduleSlide extends BaseSlide {
  render(ctx: CanvasRenderingContext2D, data: DataCache, _deltaTime: number): void {
    const headerHeight = this.drawHeader(ctx, this.config.title || 'Team Schedule');

    const schedule = data.schedule.data;
    const daysToShow = this.config.daysToShow || 14;
    const padding = 60;
    const nameColWidth = 250;
    const rowHeight = 80;
    const startDate = startOfDay(new Date());

    // Calculate day column width
    const chartWidth = this.displayConfig.width - padding * 2 - nameColWidth;
    const dayWidth = chartWidth / daysToShow;

    const contentY = headerHeight + 40;

    // Draw day headers
    for (let i = 0; i < daysToShow; i++) {
      const date = addDays(startDate, i);
      const x = padding + nameColWidth + i * dayWidth;
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

      // Weekend background
      if (isWeekend) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(x, contentY, dayWidth, this.displayConfig.height - contentY - padding);
      }

      // Day label
      drawText(ctx, format(date, 'EEE'), x + dayWidth / 2, contentY + 15, {
        font: this.displayConfig.fontFamily,
        size: 18,
        color: isWeekend ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.7)',
        align: 'center',
      });

      // Date number
      drawText(ctx, format(date, 'd'), x + dayWidth / 2, contentY + 40, {
        font: this.displayConfig.fontFamily,
        size: 24,
        color: isWeekend ? 'rgba(255, 255, 255, 0.4)' : colors.white,
        align: 'center',
      });
    }

    // Today indicator line
    ctx.strokeStyle = colors.warning;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding + nameColWidth, contentY);
    ctx.lineTo(padding + nameColWidth, this.displayConfig.height - padding);
    ctx.stroke();

    // Draw team rows
    const rowStartY = contentY + 70;
    schedule.forEach((user, userIndex) => {
      const rowY = rowStartY + userIndex * rowHeight;

      // Alternating row background
      if (userIndex % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(padding, rowY, this.displayConfig.width - padding * 2, rowHeight);
      }

      // User name
      drawText(
        ctx,
        truncateText(ctx, user.userName, nameColWidth - 20, this.displayConfig.fontFamily, 24),
        padding + 10,
        rowY + rowHeight / 2,
        {
          font: this.displayConfig.fontFamily,
          size: 24,
          color: colors.white,
          baseline: 'middle',
        }
      );

      // Draw assignment blocks
      user.assignments.forEach((assignment) => {
        const assignmentDate = new Date(assignment.date);
        const dayIndex = differenceInDays(assignmentDate, startDate);

        if (dayIndex >= 0 && dayIndex < daysToShow) {
          const blockX = padding + nameColWidth + dayIndex * dayWidth + 2;
          const blockWidth = dayWidth - 4;
          const blockHeight = rowHeight - 16;
          const blockY = rowY + 8;

          // Assignment block
          roundRect(ctx, blockX, blockY, blockWidth, blockHeight, 6);
          ctx.fillStyle = assignment.projectColor || colors.info;
          ctx.fill();

          // Project name (if block is wide enough)
          if (blockWidth > 60) {
            drawText(
              ctx,
              truncateText(ctx, assignment.projectName, blockWidth - 8, this.displayConfig.fontFamily, 14),
              blockX + blockWidth / 2,
              blockY + blockHeight / 2 - 8,
              {
                font: this.displayConfig.fontFamily,
                size: 14,
                color: colors.white,
                align: 'center',
                baseline: 'middle',
              }
            );
          }

          // Hours
          drawText(ctx, `${assignment.hours}h`, blockX + blockWidth / 2, blockY + blockHeight / 2 + 10, {
            font: this.displayConfig.fontFamily,
            size: 16,
            color: 'rgba(255, 255, 255, 0.8)',
            align: 'center',
            baseline: 'middle',
          });
        }
      });
    });
  }
}
