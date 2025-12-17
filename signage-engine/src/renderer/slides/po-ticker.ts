import type { CanvasRenderingContext2D } from 'canvas';
import { BaseSlide, SlideRenderContext } from './base-slide.js';
import type { PurchaseOrder } from '../../types/database.js';
import { colors } from '../components/colors.js';
import { fontSizes, fontFamilies, formatCurrency, truncateText } from '../components/text.js';
import { drawRoundedRect } from '../components/charts.js';

export interface POTickerData {
  pos: PurchaseOrder[];
}

/**
 * PO Ticker slide
 * Displays recent purchase orders in a horizontally scrolling ticker
 */
export class POTickerSlide extends BaseSlide {
  private scrollOffset: number = 0;
  private lastRenderTime: number = 0;

  render(context: SlideRenderContext, data: POTickerData): void {
    const { ctx, width, height } = context;

    // Draw background
    this.drawBackground(ctx, width, height);

    // Draw header
    const headerHeight = this.drawHeader(context, this.config.title || 'Recent Purchase Orders');

    // Draw stale indicator if needed
    this.drawStaleIndicator(context);

    // Check for data
    if (!data?.pos || data.pos.length === 0) {
      this.drawNoData(ctx, width, height, 'No recent purchase orders');
      return;
    }

    // Configuration
    const padding = 60;
    const cardWidth = 500;
    const cardHeight = 300;
    const cardGap = 40;
    const scrollSpeed = this.config.scrollSpeed || 2;

    // Calculate ticker area
    const tickerY = headerHeight + (height - headerHeight - cardHeight) / 2;
    const totalContentWidth = data.pos.length * (cardWidth + cardGap);

    // Update scroll position
    const now = Date.now();
    if (this.lastRenderTime > 0) {
      const deltaTime = (now - this.lastRenderTime) / 16.67; // Normalize to 60fps
      this.scrollOffset -= scrollSpeed * deltaTime;

      // Reset scroll when all cards have passed
      if (this.scrollOffset < -(totalContentWidth)) {
        this.scrollOffset = width;
      }
    } else {
      // Initial position - start from right edge
      this.scrollOffset = width;
    }
    this.lastRenderTime = now;

    // Draw PO cards
    data.pos.forEach((po, index) => {
      const cardX = this.scrollOffset + index * (cardWidth + cardGap);

      // Only render cards that are visible (plus some buffer)
      if (cardX > -cardWidth - 100 && cardX < width + 100) {
        this.drawPOCard(ctx, po, cardX, tickerY, cardWidth, cardHeight);
      }
    });

    // Draw gradient fade on edges for smooth appearance
    this.drawEdgeFade(ctx, width, headerHeight, height - headerHeight);

    // Draw total count and value summary at bottom
    this.drawSummary(ctx, data.pos, width, height, padding);
  }

  private drawPOCard(
    ctx: CanvasRenderingContext2D,
    po: PurchaseOrder,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    // Draw card background
    ctx.fillStyle = colors.backgroundLight;
    drawRoundedRect(ctx, x, y, width, height, 20);
    ctx.fill();

    // Draw accent bar at top
    ctx.fillStyle = colors.primary;
    ctx.fillRect(x, y, width, 8);
    // Round the top corners
    ctx.fillStyle = colors.backgroundLight;
    drawRoundedRect(ctx, x, y + 4, width, height - 4, 20);
    ctx.fill();
    ctx.fillStyle = colors.primary;
    ctx.fillRect(x + 10, y, width - 20, 8);

    const padding = 30;
    let currentY = y + 40;

    // Draw "NEW PO" label
    ctx.font = `bold ${fontSizes.small}px ${fontFamilies.primary}`;
    ctx.fillStyle = colors.chartBar;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('NEW PO', x + padding, currentY);
    currentY += 50;

    // Draw client name
    ctx.font = `bold ${fontSizes.subtitle}px ${fontFamilies.primary}`;
    ctx.fillStyle = colors.textPrimary;
    const clientName = truncateText(ctx, po.client_name, width - padding * 2);
    ctx.fillText(clientName, x + padding, currentY);
    currentY += 70;

    // Draw PO number
    ctx.font = `${fontSizes.body}px ${fontFamilies.primary}`;
    ctx.fillStyle = colors.textSecondary;
    ctx.fillText(`PO# ${po.po_number}`, x + padding, currentY);
    currentY += 50;

    // Draw amount (large, at bottom)
    ctx.font = `bold ${fontSizes.title}px ${fontFamilies.primary}`;
    ctx.fillStyle = colors.statusGreen;
    ctx.textAlign = 'center';
    ctx.fillText(formatCurrency(po.sales_amount), x + width / 2, y + height - 60);

    // Draw date
    if (po.created_at) {
      const date = new Date(po.created_at);
      ctx.font = `${fontSizes.tiny}px ${fontFamilies.primary}`;
      ctx.fillStyle = colors.textMuted;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(
        date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        x + width - padding,
        y + 40
      );
    }
  }

  private drawEdgeFade(
    ctx: CanvasRenderingContext2D,
    width: number,
    y: number,
    height: number
  ): void {
    const fadeWidth = 150;

    // Left fade
    const leftGradient = ctx.createLinearGradient(0, y, fadeWidth, y);
    leftGradient.addColorStop(0, colors.background);
    leftGradient.addColorStop(1, 'rgba(26, 26, 46, 0)');
    ctx.fillStyle = leftGradient;
    ctx.fillRect(0, y, fadeWidth, height);

    // Right fade
    const rightGradient = ctx.createLinearGradient(width - fadeWidth, y, width, y);
    rightGradient.addColorStop(0, 'rgba(26, 26, 46, 0)');
    rightGradient.addColorStop(1, colors.background);
    ctx.fillStyle = rightGradient;
    ctx.fillRect(width - fadeWidth, y, fadeWidth, height);
  }

  private drawSummary(
    ctx: CanvasRenderingContext2D,
    pos: PurchaseOrder[],
    width: number,
    height: number,
    padding: number
  ): void {
    const totalValue = pos.reduce((sum, po) => sum + (po.sales_amount || 0), 0);

    ctx.font = `${fontSizes.heading}px ${fontFamilies.primary}`;
    ctx.fillStyle = colors.textSecondary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(
      `${pos.length} New POs • Total: ${formatCurrency(totalValue)}`,
      width / 2,
      height - 40
    );
  }

  /**
   * Reset the scroll position (called when slide becomes active)
   */
  resetScroll(): void {
    this.scrollOffset = 0;
    this.lastRenderTime = 0;
  }
}
