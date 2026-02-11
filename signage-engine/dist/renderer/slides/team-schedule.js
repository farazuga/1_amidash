import { BaseSlide } from './base-slide.js';
import { drawText, truncateText } from '../components/text.js';
import { roundRect, colors } from '../components/index.js';
import { format, addDays, startOfDay } from 'date-fns';
/**
 * Team Schedule Slide
 *
 * Displays team member assignments in a calendar grid format.
 * Shows upcoming days (configurable) with project assignments.
 * Currently uses mock data (project_assignments table not implemented).
 *
 * Data source: schedule (from fetchScheduleData)
 */
export class TeamScheduleSlide extends BaseSlide {
    render(ctx, data, _deltaTime) {
        const headerHeight = this.drawHeader(ctx, this.config.title || 'Team Schedule');
        const schedule = data.schedule.data;
        const showWeekends = this.config.showWeekends ?? false;
        const padding = this.SCREEN_MARGIN;
        const nameColWidth = 380;
        const startDate = startOfDay(new Date());
        // Generate days to show, optionally filtering weekends per DESIGN.md
        const requestedDays = this.config.daysToShow || 7;
        let daysArray = [];
        let currentDate = startDate;
        // Generate enough days to fill the requested weekdays
        while (daysArray.length < requestedDays) {
            const dayOfWeek = currentDate.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            if (showWeekends || !isWeekend) {
                daysArray.push(currentDate);
            }
            currentDate = addDays(currentDate, 1);
        }
        const daysToShow = daysArray.length;
        // Use safe area bounds per DESIGN.md
        const bounds = this.getContentBounds();
        const headerAreaHeight = 100; // Day labels area
        const availableHeight = bounds.height - headerAreaHeight;
        // Dynamic row height - fill available space, increased minimums for better readability
        const minRowHeight = 180; // Increased from 140
        const maxRowHeight = 320; // Increased from 280
        const numRows = Math.max(schedule.length, 1);
        // Calculate ideal row height to fill space
        let rowHeight = Math.floor(availableHeight / numRows);
        rowHeight = Math.min(maxRowHeight, Math.max(minRowHeight, rowHeight));
        // If we have few rows, calculate vertical offset to center content
        const totalRowsHeight = rowHeight * numRows + headerAreaHeight;
        const verticalOffset = Math.max(0, (bounds.height - totalRowsHeight) / 2);
        // Calculate day column width
        const chartWidth = this.displayConfig.width - padding * 2 - nameColWidth;
        const dayWidth = chartWidth / daysToShow;
        const contentY = bounds.y + verticalOffset;
        // Draw day headers using the filtered daysArray
        for (let i = 0; i < daysToShow; i++) {
            const date = daysArray[i];
            const x = padding + nameColWidth + i * dayWidth;
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            // Weekend background (only if weekends are shown)
            if (isWeekend && showWeekends) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.fillRect(x, contentY, dayWidth, bounds.height);
            }
            // Day label
            drawText(ctx, format(date, 'EEE'), x + dayWidth / 2, contentY + 22, {
                font: this.displayConfig.fontFamily,
                size: this.FONT_SIZE.LABEL,
                color: isWeekend ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.7)',
                align: 'center',
            });
            // Date number
            drawText(ctx, format(date, 'd'), x + dayWidth / 2, contentY + 70, {
                font: this.displayConfig.fontFamily,
                size: this.FONT_SIZE.BODY,
                color: isWeekend ? 'rgba(255, 255, 255, 0.4)' : colors.white,
                align: 'center',
            });
        }
        // Today indicator line - find today's position in the filtered array
        const today = startOfDay(new Date());
        const todayIndex = daysArray.findIndex(d => d.getTime() === today.getTime());
        if (todayIndex >= 0) {
            const todayX = padding + nameColWidth + todayIndex * dayWidth;
            ctx.strokeStyle = colors.warning;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(todayX, contentY);
            ctx.lineTo(todayX, contentY + bounds.height - verticalOffset);
            ctx.stroke();
        }
        // Draw team rows
        const rowStartY = contentY + 100;
        schedule.forEach((user, userIndex) => {
            const rowY = rowStartY + userIndex * rowHeight;
            // Alternating row background
            if (userIndex % 2 === 0) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
                ctx.fillRect(padding, rowY, this.displayConfig.width - padding * 2, rowHeight);
            }
            // User name
            drawText(ctx, truncateText(ctx, user.userName, nameColWidth - 20, this.displayConfig.fontFamily, 44), padding + 10, rowY + rowHeight / 2, {
                font: this.displayConfig.fontFamily,
                size: 44,
                color: colors.white,
                baseline: 'middle',
            });
            // Draw assignment blocks
            user.assignments.forEach((assignment) => {
                const assignmentDate = startOfDay(new Date(assignment.date));
                // Find the index in our filtered daysArray
                const dayIndex = daysArray.findIndex(d => d.getTime() === assignmentDate.getTime());
                if (dayIndex >= 0) {
                    const blockX = padding + nameColWidth + dayIndex * dayWidth + 4;
                    const blockWidth = dayWidth - 8;
                    const blockHeight = rowHeight - 24;
                    const blockY = rowY + 12;
                    // Assignment block
                    roundRect(ctx, blockX, blockY, blockWidth, blockHeight, 6);
                    ctx.fillStyle = assignment.projectColor || colors.info;
                    ctx.fill();
                    // Project name (if block is wide enough)
                    if (blockWidth > 100) {
                        drawText(ctx, truncateText(ctx, assignment.projectName, blockWidth - 20, this.displayConfig.fontFamily, this.FONT_SIZE.MINIMUM), blockX + blockWidth / 2, blockY + blockHeight / 2 - 24, {
                            font: this.displayConfig.fontFamily,
                            size: this.FONT_SIZE.MINIMUM,
                            color: colors.white,
                            align: 'center',
                            baseline: 'middle',
                        });
                    }
                    // Hours - slightly larger for readability
                    drawText(ctx, `${assignment.hours}h`, blockX + blockWidth / 2, blockY + blockHeight / 2 + 28, {
                        font: this.displayConfig.fontFamily,
                        size: this.FONT_SIZE.LABEL,
                        color: 'rgba(255, 255, 255, 0.9)',
                        align: 'center',
                        baseline: 'middle',
                    });
                }
            });
        });
    }
}
//# sourceMappingURL=team-schedule.js.map