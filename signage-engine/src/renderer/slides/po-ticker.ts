import { CanvasRenderingContext2D } from 'canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
import { drawText } from '../components/text.js';
import { roundRect, colors } from '../components/index.js';
import { formatDistanceToNow } from 'date-fns';

export class POTickerSlide extends BaseSlide {
  private scrollOffset: number = 0;

  render(ctx: CanvasRenderingContext2D, data: DataCache, deltaTime: number): void {
    const headerHeight = this.drawHeader(ctx, this.config.title || 'Recent Purchase Orders');

    const pos = data.pos.data.slice(0, this.config.maxItems || 10);
    const scrollSpeed = this.config.scrollSpeed || 2;
    const cardWidth = 600;
    const cardHeight = 200;
    const cardGap = 40;
    const totalWidth = pos.length * (cardWidth + cardGap);

    // Update scroll offset
    this.scrollOffset += scrollSpeed * (deltaTime / 16.67); // Normalize to 60fps
    if (this.scrollOffset > totalWidth) {
      this.scrollOffset = -this.displayConfig.width;
    }

    const centerY = headerHeight + (this.displayConfig.height - headerHeight) / 2;

    // Draw PO cards
    pos.forEach((po, index) => {
      const baseX = index * (cardWidth + cardGap) - this.scrollOffset;

      // Skip if off screen
      if (baseX + cardWidth < 0 || baseX > this.displayConfig.width) return;

      const cardX = baseX + 60;
      const cardY = centerY - cardHeight / 2;

      // Card background
      roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 16);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fill();

      // PO Number badge
      roundRect(ctx, cardX + 20, cardY + 20, 180, 40, 8);
      ctx.fillStyle = colors.info;
      ctx.fill();
      drawText(ctx, po.po_number, cardX + 110, cardY + 40, {
        font: this.displayConfig.fontFamily,
        size: 20,
        color: colors.white,
        align: 'center',
        baseline: 'middle',
      });

      // Time ago
      const timeAgo = formatDistanceToNow(new Date(po.created_at), { addSuffix: true });
      drawText(ctx, timeAgo, cardX + cardWidth - 20, cardY + 40, {
        font: this.displayConfig.fontFamily,
        size: 18,
        color: 'rgba(255, 255, 255, 0.5)',
        align: 'right',
        baseline: 'middle',
      });

      // Project name
      drawText(ctx, po.project_name, cardX + 20, cardY + 80, {
        font: this.displayConfig.fontFamily,
        size: 32,
        color: colors.white,
        maxWidth: cardWidth - 40,
      });

      // Client
      drawText(ctx, po.client_name, cardX + 20, cardY + 120, {
        font: this.displayConfig.fontFamily,
        size: 24,
        color: 'rgba(255, 255, 255, 0.7)',
      });

      // Amount
      const amountStr = `$${po.amount.toLocaleString()}`;
      drawText(ctx, amountStr, cardX + cardWidth - 20, cardY + cardHeight - 30, {
        font: this.displayConfig.fontFamily,
        size: 40,
        color: colors.success,
        align: 'right',
        baseline: 'bottom',
      });
    });

    // Gradient overlays for smooth scroll edges
    const gradient1 = ctx.createLinearGradient(0, 0, 120, 0);
    gradient1.addColorStop(0, this.displayConfig.backgroundColor);
    gradient1.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient1;
    ctx.fillRect(0, headerHeight, 120, this.displayConfig.height - headerHeight);

    const gradient2 = ctx.createLinearGradient(this.displayConfig.width - 120, 0, this.displayConfig.width, 0);
    gradient2.addColorStop(0, 'transparent');
    gradient2.addColorStop(1, this.displayConfig.backgroundColor);
    ctx.fillStyle = gradient2;
    ctx.fillRect(this.displayConfig.width - 120, headerHeight, 120, this.displayConfig.height - headerHeight);
  }
}
