import type { CanvasRenderingContext2D } from 'canvas';
import { colors, hexToRgba } from './colors.js';
import { fontSizes, fontFamilies, formatCompactNumber, formatCurrency } from './text.js';

export interface BarChartData {
  label: string;
  value: number;
  goal?: number;
}

export interface ProgressBarOptions {
  width: number;
  height: number;
  borderRadius?: number;
  backgroundColor?: string;
  fillColor?: string;
  showLabel?: boolean;
  labelPosition?: 'inside' | 'right';
}

/**
 * Draw a horizontal progress bar
 */
export function drawProgressBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  progress: number, // 0-100
  options: ProgressBarOptions
): void {
  const {
    width,
    height,
    borderRadius = height / 2,
    backgroundColor = colors.chartBackground,
    fillColor = colors.chartBar,
    showLabel = true,
    labelPosition = 'inside',
  } = options;

  const clampedProgress = Math.max(0, Math.min(100, progress));
  const fillWidth = (width * clampedProgress) / 100;

  // Draw background
  ctx.fillStyle = backgroundColor;
  drawRoundedRect(ctx, x, y, width, height, borderRadius);
  ctx.fill();

  // Draw fill
  if (fillWidth > 0) {
    ctx.fillStyle = fillColor;
    drawRoundedRect(ctx, x, y, Math.max(fillWidth, borderRadius * 2), height, borderRadius);
    ctx.fill();
  }

  // Draw label
  if (showLabel) {
    const label = `${Math.round(clampedProgress)}%`;
    ctx.font = `bold ${Math.min(height - 8, fontSizes.small)}px ${fontFamilies.primary}`;

    if (labelPosition === 'inside' && fillWidth > 60) {
      ctx.fillStyle = colors.textPrimary;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + fillWidth - 10, y + height / 2);
    } else {
      ctx.fillStyle = colors.textSecondary;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + width + 15, y + height / 2);
    }
  }
}

/**
 * Draw a vertical bar chart
 */
export function drawBarChart(
  ctx: CanvasRenderingContext2D,
  data: BarChartData[],
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    barColor?: string;
    goalColor?: string;
    showValues?: boolean;
    showGoalLine?: boolean;
    animate?: boolean;
    animationProgress?: number;
  } = {}
): void {
  const {
    barColor = colors.chartBar,
    goalColor = colors.chartGoal,
    showValues = true,
    showGoalLine = true,
    animationProgress = 1,
  } = options;

  if (data.length === 0) return;

  const padding = 20;
  const labelHeight = 50;
  const chartHeight = height - labelHeight - padding;
  const chartY = y + padding;

  // Calculate bar dimensions
  const totalBars = data.length;
  const barGap = 20;
  const availableWidth = width - (totalBars - 1) * barGap;
  const barWidth = Math.min(availableWidth / totalBars, 120);

  // Find max value for scaling
  const maxValue = Math.max(
    ...data.map((d) => Math.max(d.value, d.goal || 0)),
    1
  );

  // Draw bars
  data.forEach((item, i) => {
    const barX = x + i * (barWidth + barGap) + (width - totalBars * barWidth - (totalBars - 1) * barGap) / 2;
    const barHeight = (item.value / maxValue) * chartHeight * animationProgress;

    // Draw bar
    ctx.fillStyle = barColor;
    drawRoundedRect(
      ctx,
      barX,
      chartY + chartHeight - barHeight,
      barWidth,
      barHeight,
      8
    );
    ctx.fill();

    // Draw goal line if exists
    if (showGoalLine && item.goal) {
      const goalY = chartY + chartHeight - (item.goal / maxValue) * chartHeight;
      ctx.strokeStyle = goalColor;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(barX - 5, goalY);
      ctx.lineTo(barX + barWidth + 5, goalY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw value on top of bar
    if (showValues && animationProgress >= 1) {
      ctx.font = `bold ${fontSizes.small}px ${fontFamilies.primary}`;
      ctx.fillStyle = colors.textPrimary;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(
        formatCompactNumber(item.value),
        barX + barWidth / 2,
        chartY + chartHeight - barHeight - 10
      );
    }

    // Draw label below bar
    ctx.font = `${fontSizes.small}px ${fontFamilies.primary}`;
    ctx.fillStyle = colors.textSecondary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(item.label, barX + barWidth / 2, y + height - labelHeight + 10);
  });
}

/**
 * Draw a KPI card
 */
export function drawKPICard(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: number,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    format?: 'currency' | 'number' | 'percent';
    goal?: number;
    showProgress?: boolean;
    accentColor?: string;
  } = {}
): void {
  const {
    format = 'currency',
    goal,
    showProgress = true,
    accentColor = colors.primary,
  } = options;

  // Draw card background
  ctx.fillStyle = colors.backgroundLight;
  drawRoundedRect(ctx, x, y, width, height, 16);
  ctx.fill();

  // Draw accent bar on left
  ctx.fillStyle = accentColor;
  ctx.fillRect(x, y + 20, 6, height - 40);

  // Format value
  let displayValue: string;
  switch (format) {
    case 'currency':
      displayValue = formatCurrency(value);
      break;
    case 'percent':
      displayValue = `${Math.round(value)}%`;
      break;
    default:
      displayValue = formatCompactNumber(value);
  }

  // Draw label
  ctx.font = `${fontSizes.heading}px ${fontFamilies.primary}`;
  ctx.fillStyle = colors.textSecondary;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label.toUpperCase(), x + 30, y + 30);

  // Draw value
  ctx.font = `bold ${fontSizes.title}px ${fontFamilies.primary}`;
  ctx.fillStyle = colors.textPrimary;
  ctx.fillText(displayValue, x + 30, y + 80);

  // Draw progress bar if goal exists
  if (showProgress && goal && goal > 0) {
    const progress = (value / goal) * 100;
    const progressY = y + height - 60;

    // Goal label
    ctx.font = `${fontSizes.small}px ${fontFamilies.primary}`;
    ctx.fillStyle = colors.textMuted;
    ctx.fillText(`Goal: ${formatCurrency(goal)}`, x + 30, progressY - 30);

    // Progress bar
    drawProgressBar(ctx, x + 30, progressY, progress, {
      width: width - 60,
      height: 20,
      fillColor: progress >= 100 ? colors.statusGreen : accentColor,
    });
  }
}

/**
 * Draw a circular progress ring
 */
export function drawProgressRing(
  ctx: CanvasRenderingContext2D,
  progress: number, // 0-100
  x: number,
  y: number,
  radius: number,
  options: {
    strokeWidth?: number;
    backgroundColor?: string;
    progressColor?: string;
    label?: string;
    showPercent?: boolean;
  } = {}
): void {
  const {
    strokeWidth = 20,
    backgroundColor = colors.chartBackground,
    progressColor = colors.chartBar,
    label,
    showPercent = true,
  } = options;

  const clampedProgress = Math.max(0, Math.min(100, progress));
  const startAngle = -Math.PI / 2; // Start from top
  const endAngle = startAngle + (2 * Math.PI * clampedProgress) / 100;

  // Draw background ring
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.strokeStyle = backgroundColor;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Draw progress arc
  if (clampedProgress > 0) {
    ctx.beginPath();
    ctx.arc(x, y, radius, startAngle, endAngle);
    ctx.strokeStyle = progressColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Draw center text
  if (showPercent) {
    ctx.font = `bold ${radius * 0.5}px ${fontFamilies.primary}`;
    ctx.fillStyle = colors.textPrimary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(clampedProgress)}%`, x, y);
  }

  // Draw label below
  if (label) {
    ctx.font = `${fontSizes.small}px ${fontFamilies.primary}`;
    ctx.fillStyle = colors.textSecondary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x, y + radius + strokeWidth + 15);
  }
}

/**
 * Draw a rounded rectangle path
 */
export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Draw a status badge
 */
export function drawStatusBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  options: {
    minWidth?: number;
    height?: number;
    fontSize?: number;
  } = {}
): number {
  const {
    minWidth = 100,
    height = 40,
    fontSize = fontSizes.small,
  } = options;

  ctx.font = `bold ${fontSize}px ${fontFamilies.primary}`;
  const textWidth = ctx.measureText(text).width;
  const badgeWidth = Math.max(minWidth, textWidth + 30);

  // Draw badge background
  ctx.fillStyle = hexToRgba(color, 0.2);
  drawRoundedRect(ctx, x, y, badgeWidth, height, height / 2);
  ctx.fill();

  // Draw badge border
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, x, y, badgeWidth, height, height / 2);
  ctx.stroke();

  // Draw text
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + badgeWidth / 2, y + height / 2);

  return badgeWidth;
}
