import type { CanvasRenderingContext2D } from 'canvas';
import { BaseSlide, SlideRenderContext } from './base-slide.js';
import type { ScheduleData, GanttAssignment } from '../../types/database.js';
import { colors, getBookingStatusColor, hexToRgba } from '../components/colors.js';
import { fontSizes, fontFamilies, truncateText } from '../components/text.js';
import { drawRoundedRect } from '../components/charts.js';
import { addDays, format, isWeekend, isSameDay, isWithinInterval, parseISO } from 'date-fns';

/**
 * Team Schedule / Gantt slide
 * Displays team assignments in a Gantt-style chart
 */
export class TeamScheduleSlide extends BaseSlide {
  render(context: SlideRenderContext, data: ScheduleData | null): void {
    const { ctx, width, height } = context;

    // Draw background
    this.drawBackground(ctx, width, height);

    // Draw header
    const headerHeight = this.drawHeader(context, this.config.title || 'Team Schedule');

    // Draw stale indicator if needed
    this.drawStaleIndicator(context);

    // Check for data
    if (!data || !data.assignments || data.assignments.length === 0) {
      this.drawNoData(ctx, width, height, 'No scheduled assignments');
      return;
    }

    const padding = 60;
    const contentY = headerHeight + 20;
    const contentHeight = height - contentY - padding;

    // Configuration
    const daysToShow = this.config.daysToShow || 14;
    const showWeekends = this.config.showWeekends !== false;

    // Calculate dates to display
    const today = new Date();
    const dates = this.generateDates(today, daysToShow, showWeekends);

    // Group assignments by user
    const userAssignments = this.groupByUser(data.assignments);
    const users = Array.from(userAssignments.keys());

    // Calculate layout
    const nameColumnWidth = 300;
    const dateColumnWidth = (width - padding * 2 - nameColumnWidth) / dates.length;
    const headerRowHeight = 80;
    const rowHeight = Math.min(100, (contentHeight - headerRowHeight) / Math.max(users.length, 1));

    // Draw date headers
    this.drawDateHeaders(ctx, dates, padding + nameColumnWidth, contentY, dateColumnWidth, headerRowHeight);

    // Draw "Team Member" header
    ctx.font = `bold ${fontSizes.heading}px ${fontFamilies.primary}`;
    ctx.fillStyle = colors.textSecondary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('TEAM MEMBER', padding, contentY + headerRowHeight / 2);

    // Draw user rows
    let y = contentY + headerRowHeight;
    users.forEach((userName, index) => {
      const assignments = userAssignments.get(userName) || [];
      this.drawUserRow(
        ctx,
        userName,
        assignments,
        dates,
        padding,
        y,
        nameColumnWidth,
        dateColumnWidth,
        rowHeight - 10,
        index % 2 === 0
      );
      y += rowHeight;
    });

    // Draw today indicator line
    this.drawTodayIndicator(ctx, dates, padding + nameColumnWidth, contentY, dateColumnWidth, y - contentY);

    // Draw legend
    this.drawLegend(ctx, width - padding - 600, height - 60);
  }

  private generateDates(startDate: Date, days: number, includeWeekends: boolean): Date[] {
    const dates: Date[] = [];
    let currentDate = startDate;
    let daysAdded = 0;

    while (daysAdded < days) {
      if (includeWeekends || !isWeekend(currentDate)) {
        dates.push(new Date(currentDate));
        daysAdded++;
      }
      currentDate = addDays(currentDate, 1);
    }

    return dates;
  }

  private groupByUser(assignments: GanttAssignment[]): Map<string, GanttAssignment[]> {
    const grouped = new Map<string, GanttAssignment[]>();

    assignments.forEach((assignment) => {
      const userName = assignment.user_name || 'Unassigned';
      if (!grouped.has(userName)) {
        grouped.set(userName, []);
      }
      grouped.get(userName)!.push(assignment);
    });

    return grouped;
  }

  private drawDateHeaders(
    ctx: CanvasRenderingContext2D,
    dates: Date[],
    x: number,
    y: number,
    columnWidth: number,
    headerHeight: number
  ): void {
    const today = new Date();

    dates.forEach((date, index) => {
      const colX = x + index * columnWidth;
      const isToday = isSameDay(date, today);
      const isWeekendDay = isWeekend(date);

      // Draw column background for weekends
      if (isWeekendDay) {
        ctx.fillStyle = hexToRgba(colors.backgroundLight, 0.3);
        ctx.fillRect(colX, y, columnWidth, headerHeight);
      }

      // Draw today highlight
      if (isToday) {
        ctx.fillStyle = hexToRgba(colors.primary, 0.3);
        ctx.fillRect(colX, y, columnWidth, headerHeight);
      }

      // Draw day of week
      ctx.font = `bold ${fontSizes.small}px ${fontFamilies.primary}`;
      ctx.fillStyle = isToday ? colors.chartBar : colors.textSecondary;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(format(date, 'EEE'), colX + columnWidth / 2, y + 15);

      // Draw date
      ctx.font = `${fontSizes.body}px ${fontFamilies.primary}`;
      ctx.fillStyle = isToday ? colors.textPrimary : colors.textSecondary;
      ctx.fillText(format(date, 'd'), colX + columnWidth / 2, y + 45);
    });

    // Draw bottom border
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 10, y + headerHeight);
    ctx.lineTo(x + dates.length * columnWidth + 10, y + headerHeight);
    ctx.stroke();
  }

  private drawUserRow(
    ctx: CanvasRenderingContext2D,
    userName: string,
    assignments: GanttAssignment[],
    dates: Date[],
    x: number,
    y: number,
    nameWidth: number,
    dateColumnWidth: number,
    rowHeight: number,
    isEven: boolean
  ): void {
    // Draw row background
    if (isEven) {
      ctx.fillStyle = colors.backgroundLight;
      ctx.fillRect(x, y, nameWidth + dates.length * dateColumnWidth, rowHeight + 10);
    }

    // Draw user name
    ctx.font = `bold ${fontSizes.body}px ${fontFamilies.primary}`;
    ctx.fillStyle = colors.textPrimary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const truncatedName = truncateText(ctx, userName, nameWidth - 20);
    ctx.fillText(truncatedName, x + 10, y + rowHeight / 2 + 5);

    // Draw assignments
    assignments.forEach((assignment) => {
      this.drawAssignmentBar(ctx, assignment, dates, x + nameWidth, y + 5, dateColumnWidth, rowHeight);
    });
  }

  private drawAssignmentBar(
    ctx: CanvasRenderingContext2D,
    assignment: GanttAssignment,
    dates: Date[],
    x: number,
    y: number,
    columnWidth: number,
    height: number
  ): void {
    const startDate = parseISO(assignment.start_date);
    const endDate = parseISO(assignment.end_date);
    const color = getBookingStatusColor(assignment.booking_status);

    // Find start and end columns
    let startCol = -1;
    let endCol = -1;

    dates.forEach((date, index) => {
      if (isSameDay(date, startDate) || (startCol === -1 && date > startDate)) {
        startCol = index;
      }
      if (isSameDay(date, endDate) || date <= endDate) {
        endCol = index;
      }
    });

    // Don't draw if outside visible range
    if (startCol === -1 || endCol === -1 || startCol > endCol) {
      // Check if assignment spans across visible range
      if (startDate <= dates[0] && endDate >= dates[dates.length - 1]) {
        startCol = 0;
        endCol = dates.length - 1;
      } else {
        return;
      }
    }

    // Clamp to visible range
    startCol = Math.max(0, startCol);
    endCol = Math.min(dates.length - 1, endCol);

    const barX = x + startCol * columnWidth + 4;
    const barWidth = (endCol - startCol + 1) * columnWidth - 8;
    const barHeight = height - 10;

    // Draw bar background
    ctx.fillStyle = hexToRgba(color, 0.3);
    drawRoundedRect(ctx, barX, y, barWidth, barHeight, 8);
    ctx.fill();

    // Draw bar border
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, barX, y, barWidth, barHeight, 8);
    ctx.stroke();

    // Draw project name inside bar
    ctx.font = `bold ${Math.min(fontSizes.small, barHeight - 10)}px ${fontFamilies.primary}`;
    ctx.fillStyle = colors.textPrimary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const projectName = truncateText(ctx, assignment.project_name, barWidth - 20);
    ctx.fillText(projectName, barX + 10, y + barHeight / 2);
  }

  private drawTodayIndicator(
    ctx: CanvasRenderingContext2D,
    dates: Date[],
    x: number,
    y: number,
    columnWidth: number,
    height: number
  ): void {
    const today = new Date();
    const todayIndex = dates.findIndex((d) => isSameDay(d, today));

    if (todayIndex === -1) return;

    const lineX = x + todayIndex * columnWidth + columnWidth / 2;

    ctx.strokeStyle = colors.chartBar;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(lineX, y);
    ctx.lineTo(lineX, y + height);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawLegend(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const items = [
      { color: colors.pencil, label: 'Penciled' },
      { color: colors.pendingConfirm, label: 'Pending' },
      { color: colors.confirmed, label: 'Confirmed' },
    ];

    let currentX = x;

    items.forEach((item) => {
      // Draw color box
      ctx.fillStyle = hexToRgba(item.color, 0.3);
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, currentX, y, 30, 25, 5);
      ctx.fill();
      ctx.stroke();

      // Draw label
      ctx.font = `${fontSizes.small}px ${fontFamilies.primary}`;
      ctx.fillStyle = colors.textSecondary;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.label, currentX + 40, y + 12);

      currentX += 180;
    });
  }
}
