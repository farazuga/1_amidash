import type { CanvasRenderingContext2D } from 'canvas';
import { BaseSlide, SlideRenderContext } from './base-slide.js';
import type { SignageProject } from '../../types/database.js';
import { colors, getStatusColor } from '../components/colors.js';
import { fontSizes, fontFamilies, drawText, formatCurrency, formatDate, truncateText } from '../components/text.js';
import { drawStatusBadge } from '../components/charts.js';

export interface ActiveProjectsData {
  projects: SignageProject[];
}

/**
 * Active Projects Board slide
 * Displays a table of current projects with status, client, and due dates
 */
export class ActiveProjectsSlide extends BaseSlide {
  render(context: SlideRenderContext, data: ActiveProjectsData): void {
    const { ctx, width, height } = context;

    // Draw background
    this.drawBackground(ctx, width, height);

    // Draw header
    const headerHeight = this.drawHeader(context, this.config.title || 'Active Projects');

    // Draw stale indicator if needed
    this.drawStaleIndicator(context);

    // Check for data
    if (!data?.projects || data.projects.length === 0) {
      this.drawNoData(ctx, width, height, 'No active projects');
      return;
    }

    // Configuration
    const padding = 60;
    const rowHeight = 90;
    const tableTop = headerHeight + 40;
    const maxItems = this.config.maxItems || 15;

    // Calculate available space and items to show
    const availableHeight = height - tableTop - padding;
    const maxRows = Math.floor(availableHeight / rowHeight) - 1; // -1 for header
    const itemsToShow = Math.min(data.projects.length, maxItems, maxRows);
    const projects = data.projects.slice(0, itemsToShow);

    // Define columns
    const columns = this.getColumns(width, padding);

    // Draw table header
    this.drawTableHeader(ctx, columns, tableTop);

    // Draw header divider
    this.drawDivider(ctx, padding, tableTop + 60, width - padding * 2);

    // Draw rows
    let y = tableTop + 80;
    projects.forEach((project, index) => {
      this.drawProjectRow(ctx, project, y, columns, index % 2 === 0);
      y += rowHeight;
    });

    // Draw "showing X of Y" footer if truncated
    if (data.projects.length > itemsToShow) {
      ctx.font = `${fontSizes.small}px ${fontFamilies.primary}`;
      ctx.fillStyle = colors.textMuted;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(
        `Showing ${itemsToShow} of ${data.projects.length} projects`,
        width - padding,
        height - 30
      );
    }
  }

  private getColumns(width: number, padding: number) {
    const showSalesAmount = this.config.showSalesAmount !== false;
    const showStatus = this.config.showStatus !== false;
    const showDueDate = this.config.showDueDate !== false;

    // Calculate column positions based on what's shown
    let x = padding;
    const columns: { label: string; x: number; width: number; key: string; align?: CanvasTextAlign }[] = [];

    // Client name - takes remaining space
    let clientWidth = width - padding * 2;
    if (showSalesAmount) clientWidth -= 300;
    if (showStatus) clientWidth -= 350;
    if (showDueDate) clientWidth -= 250;

    columns.push({ label: 'Client', x, width: Math.max(clientWidth, 400), key: 'client' });
    x += columns[0].width;

    if (showSalesAmount) {
      columns.push({ label: 'Amount', x, width: 300, key: 'amount', align: 'right' });
      x += 300;
    }

    if (showStatus) {
      columns.push({ label: 'Status', x, width: 350, key: 'status', align: 'center' });
      x += 350;
    }

    if (showDueDate) {
      columns.push({ label: 'Due Date', x, width: 250, key: 'dueDate', align: 'right' });
    }

    return columns;
  }

  private drawProjectRow(
    ctx: CanvasRenderingContext2D,
    project: SignageProject,
    y: number,
    columns: { label: string; x: number; width: number; key: string; align?: CanvasTextAlign }[],
    isEven: boolean
  ): void {
    // Draw row background for alternating rows
    if (isEven) {
      ctx.fillStyle = colors.backgroundLight;
      ctx.fillRect(columns[0].x - 20, y - 10, columns.reduce((sum, c) => sum + c.width, 0) + 40, 80);
    }

    columns.forEach((col) => {
      switch (col.key) {
        case 'client':
          this.drawClientCell(ctx, project, col.x, y, col.width);
          break;
        case 'amount':
          this.drawAmountCell(ctx, project, col.x, y, col.width);
          break;
        case 'status':
          this.drawStatusCell(ctx, project, col.x, y, col.width);
          break;
        case 'dueDate':
          this.drawDueDateCell(ctx, project, col.x, y, col.width);
          break;
      }
    });
  }

  private drawClientCell(ctx: CanvasRenderingContext2D, project: SignageProject, x: number, y: number, width: number): void {
    ctx.font = `bold ${fontSizes.body}px ${fontFamilies.primary}`;
    ctx.fillStyle = colors.textPrimary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const clientName = truncateText(ctx, project.client_name, width - 40);
    ctx.fillText(clientName, x, y + 30);

    // Draw PO number below if exists
    if (project.po_number) {
      ctx.font = `${fontSizes.small}px ${fontFamilies.primary}`;
      ctx.fillStyle = colors.textMuted;
      ctx.fillText(`PO: ${project.po_number}`, x, y + 60);
    }
  }

  private drawAmountCell(ctx: CanvasRenderingContext2D, project: SignageProject, x: number, y: number, width: number): void {
    ctx.font = `bold ${fontSizes.body}px ${fontFamilies.primary}`;
    ctx.fillStyle = colors.chartBar;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatCurrency(project.sales_amount), x + width - 40, y + 40);
  }

  private drawStatusCell(ctx: CanvasRenderingContext2D, project: SignageProject, x: number, y: number, width: number): void {
    const statusName = project.current_status?.name || 'Unknown';
    const statusColor = getStatusColor(statusName);

    // Center the badge in the column
    const badgeWidth = drawStatusBadge(
      ctx,
      statusName,
      x + (width - 180) / 2,
      y + 20,
      statusColor,
      { minWidth: 180, height: 45, fontSize: fontSizes.small }
    );
  }

  private drawDueDateCell(ctx: CanvasRenderingContext2D, project: SignageProject, x: number, y: number, width: number): void {
    const dueDate = project.goal_completion_date;
    const isOverdue = dueDate && new Date(dueDate) < new Date();

    ctx.font = `${fontSizes.body}px ${fontFamilies.primary}`;
    ctx.fillStyle = isOverdue ? colors.statusRed : colors.textSecondary;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatDate(dueDate), x + width - 40, y + 40);
  }
}
