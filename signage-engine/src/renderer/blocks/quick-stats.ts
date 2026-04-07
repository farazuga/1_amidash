import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseBlock, BlockBounds } from './base-block.js';
import { drawText } from '../components/text.js';
import { colors } from '../components/colors.js';
import { formatCurrency, formatPercent } from '../components/format.js';
import type { ActiveProject } from '../../data/fetchers/projects.js';
import type { InvoicedProject } from '../../data/fetchers/projects.js';
import type { RevenueData } from '../../data/fetchers/revenue.js';

interface CardData {
  label: string;
  value: string;
  color: string;
}

export class QuickStatsBlock extends BaseBlock {
  constructor(title: string) {
    super('quick-stats', title);
  }

  renderContent(
    ctx: SKRSContext2D,
    contentBounds: BlockBounds,
    data: Record<string, unknown>,
    _deltaTime: number
  ): void {
    const projects = (data.projects || []) as ActiveProject[];
    const invoicedProjects = (data.invoicedProjects || []) as InvoicedProject[];
    const revenue = (data.revenue || {}) as RevenueData;

    const quarterPct =
      revenue.quarterGoal > 0
        ? revenue.quarterRevenue / revenue.quarterGoal
        : 0;

    const cards: CardData[] = [
      {
        label: 'Active Projects',
        value: String(projects.length),
        color: colors.chartPrimary,
      },
      {
        label: 'Invoiced This Month',
        value: String(invoicedProjects.length),
        color: colors.success,
      },
      {
        label: 'Sales This Month',
        value: formatCurrency(revenue.currentMonthRevenue || 0),
        color: colors.amber,
      },
      {
        label: 'Quarterly Sales',
        value: formatPercent(quarterPct),
        color: colors.mauve,
      },
    ];

    const gap = 30;
    const cols = 2;
    const rows = 2;
    const cardWidth = (contentBounds.width - gap) / cols;
    const cardHeight = (contentBounds.height - gap) / rows;
    const cornerRadius = 16;

    cards.forEach((card, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = contentBounds.x + col * (cardWidth + gap);
      const cy = contentBounds.y + row * (cardHeight + gap);

      // Card background
      ctx.fillStyle = '#F8F9FA';
      ctx.beginPath();
      ctx.roundRect(cx, cy, cardWidth, cardHeight, cornerRadius);
      ctx.fill();

      // Large colored value centered
      const centerX = cx + cardWidth / 2;
      const valueCenterY = cy + cardHeight * 0.38;
      drawText(ctx, card.value, centerX, valueCenterY, {
        size: BaseBlock.FONT.LARGE_VALUE,
        weight: 700,
        color: card.color,
        align: 'center',
        baseline: 'middle',
      });

      // Label below
      const labelY = cy + cardHeight * 0.68;
      drawText(ctx, card.label, centerX, labelY, {
        size: BaseBlock.FONT.LABEL,
        weight: 600,
        color: colors.gray[500],
        align: 'center',
        baseline: 'middle',
      });
    });
  }
}
