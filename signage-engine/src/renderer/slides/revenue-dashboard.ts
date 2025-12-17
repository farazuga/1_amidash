import type { CanvasRenderingContext2D } from 'canvas';
import { BaseSlide, SlideRenderContext } from './base-slide.js';
import type { RevenueData } from '../../types/database.js';
import { colors } from '../components/colors.js';
import { fontSizes, fontFamilies, formatCurrency, formatCompactNumber } from '../components/text.js';
import { drawKPICard, drawBarChart, drawProgressRing, drawProgressBar, BarChartData } from '../components/charts.js';

/**
 * Revenue Dashboard slide
 * Displays KPI metrics, goals, and revenue charts
 */
export class RevenueDashboardSlide extends BaseSlide {
  render(context: SlideRenderContext, data: RevenueData | null): void {
    const { ctx, width, height } = context;

    // Draw background
    this.drawBackground(ctx, width, height);

    // Draw header
    const headerHeight = this.drawHeader(context, this.config.title || 'Revenue Dashboard');

    // Draw stale indicator if needed
    this.drawStaleIndicator(context);

    // Check for data
    if (!data) {
      this.drawNoData(ctx, width, height, 'Revenue data unavailable');
      return;
    }

    const padding = 60;
    const contentY = headerHeight + 40;
    const contentHeight = height - contentY - padding;

    // Layout: KPI cards on top, chart below
    const kpiRowHeight = 350;
    const chartAreaY = contentY + kpiRowHeight + 40;
    const chartAreaHeight = contentHeight - kpiRowHeight - 40;

    // Draw KPI cards
    this.drawKPIRow(ctx, data, padding, contentY, width - padding * 2, kpiRowHeight);

    // Draw revenue chart
    this.drawRevenueChart(ctx, data, padding, chartAreaY, width - padding * 2, chartAreaHeight);
  }

  private drawKPIRow(
    ctx: CanvasRenderingContext2D,
    data: RevenueData,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const cardWidth = (width - 60) / 3; // 3 cards with gaps
    const cardHeight = height - 40;
    const gap = 30;

    // Card 1: Current Month Revenue
    drawKPICard(
      ctx,
      'Revenue This Month',
      data.currentMonthRevenue,
      x,
      y,
      cardWidth,
      cardHeight,
      {
        format: 'currency',
        goal: data.monthlyGoal,
        showProgress: true,
        accentColor: colors.chartBar,
      }
    );

    // Card 2: Invoiced Revenue
    drawKPICard(
      ctx,
      'Invoiced',
      data.invoicedRevenue,
      x + cardWidth + gap,
      y,
      cardWidth,
      cardHeight,
      {
        format: 'currency',
        goal: data.invoicedGoal,
        showProgress: true,
        accentColor: colors.statusBlue,
      }
    );

    // Card 3: Pipeline with progress ring
    this.drawPipelineCard(
      ctx,
      data.pipelineTotal,
      data.monthProgress,
      x + (cardWidth + gap) * 2,
      y,
      cardWidth,
      cardHeight
    );
  }

  private drawPipelineCard(
    ctx: CanvasRenderingContext2D,
    pipelineTotal: number,
    monthProgress: number,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    // Draw card background
    this.drawCard(ctx, x, y, width, height);

    // Draw accent bar
    ctx.fillStyle = colors.statusPurple;
    ctx.fillRect(x, y + 20, 6, height - 40);

    // Draw label
    ctx.font = `${fontSizes.heading}px ${fontFamilies.primary}`;
    ctx.fillStyle = colors.textSecondary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('PIPELINE', x + 30, y + 30);

    // Draw pipeline value
    ctx.font = `bold ${fontSizes.title}px ${fontFamilies.primary}`;
    ctx.fillStyle = colors.textPrimary;
    ctx.fillText(formatCurrency(pipelineTotal), x + 30, y + 80);

    // Draw month progress ring on right side
    const ringRadius = 80;
    const ringX = x + width - ringRadius - 50;
    const ringY = y + height / 2;

    drawProgressRing(ctx, monthProgress, ringX, ringY, ringRadius, {
      strokeWidth: 15,
      progressColor: colors.statusPurple,
      label: 'Month Progress',
      showPercent: true,
    });
  }

  private drawRevenueChart(
    ctx: CanvasRenderingContext2D,
    data: RevenueData,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    // Draw chart background card
    this.drawCard(ctx, x, y, width, height);

    // Draw chart title
    ctx.font = `bold ${fontSizes.heading}px ${fontFamilies.primary}`;
    ctx.fillStyle = colors.textSecondary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('MONTHLY REVENUE', x + 40, y + 30);

    // Draw legend
    this.drawLegend(ctx, x + width - 400, y + 25);

    // Prepare chart data
    const chartData: BarChartData[] = data.monthlyData.map((m) => ({
      label: m.month,
      value: m.revenue,
      goal: m.goal,
    }));

    // Draw bar chart
    drawBarChart(
      ctx,
      chartData,
      x + 40,
      y + 80,
      width - 80,
      height - 120,
      {
        barColor: colors.chartBar,
        goalColor: colors.chartGoal,
        showValues: true,
        showGoalLine: true,
      }
    );
  }

  private drawLegend(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const items = [
      { color: colors.chartBar, label: 'Revenue' },
      { color: colors.chartGoal, label: 'Goal', isDashed: true },
    ];

    let currentX = x;

    items.forEach((item) => {
      // Draw color indicator
      if (item.isDashed) {
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.moveTo(currentX, y + 15);
        ctx.lineTo(currentX + 30, y + 15);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = item.color;
        ctx.fillRect(currentX, y + 5, 30, 20);
      }

      // Draw label
      ctx.font = `${fontSizes.small}px ${fontFamilies.primary}`;
      ctx.fillStyle = colors.textSecondary;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.label, currentX + 40, y + 15);

      currentX += 150;
    });
  }
}
