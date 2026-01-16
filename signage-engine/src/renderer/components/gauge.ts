import { SKRSContext2D } from '@napi-rs/canvas';
import { colors, hexToRgba } from './colors.js';
import { drawText } from './text.js';

export interface GaugeOptions {
  title?: string;
  subtitle?: string;
  valueLabel?: string;
  minValue?: number;
  maxValue?: number;
  thresholds?: {
    low: number; // Below this = red
    medium: number; // Below this = amber, above = green
  };
  showNeedle?: boolean;
  animated?: boolean;
  animationProgress?: number; // 0-1 for animation
}

/**
 * Draw a semi-circular speedometer gauge
 */
export function drawGauge(
  ctx: SKRSContext2D,
  value: number,
  centerX: number,
  centerY: number,
  radius: number,
  options: GaugeOptions = {}
): void {
  const {
    title,
    subtitle,
    valueLabel,
    minValue = 0,
    maxValue = 100,
    thresholds = { low: 60, medium: 80 },
    showNeedle = true,
    animated = false,
    animationProgress = 1,
  } = options;

  const normalizedValue = Math.max(minValue, Math.min(maxValue, value));
  const displayValue = animated
    ? minValue + (normalizedValue - minValue) * animationProgress
    : normalizedValue;
  const percentage = ((displayValue - minValue) / (maxValue - minValue)) * 100;

  // Gauge arc parameters
  const startAngle = Math.PI; // 180 degrees (left)
  const endAngle = 2 * Math.PI; // 360 degrees (right)
  const arcWidth = radius * 0.15;

  // Draw background arc (track)
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, startAngle, endAngle);
  ctx.lineWidth = arcWidth;
  ctx.strokeStyle = hexToRgba(colors.white, 0.1);
  ctx.lineCap = 'round';
  ctx.stroke();

  // Draw colored zones
  const lowAngle = startAngle + (thresholds.low / 100) * Math.PI;
  const mediumAngle = startAngle + (thresholds.medium / 100) * Math.PI;

  // Red zone (0 to low threshold)
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, startAngle, lowAngle);
  ctx.lineWidth = arcWidth;
  ctx.strokeStyle = hexToRgba(colors.error, 0.4);
  ctx.lineCap = 'butt';
  ctx.stroke();

  // Amber zone (low to medium threshold)
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, lowAngle, mediumAngle);
  ctx.lineWidth = arcWidth;
  ctx.strokeStyle = hexToRgba(colors.warning, 0.4);
  ctx.stroke();

  // Green zone (medium to 100%)
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, mediumAngle, endAngle);
  ctx.lineWidth = arcWidth;
  ctx.strokeStyle = hexToRgba(colors.success, 0.4);
  ctx.stroke();

  // Draw filled arc based on value
  const valueAngle = startAngle + (percentage / 100) * Math.PI;
  const fillColor = getGaugeColor(percentage, thresholds);

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, startAngle, valueAngle);
  ctx.lineWidth = arcWidth;
  ctx.strokeStyle = fillColor;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Draw glow effect on the filled arc
  ctx.save();
  ctx.shadowColor = fillColor;
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, startAngle, valueAngle);
  ctx.lineWidth = arcWidth * 0.5;
  ctx.strokeStyle = fillColor;
  ctx.stroke();
  ctx.restore();

  // Draw needle
  if (showNeedle) {
    drawNeedle(ctx, centerX, centerY, radius, valueAngle, fillColor);
  }

  // Draw center circle
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(colors.primary, 0.9);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = fillColor;
  ctx.fill();

  // Draw percentage value in center
  drawText(ctx, `${Math.round(displayValue)}%`, centerX, centerY + 5, {
    font: 'Karla, Inter',
    size: radius * 0.35,
    weight: 700,
    color: colors.white,
    align: 'center',
    baseline: 'middle',
  });

  // Draw title above gauge
  if (title) {
    drawText(ctx, title.toUpperCase(), centerX, centerY - radius - 30, {
      font: 'Karla, Inter',
      size: radius * 0.18,
      weight: 700,
      color: colors.white,
      align: 'center',
      letterSpacing: 2,
    });
  }

  // Draw subtitle/label below gauge
  if (subtitle || valueLabel) {
    const label = valueLabel || subtitle;
    drawText(ctx, label!, centerX, centerY + radius * 0.45, {
      font: 'Karla, Inter',
      size: radius * 0.14,
      color: hexToRgba(colors.white, 0.7),
      align: 'center',
    });
  }
}

/**
 * Draw the needle indicator
 */
function drawNeedle(
  ctx: SKRSContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  angle: number,
  color: string
): void {
  const needleLength = radius * 0.7;
  const needleWidth = radius * 0.04;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(angle - Math.PI / 2);

  // Draw needle shadow
  ctx.beginPath();
  ctx.moveTo(-needleWidth * 1.5, 0);
  ctx.lineTo(0, -needleLength);
  ctx.lineTo(needleWidth * 1.5, 0);
  ctx.closePath();
  ctx.fillStyle = hexToRgba(colors.black, 0.3);
  ctx.fill();

  // Draw needle
  ctx.beginPath();
  ctx.moveTo(-needleWidth, 0);
  ctx.lineTo(0, -needleLength + 5);
  ctx.lineTo(needleWidth, 0);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  // Needle tip glow
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(0, -needleLength + 20, needleWidth * 2, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

/**
 * Get the appropriate color based on value and thresholds
 */
export function getGaugeColor(
  percentage: number,
  thresholds: { low: number; medium: number }
): string {
  if (percentage < thresholds.low) {
    return colors.error;
  } else if (percentage < thresholds.medium) {
    return colors.warning;
  } else {
    return colors.success;
  }
}

/**
 * Draw a mini gauge (compact version for smaller spaces)
 */
export function drawMiniGauge(
  ctx: SKRSContext2D,
  value: number,
  centerX: number,
  centerY: number,
  radius: number,
  label: string,
  thresholds: { low: number; medium: number } = { low: 60, medium: 80 }
): void {
  const normalizedValue = Math.max(0, Math.min(100, value));
  const fillColor = getGaugeColor(normalizedValue, thresholds);

  // Background arc
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, Math.PI, 2 * Math.PI);
  ctx.lineWidth = radius * 0.2;
  ctx.strokeStyle = hexToRgba(colors.white, 0.1);
  ctx.lineCap = 'round';
  ctx.stroke();

  // Value arc
  const valueAngle = Math.PI + (normalizedValue / 100) * Math.PI;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, Math.PI, valueAngle);
  ctx.lineWidth = radius * 0.2;
  ctx.strokeStyle = fillColor;
  ctx.stroke();

  // Value text
  drawText(ctx, `${Math.round(value)}%`, centerX, centerY - 5, {
    font: 'Karla, Inter',
    size: radius * 0.5,
    weight: 700,
    color: fillColor,
    align: 'center',
    baseline: 'middle',
  });

  // Label
  drawText(ctx, label, centerX, centerY + radius * 0.6, {
    font: 'Karla, Inter',
    size: radius * 0.25,
    color: hexToRgba(colors.white, 0.7),
    align: 'center',
  });
}

/**
 * Draw a horizontal gauge bar (alternative style)
 */
export function drawHorizontalGauge(
  ctx: SKRSContext2D,
  value: number,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    label?: string;
    showValue?: boolean;
    thresholds?: { low: number; medium: number };
  } = {}
): void {
  const {
    label,
    showValue = true,
    thresholds = { low: 60, medium: 80 },
  } = options;

  const normalizedValue = Math.max(0, Math.min(100, value));
  const fillColor = getGaugeColor(normalizedValue, thresholds);
  const fillWidth = (normalizedValue / 100) * width;

  // Background
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, height / 2);
  ctx.fillStyle = hexToRgba(colors.white, 0.1);
  ctx.fill();

  // Colored fill
  if (fillWidth > 0) {
    ctx.beginPath();
    ctx.roundRect(x, y, fillWidth, height, height / 2);
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Glow
    ctx.save();
    ctx.shadowColor = fillColor;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(x, y, fillWidth, height, height / 2);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.restore();
  }

  // Label on left
  if (label) {
    drawText(ctx, label, x - 10, y + height / 2, {
      font: 'Karla, Inter',
      size: height * 0.7,
      color: hexToRgba(colors.white, 0.7),
      align: 'right',
      baseline: 'middle',
    });
  }

  // Value on right
  if (showValue) {
    drawText(ctx, `${Math.round(value)}%`, x + width + 15, y + height / 2, {
      font: 'Karla, Inter',
      size: height * 0.8,
      weight: 700,
      color: fillColor,
      align: 'left',
      baseline: 'middle',
    });
  }
}
