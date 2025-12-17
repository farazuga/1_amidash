import { CanvasRenderingContext2D } from 'canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
import { drawBarChart, drawKPICard, drawProgressBar, colors } from '../components/index.js';
import { drawText } from '../components/text.js';

export class RevenueDashboardSlide extends BaseSlide {
  render(ctx: CanvasRenderingContext2D, data: DataCache, _deltaTime: number): void {
    const headerHeight = this.drawHeader(ctx, this.config.title || 'Revenue Dashboard');

    const revenue = data.revenue.data;
    if (!revenue) return;

    const padding = 60;
    const cardGap = 40;
    const contentY = headerHeight + 60;

    // KPI Cards Row
    const cardWidth = (this.displayConfig.width - padding * 2 - cardGap * 3) / 4;
    const cardHeight = 160;

    // Current Month Revenue
    drawKPICard(
      ctx,
      'This Month',
      `$${(revenue.currentMonthRevenue / 1000).toFixed(0)}K`,
      `Goal: $${(revenue.currentMonthGoal / 1000).toFixed(0)}K`,
      padding,
      contentY,
      cardWidth,
      cardHeight
    );

    // Month Progress
    const monthProgress = revenue.currentMonthGoal > 0
      ? (revenue.currentMonthRevenue / revenue.currentMonthGoal * 100).toFixed(0)
      : '0';
    drawKPICard(
      ctx,
      'Month Progress',
      `${monthProgress}%`,
      revenue.currentMonthRevenue >= revenue.currentMonthGoal ? 'On Track' : 'Behind',
      padding + cardWidth + cardGap,
      contentY,
      cardWidth,
      cardHeight,
      {
        valueColor: revenue.currentMonthRevenue >= revenue.currentMonthGoal ? colors.success : colors.warning,
      }
    );

    // YTD Revenue
    drawKPICard(
      ctx,
      'Year to Date',
      `$${(revenue.yearToDateRevenue / 1000000).toFixed(2)}M`,
      `Goal: $${(revenue.yearToDateGoal / 1000000).toFixed(2)}M`,
      padding + (cardWidth + cardGap) * 2,
      contentY,
      cardWidth,
      cardHeight
    );

    // YTD Progress
    const ytdProgress = revenue.yearToDateGoal > 0
      ? (revenue.yearToDateRevenue / revenue.yearToDateGoal * 100).toFixed(0)
      : '0';
    drawKPICard(
      ctx,
      'YTD Progress',
      `${ytdProgress}%`,
      revenue.yearToDateRevenue >= revenue.yearToDateGoal ? 'Ahead of Goal' : 'Behind Goal',
      padding + (cardWidth + cardGap) * 3,
      contentY,
      cardWidth,
      cardHeight,
      {
        valueColor: revenue.yearToDateRevenue >= revenue.yearToDateGoal ? colors.success : colors.warning,
      }
    );

    // Progress bars
    const progressY = contentY + cardHeight + 60;
    const progressHeight = 30;

    drawText(ctx, 'Monthly Progress', padding, progressY, {
      font: this.displayConfig.fontFamily,
      size: 24,
      color: 'rgba(255, 255, 255, 0.7)',
    });
    drawProgressBar(
      ctx,
      revenue.currentMonthRevenue,
      revenue.currentMonthGoal,
      padding,
      progressY + 35,
      (this.displayConfig.width - padding * 2) / 2 - 20,
      progressHeight,
      { fillColor: colors.info }
    );

    drawText(ctx, 'YTD Progress', this.displayConfig.width / 2 + 20, progressY, {
      font: this.displayConfig.fontFamily,
      size: 24,
      color: 'rgba(255, 255, 255, 0.7)',
    });
    drawProgressBar(
      ctx,
      revenue.yearToDateRevenue,
      revenue.yearToDateGoal,
      this.displayConfig.width / 2 + 20,
      progressY + 35,
      (this.displayConfig.width - padding * 2) / 2 - 20,
      progressHeight,
      { fillColor: colors.success }
    );

    // Monthly Bar Chart
    const chartY = progressY + progressHeight + 100;
    const chartHeight = this.displayConfig.height - chartY - 80;

    drawText(ctx, 'Monthly Revenue vs Goals', padding, chartY - 40, {
      font: this.displayConfig.fontFamily,
      size: 28,
      color: colors.white,
    });

    const chartData = revenue.monthlyData.map((m) => ({
      label: m.month,
      value: m.revenue,
      color: colors.info,
      secondaryValue: m.goal,
      secondaryColor: 'rgba(255, 255, 255, 0.2)',
    }));

    drawBarChart(ctx, chartData, padding, chartY, this.displayConfig.width - padding * 2, chartHeight, {
      barGap: 20,
      fontSize: 20,
    });
  }
}
