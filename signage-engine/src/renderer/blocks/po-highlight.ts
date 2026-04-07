import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseBlock, BlockBounds } from './base-block.js';
import { drawText, truncateText } from '../components/text.js';
import { colors } from '../components/colors.js';
import { formatCurrency } from '../components/format.js';
import type { HighlightPO } from '../../data/fetchers/pos.js';

export class POHighlightBlock extends BaseBlock {
  constructor(title: string) {
    super('po-highlight', title);
  }

  renderContent(
    ctx: SKRSContext2D,
    contentBounds: BlockBounds,
    data: Record<string, unknown>,
    _deltaTime: number
  ): void {
    const pos = (data.pos || []) as HighlightPO[];

    if (pos.length === 0) {
      drawText(ctx, 'No POs this month', contentBounds.x + contentBounds.width / 2, contentBounds.y + contentBounds.height / 2, {
        size: BaseBlock.FONT.BODY,
        weight: 600,
        color: colors.gray[400],
        align: 'center',
        baseline: 'middle',
      });
      return;
    }

    const rowCount = Math.min(pos.length, 4);
    const rowGap = 12;
    const rowHeight = (contentBounds.height - rowGap * (rowCount - 1)) / rowCount;
    const cornerRadius = 12;

    for (let i = 0; i < rowCount; i++) {
      const po = pos[i];
      const ry = contentBounds.y + i * (rowHeight + rowGap);

      // Alternating row background
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.beginPath();
        ctx.roundRect(contentBounds.x, ry, contentBounds.width, rowHeight, cornerRadius);
        ctx.fill();
      }

      const rowPadding = 20;
      const leftX = contentBounds.x + rowPadding;
      const rightX = contentBounds.x + contentBounds.width - rowPadding;

      // Badge
      const isLargest = po.highlight_reason === 'largest';
      const badgeText = isLargest ? 'LARGEST' : 'NEWEST';
      const badgeColor = isLargest ? colors.coral : colors.primary;
      const badgeWidth = 170;
      const badgeHeight = 36;
      const badgeY = ry + (rowHeight - badgeHeight) / 2 - 10;

      ctx.fillStyle = badgeColor;
      ctx.beginPath();
      ctx.roundRect(leftX, badgeY, badgeWidth, badgeHeight, 8);
      ctx.fill();

      drawText(ctx, badgeText, leftX + badgeWidth / 2, badgeY + badgeHeight / 2, {
        size: BaseBlock.FONT.SMALL - 4,
        weight: 700,
        color: colors.white,
        align: 'center',
        baseline: 'middle',
      });

      // PO number + client name
      const textLeftX = leftX + badgeWidth + 20;
      const maxTextWidth = rightX - textLeftX - 180; // leave room for amount
      const poClientText = `${po.po_number} — ${po.client_name}`;
      const truncatedMain = truncateText(ctx, poClientText, maxTextWidth, 'Inter', BaseBlock.FONT.BODY);

      drawText(ctx, truncatedMain, textLeftX, ry + rowHeight * 0.28, {
        size: BaseBlock.FONT.BODY,
        weight: 600,
        color: colors.white,
        baseline: 'middle',
      });

      // Project name smaller below
      const truncatedProject = truncateText(ctx, po.project_name, maxTextWidth, 'Inter', BaseBlock.FONT.SMALL);
      drawText(ctx, truncatedProject, textLeftX, ry + rowHeight * 0.68, {
        size: BaseBlock.FONT.SMALL,
        weight: 400,
        color: colors.gray[400],
        baseline: 'middle',
      });

      // Amount right-aligned
      drawText(ctx, formatCurrency(po.amount), rightX, ry + rowHeight / 2, {
        size: BaseBlock.FONT.VALUE,
        weight: 700,
        color: colors.white,
        align: 'right',
        baseline: 'middle',
      });
    }
  }
}
