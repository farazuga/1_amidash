import { CanvasRenderingContext2D } from 'canvas';

export interface TextStyle {
  font?: string;
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  maxWidth?: number;
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: TextStyle = {}
): void {
  const {
    font = 'Inter',
    size = 24,
    color = '#ffffff',
    align = 'left',
    baseline = 'top',
    maxWidth,
  } = style;

  ctx.font = `${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;

  if (maxWidth) {
    ctx.fillText(text, x, y, maxWidth);
  } else {
    ctx.fillText(text, x, y);
  }
}

export function drawTextWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  style: TextStyle = {}
): number {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  const { font = 'Inter', size = 24, color = '#ffffff' } = style;
  ctx.font = `${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = style.align || 'left';
  ctx.textBaseline = style.baseline || 'top';

  for (const word of words) {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && line !== '') {
      ctx.fillText(line.trim(), x, currentY);
      line = word + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }

  if (line.trim()) {
    ctx.fillText(line.trim(), x, currentY);
    currentY += lineHeight;
  }

  return currentY;
}

export function measureText(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
  size: number
): number {
  ctx.font = `${size}px ${font}`;
  return ctx.measureText(text).width;
}

export function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: string,
  size: number
): string {
  ctx.font = `${size}px ${font}`;

  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }

  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }

  return truncated + '...';
}
