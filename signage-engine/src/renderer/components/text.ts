import type { CanvasRenderingContext2D } from 'canvas';
import { colors } from './colors.js';

/**
 * Font sizes scaled for 4K display
 */
export const fontSizes = {
  title: 96,        // Main slide titles
  subtitle: 64,     // Section headers
  heading: 48,      // Table headers, KPI labels
  body: 36,         // Regular text
  small: 28,        // Secondary info
  tiny: 24,         // Timestamps, footnotes
};

/**
 * Font families
 */
export const fontFamilies = {
  primary: 'Inter, Arial, sans-serif',
  mono: 'Menlo, Monaco, monospace',
};

/**
 * Draw text with automatic truncation
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: {
    font?: string;
    color?: string;
    maxWidth?: number;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
  } = {}
): void {
  const {
    font = `${fontSizes.body}px ${fontFamilies.primary}`,
    color = colors.textPrimary,
    maxWidth,
    align = 'left',
    baseline = 'top',
  } = options;

  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;

  let displayText = text;
  if (maxWidth) {
    displayText = truncateText(ctx, text, maxWidth);
  }

  ctx.fillText(displayText, x, y);
}

/**
 * Truncate text to fit within a maximum width
 */
export function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  ellipsis: string = '...'
): string {
  const metrics = ctx.measureText(text);
  if (metrics.width <= maxWidth) {
    return text;
  }

  let truncated = text;
  const ellipsisWidth = ctx.measureText(ellipsis).width;

  while (truncated.length > 0) {
    truncated = truncated.slice(0, -1);
    const width = ctx.measureText(truncated).width + ellipsisWidth;
    if (width <= maxWidth) {
      return truncated + ellipsis;
    }
  }

  return ellipsis;
}

/**
 * Measure text width
 */
export function measureText(
  ctx: CanvasRenderingContext2D,
  text: string,
  font?: string
): number {
  if (font) {
    ctx.font = font;
  }
  return ctx.measureText(text).width;
}

/**
 * Draw multiline text with word wrap
 */
export function drawMultilineText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: {
    font?: string;
    color?: string;
    maxWidth: number;
    lineHeight?: number;
    maxLines?: number;
    align?: CanvasTextAlign;
  }
): number {
  const {
    font = `${fontSizes.body}px ${fontFamilies.primary}`,
    color = colors.textPrimary,
    maxWidth,
    lineHeight = 1.3,
    maxLines = Infinity,
    align = 'left',
  } = options;

  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';

  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  // Calculate font size from font string
  const fontSizeMatch = font.match(/(\d+)px/);
  const fontSize = fontSizeMatch ? parseInt(fontSizeMatch[1]) : fontSizes.body;

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;

      if (lines.length >= maxLines) {
        break;
      }
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  // If we hit max lines, add ellipsis to last line
  if (lines.length === maxLines && words.length > 0) {
    const lastLine = lines[lines.length - 1];
    lines[lines.length - 1] = truncateText(ctx, lastLine, maxWidth, '...');
  }

  // Draw lines
  const lineSpacing = fontSize * lineHeight;
  lines.forEach((line, i) => {
    ctx.fillText(line, x, y + i * lineSpacing);
  });

  return lines.length * lineSpacing;
}

/**
 * Draw a slide title
 */
export function drawSlideTitle(
  ctx: CanvasRenderingContext2D,
  title: string,
  x: number,
  y: number,
  options: {
    color?: string;
    font?: string;
  } = {}
): void {
  const {
    color = colors.textPrimary,
    font = `bold ${fontSizes.title}px ${fontFamilies.primary}`,
  } = options;

  drawText(ctx, title, x, y, { font, color });
}

/**
 * Draw a section heading
 */
export function drawSectionHeading(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: {
    color?: string;
    font?: string;
  } = {}
): void {
  const {
    color = colors.textSecondary,
    font = `${fontSizes.subtitle}px ${fontFamilies.primary}`,
  } = options;

  drawText(ctx, text.toUpperCase(), x, y, { font, color });
}

/**
 * Draw a timestamp
 */
export function drawTimestamp(
  ctx: CanvasRenderingContext2D,
  date: Date,
  x: number,
  y: number,
  options: {
    format?: 'time' | 'date' | 'datetime';
    color?: string;
    align?: CanvasTextAlign;
  } = {}
): void {
  const { format = 'datetime', color = colors.textMuted, align = 'left' } = options;

  let text: string;
  switch (format) {
    case 'time':
      text = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      break;
    case 'date':
      text = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      break;
    case 'datetime':
    default:
      text = date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
  }

  drawText(ctx, text, x, y, {
    font: `${fontSizes.small}px ${fontFamilies.primary}`,
    color,
    align,
  });
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return '-';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format large numbers with K/M suffix
 */
export function formatCompactNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * Format date for display
 */
export function formatDate(date: string | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
