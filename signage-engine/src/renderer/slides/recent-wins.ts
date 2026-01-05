import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseSlide } from './base-slide.js';
import { DataCache } from '../../data/polling-manager.js';
import { drawText } from '../components/text.js';
import { roundRect } from '../components/charts.js';
import { colors, hexToRgba } from '../components/colors.js';
import { format, subDays, startOfMonth, differenceInDays } from 'date-fns';

export class RecentWinsSlide extends BaseSlide {
  render(ctx: SKRSContext2D, data: DataCache, deltaTime: number): void {
    // Update animations
    this.updateAnimationState(deltaTime);

    // Draw ambient effects
    this.drawAmbientEffects(ctx);

    const headerHeight = this.drawMinimalHeader(ctx, this.config.title || 'RECENT WINS');

    const pos = data.pos.data;
    const metrics = data.metrics.data;

    // For wins, we look at recent POs (new sales) - prioritize larger values
    const recentPOs = pos
      .filter(po => {
        const poDate = new Date(po.created_at);
        const thirtyDaysAgo = subDays(new Date(), 30);
        return poDate >= thirtyDaysAgo;
      })
      .sort((a, b) => (b.amount || 0) - (a.amount || 0))
      .slice(0, this.config.maxItems || 6);

    if (recentPOs.length === 0) {
      this.drawEmptyState(ctx, headerHeight);
      return;
    }

    this.drawWinsDashboard(ctx, recentPOs, metrics, headerHeight);
  }

  private drawEmptyState(ctx: SKRSContext2D, headerHeight: number): void {
    const centerX = this.displayConfig.width / 2;
    const centerY = (this.displayConfig.height + headerHeight) / 2;

    drawText(ctx, 'No recent wins to display', centerX, centerY, {
      font: this.displayConfig.fontFamily,
      size: 48,
      color: 'rgba(255, 255, 255, 0.5)',
      align: 'center',
      baseline: 'middle',
    });
  }

  private drawWinsDashboard(
    ctx: SKRSContext2D,
    wins: DataCache['pos']['data'],
    metrics: DataCache['metrics']['data'],
    headerHeight: number
  ): void {
    const padding = 80;
    const contentY = headerHeight + 50;

    // Summary section at top
    const summaryHeight = 160;
    this.drawSummarySection(ctx, wins, metrics, padding, contentY, this.displayConfig.width - padding * 2, summaryHeight);

    // Wins grid
    const gridY = contentY + summaryHeight + 40;
    const gridHeight = this.displayConfig.height - gridY - padding;
    this.drawWinsGrid(ctx, wins, padding, gridY, this.displayConfig.width - padding * 2, gridHeight);
  }

  private drawSummarySection(
    ctx: SKRSContext2D,
    wins: DataCache['pos']['data'],
    metrics: DataCache['metrics']['data'],
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    // Celebratory background
    roundRect(ctx, x, y, width, height, 20);
    const gradient = ctx.createLinearGradient(x, y, x + width, y);
    gradient.addColorStop(0, hexToRgba(colors.success, 0.2));
    gradient.addColorStop(1, hexToRgba(colors.primary, 0.2));
    ctx.fillStyle = gradient;
    ctx.fill();

    // Border glow effect
    ctx.strokeStyle = hexToRgba(colors.success, 0.4);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Total value this month
    const totalValue = wins.reduce((sum, w) => sum + (w.amount || 0), 0);
    const valueText = totalValue >= 1000000
      ? `$${(totalValue / 1000000).toFixed(2)}M`
      : `$${(totalValue / 1000).toFixed(0)}K`;

    // Trophy/Star icon placeholder
    ctx.fillStyle = colors.success;
    ctx.beginPath();
    ctx.arc(x + 80, y + height / 2, 40, 0, Math.PI * 2);
    ctx.fill();

    // Star symbol
    drawText(ctx, '★', x + 80, y + height / 2, {
      font: this.displayConfig.fontFamily,
      size: 48,
      color: colors.black,
      align: 'center',
      baseline: 'middle',
    });

    // Main value
    drawText(ctx, valueText, x + 160, y + height / 2 - 15, {
      font: this.displayConfig.fontFamily,
      size: 72,
      weight: 700,
      color: colors.success,
      baseline: 'middle',
    });

    drawText(ctx, 'in new sales this month', x + 160, y + height / 2 + 35, {
      font: this.displayConfig.fontFamily,
      size: 28,
      color: 'rgba(255, 255, 255, 0.7)',
      baseline: 'middle',
    });

    // Stats on the right
    const statsX = x + width - 350;

    // Wins count
    drawText(ctx, wins.length.toString(), statsX, y + height / 2 - 15, {
      font: this.displayConfig.fontFamily,
      size: 56,
      weight: 700,
      color: colors.white,
      baseline: 'middle',
    });

    drawText(ctx, wins.length === 1 ? 'NEW WIN' : 'NEW WINS', statsX + 70, y + height / 2 - 15, {
      font: this.displayConfig.fontFamily,
      size: 24,
      color: 'rgba(255, 255, 255, 0.7)',
      baseline: 'middle',
    });

    // Month-to-date comparison if available
    if (metrics) {
      drawText(ctx, `${metrics.completedThisMonth} completed`, statsX, y + height / 2 + 30, {
        font: this.displayConfig.fontFamily,
        size: 24,
        color: 'rgba(255, 255, 255, 0.5)',
        baseline: 'middle',
      });
    }
  }

  private drawWinsGrid(
    ctx: SKRSContext2D,
    wins: DataCache['pos']['data'],
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const cols = Math.min(3, wins.length);
    const rows = Math.ceil(wins.length / cols);
    const gap = 30;
    const cardWidth = (width - gap * (cols - 1)) / cols;
    const cardHeight = (height - gap * (rows - 1)) / rows;

    wins.forEach((win, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const cardX = x + col * (cardWidth + gap);
      const cardY = y + row * (cardHeight + gap);

      this.drawWinCard(ctx, win, cardX, cardY, cardWidth, cardHeight, index);
    });
  }

  private drawWinCard(
    ctx: SKRSContext2D,
    win: DataCache['pos']['data'][0],
    x: number,
    y: number,
    width: number,
    height: number,
    index: number
  ): void {
    const borderRadius = 16;
    const padding = 24;

    // Card background with shine effect
    const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
    gradient.addColorStop(0, hexToRgba(colors.white, 0.12));
    gradient.addColorStop(0.5, hexToRgba(colors.white, 0.08));
    gradient.addColorStop(1, hexToRgba(colors.white, 0.04));

    roundRect(ctx, x, y, width, height, borderRadius);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Success accent on top
    ctx.fillStyle = colors.success;
    roundRect(ctx, x, y, width, 6, borderRadius);
    ctx.fill();

    // Rank badge for top 3
    if (index < 3) {
      const badges = ['🥇', '🥈', '🥉'];
      drawText(ctx, badges[index], x + width - padding - 20, y + padding + 20, {
        font: this.displayConfig.fontFamily,
        size: 36,
        align: 'center',
        baseline: 'middle',
      });
    }

    // Days ago badge
    const daysAgo = differenceInDays(new Date(), new Date(win.created_at));
    const daysText = daysAgo === 0 ? 'TODAY' :
                     daysAgo === 1 ? 'YESTERDAY' :
                     `${daysAgo} DAYS AGO`;

    ctx.fillStyle = hexToRgba(colors.success, 0.3);
    roundRect(ctx, x + padding, y + padding, 100, 28, 4);
    ctx.fill();

    drawText(ctx, daysText, x + padding + 50, y + padding + 14, {
      font: this.displayConfig.fontFamily,
      size: 14,
      weight: 600,
      color: colors.success,
      align: 'center',
      baseline: 'middle',
    });

    // Client name
    drawText(ctx, win.client_name || 'New Client', x + padding, y + padding + 70, {
      font: this.displayConfig.fontFamily,
      size: 32,
      weight: 600,
      color: colors.white,
      maxWidth: width - padding * 2,
    });

    // PO Number as badge
    if (win.po_number) {
      ctx.fillStyle = hexToRgba(colors.primaryLight, 0.2);
      const poText = `PO: ${win.po_number}`;
      const typeWidth = Math.min(ctx.measureText(poText).width + 20, width - padding * 2);
      roundRect(ctx, x + padding, y + padding + 110, typeWidth, 28, 4);
      ctx.fill();

      drawText(ctx, poText, x + padding + typeWidth / 2, y + padding + 124, {
        font: this.displayConfig.fontFamily,
        size: 16,
        color: colors.primaryLight,
        align: 'center',
        baseline: 'middle',
      });
    }

    // Value - large and prominent at bottom
    const valueText = (win.amount || 0) >= 1000000
      ? `$${((win.amount || 0) / 1000000).toFixed(2)}M`
      : `$${((win.amount || 0) / 1000).toFixed(0)}K`;

    drawText(ctx, valueText, x + padding, y + height - padding - 10, {
      font: this.displayConfig.fontFamily,
      size: 48,
      weight: 700,
      color: colors.success,
    });
  }
}
