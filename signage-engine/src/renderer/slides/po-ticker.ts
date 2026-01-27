import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
import { drawText, truncateText } from '../components/text.js';
import { roundRect, colors, hexToRgba } from '../components/index.js';
import { formatDistanceToNow, subDays, isAfter } from 'date-fns';

export class POTickerSlide extends BaseSlide {
  render(ctx: SKRSContext2D, data: DataCache, _deltaTime: number): void {
    // Update animations
    this.updateAnimationState(_deltaTime);
    this.drawAmbientEffects(ctx);

    const headerHeight = this.drawMinimalHeader(ctx, this.config.title || 'Recent Purchase Orders');

    const { width, height } = this.displayConfig;
    const padding = this.SCREEN_MARGIN;

    // Filter POs from last 10 days
    const tenDaysAgo = subDays(new Date(), 10);
    const sevenDaysAgo = subDays(new Date(), 7);

    const recentPOs = data.pos.data.filter(po =>
      isAfter(new Date(po.created_at), tenDaysAgo)
    );

    if (recentPOs.length === 0) {
      drawText(ctx, 'No recent purchase orders', width / 2, height / 2, {
        font: this.displayConfig.fontFamily,
        size: 64,
        color: hexToRgba(colors.white, 0.5),
        align: 'center',
      });
      return;
    }

    // Sort by amount to get top 3 largest
    const sortedByAmount = [...recentPOs].sort((a, b) => b.amount - a.amount);
    const top3 = sortedByAmount.slice(0, 3);

    // Get remaining POs from last 7 days (excluding top 3) - show more items
    const top3Ids = new Set(top3.map(po => po.id));
    const recentOthers = recentPOs
      .filter(po => !top3Ids.has(po.id) && isAfter(new Date(po.created_at), sevenDaysAgo))
      .slice(0, 9);

    // Layout calculations - reduced top section to show more content
    const topSectionHeight = (height - headerHeight - padding * 2) * 0.42;
    const bottomSectionY = headerHeight + padding + topSectionHeight + 50;
    const bottomSectionHeight = height - bottomSectionY - padding;

    // Draw "TOP ORDERS" section label - larger
    drawText(ctx, 'LARGEST ORDERS (LAST 10 DAYS)', padding, headerHeight + 30, {
      font: this.displayConfig.fontFamily,
      size: 36,
      weight: 600,
      color: hexToRgba(colors.white, 0.7),
    });

    // Draw top 3 large cards
    const topCardGap = 40;
    const topCardWidth = (width - padding * 2 - topCardGap * 2) / 3;
    const topCardHeight = topSectionHeight - 40;

    top3.forEach((po, index) => {
      const cardX = padding + index * (topCardWidth + topCardGap);
      const cardY = headerHeight + padding + 30;
      this.drawLargePOCard(ctx, po, cardX, cardY, topCardWidth, topCardHeight, index + 1);
    });

    // Draw "RECENT" section label if there are other POs
    if (recentOthers.length > 0) {
      drawText(ctx, 'RECENT ORDERS (LAST 7 DAYS)', padding, bottomSectionY - 20, {
        font: this.displayConfig.fontFamily,
        size: 36,
        weight: 600,
        color: hexToRgba(colors.white, 0.7),
      });

      // Draw remaining POs in a grid - fill available space
      const smallCardGap = 24;
      const cols = Math.min(3, recentOthers.length);
      const rows = Math.ceil(recentOthers.length / cols);
      const smallCardWidth = (width - padding * 2 - smallCardGap * (cols - 1)) / cols;
      // Allow cards to expand to fill remaining space (account for demo banner)
      const availableHeight = bottomSectionHeight - 80; // Leave room for connection status
      const smallCardHeight = (availableHeight - smallCardGap * (rows - 1)) / rows;

      recentOthers.forEach((po, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const cardX = padding + col * (smallCardWidth + smallCardGap);
        const cardY = bottomSectionY + row * (smallCardHeight + smallCardGap);
        this.drawSmallPOCard(ctx, po, cardX, cardY, smallCardWidth, smallCardHeight);
      });
    }
  }

  private drawLargePOCard(
    ctx: SKRSContext2D,
    po: { id: string; po_number: string; project_name: string; client_name: string; amount: number; created_at: string },
    x: number,
    y: number,
    width: number,
    height: number,
    rank: number
  ): void {
    const cardPadding = 30;

    // Card background
    roundRect(ctx, x, y, width, height, 16);
    ctx.fillStyle = hexToRgba(colors.white, 0.1);
    ctx.fill();

    // Rank badge (gold, silver, bronze) - compact
    const rankColors = [colors.amber, '#C0C0C0', '#CD7F32'];
    const rankColor = rankColors[rank - 1] || colors.mauve;

    ctx.beginPath();
    ctx.arc(x + cardPadding + 28, y + cardPadding + 28, 30, 0, Math.PI * 2);
    ctx.fillStyle = rankColor;
    ctx.fill();

    drawText(ctx, `#${rank}`, x + cardPadding + 28, y + cardPadding + 28, {
      font: this.displayConfig.fontFamily,
      size: 30,
      weight: 700,
      color: colors.white,
      align: 'center',
      baseline: 'middle',
    });

    // PO Number
    drawText(ctx, po.po_number, x + cardPadding + 75, y + cardPadding + 28, {
      font: this.displayConfig.fontFamily,
      size: 34,
      weight: 600,
      color: colors.primaryLight,
      baseline: 'middle',
    });

    // Amount - prominent but compact
    const amountStr = `$${po.amount.toLocaleString()}`;
    drawText(ctx, amountStr, x + width / 2, y + height / 2 - 5, {
      font: this.displayConfig.fontFamily,
      size: 72,
      weight: 700,
      color: colors.primaryLight,
      align: 'center',
    });

    // Project name
    drawText(
      ctx,
      truncateText(ctx, po.project_name, width - cardPadding * 2, this.displayConfig.fontFamily, 38),
      x + cardPadding,
      y + height - cardPadding - 65,
      {
        font: this.displayConfig.fontFamily,
        size: 38,
        weight: 600,
        color: colors.white,
      }
    );

    // Client name
    drawText(
      ctx,
      truncateText(ctx, po.client_name, width - cardPadding * 2, this.displayConfig.fontFamily, 30),
      x + cardPadding,
      y + height - cardPadding - 25,
      {
        font: this.displayConfig.fontFamily,
        size: 30,
        color: hexToRgba(colors.white, 0.7),
      }
    );

    // Time ago
    const timeAgo = formatDistanceToNow(new Date(po.created_at), { addSuffix: true });
    drawText(ctx, timeAgo, x + width - cardPadding, y + cardPadding + 28, {
      font: this.displayConfig.fontFamily,
      size: 26,
      color: hexToRgba(colors.white, 0.6),
      align: 'right',
      baseline: 'middle',
    });
  }

  private drawSmallPOCard(
    ctx: SKRSContext2D,
    po: { id: string; po_number: string; project_name: string; client_name: string; amount: number; created_at: string },
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const cardPadding = 30;

    // Card background
    roundRect(ctx, x, y, width, height, 12);
    ctx.fillStyle = hexToRgba(colors.white, 0.08);
    ctx.fill();

    // Left accent bar
    ctx.beginPath();
    ctx.roundRect(x, y, 8, height, [12, 0, 0, 12]);
    ctx.fillStyle = colors.mauve;
    ctx.fill();

    // PO Number badge - top left
    roundRect(ctx, x + cardPadding + 10, y + cardPadding - 5, 200, 50, 8);
    ctx.fillStyle = hexToRgba(colors.mauve, 0.35);
    ctx.fill();

    drawText(ctx, po.po_number, x + cardPadding + 110, y + cardPadding + 20, {
      font: this.displayConfig.fontFamily,
      size: 34,
      weight: 600,
      color: colors.mauve,
      align: 'center',
      baseline: 'middle',
    });

    // Project name - large, vertically centered
    const contentCenterY = y + height / 2 + 15;
    drawText(
      ctx,
      truncateText(ctx, po.project_name, width * 0.58, this.displayConfig.fontFamily, 44),
      x + cardPadding + 10,
      contentCenterY,
      {
        font: this.displayConfig.fontFamily,
        size: 44,
        weight: 600,
        color: colors.white,
      }
    );

    // Amount on right - large and centered
    const amountStr = `$${po.amount.toLocaleString()}`;
    drawText(ctx, amountStr, x + width - cardPadding, contentCenterY, {
      font: this.displayConfig.fontFamily,
      size: 56,
      weight: 700,
      color: colors.primaryLight,
      align: 'right',
      baseline: 'middle',
    });

    // Time ago - top right
    const timeAgo = formatDistanceToNow(new Date(po.created_at), { addSuffix: true });
    drawText(ctx, timeAgo, x + width - cardPadding, y + cardPadding + 20, {
      font: this.displayConfig.fontFamily,
      size: 28,
      color: hexToRgba(colors.white, 0.5),
      align: 'right',
      baseline: 'middle',
    });
  }
}
