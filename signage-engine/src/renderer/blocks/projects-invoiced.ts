import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseBlock, BlockBounds } from './base-block.js';
import { drawText, truncateText } from '../components/text.js';
import { colors } from '../components/colors.js';
import { formatCurrency } from '../components/format.js';
import type { InvoicedProject } from '../../data/fetchers/projects.js';

export class ProjectsInvoicedBlock extends BaseBlock {
  constructor(title: string) {
    super('projects-invoiced', title);
  }

  renderContent(
    ctx: SKRSContext2D,
    contentBounds: BlockBounds,
    data: Record<string, unknown>,
    _deltaTime: number
  ): void {
    const projects = (data.invoicedProjects || []) as InvoicedProject[];

    if (projects.length === 0) {
      drawText(ctx, 'No invoiced projects', contentBounds.x + contentBounds.width / 2, contentBounds.y + contentBounds.height / 2, {
        size: BaseBlock.FONT.BODY,
        weight: 600,
        color: colors.gray[400],
        align: 'center',
        baseline: 'middle',
      });
      return;
    }

    const rowCount = Math.min(projects.length, 4);
    const rowGap = 12;
    const rowHeight = (contentBounds.height - rowGap * (rowCount - 1)) / rowCount;
    const cornerRadius = 12;

    for (let i = 0; i < rowCount; i++) {
      const project = projects[i];
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

      // Green checkmark circle
      const circleRadius = 22;
      const circleCenterX = leftX + circleRadius;
      const circleCenterY = ry + rowHeight / 2;

      ctx.fillStyle = colors.success;
      ctx.beginPath();
      ctx.arc(circleCenterX, circleCenterY, circleRadius, 0, Math.PI * 2);
      ctx.fill();

      // Checkmark
      ctx.strokeStyle = colors.primary;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(circleCenterX - 10, circleCenterY);
      ctx.lineTo(circleCenterX - 3, circleCenterY + 8);
      ctx.lineTo(circleCenterX + 10, circleCenterY - 8);
      ctx.stroke();

      // Project name (bold)
      const textLeftX = leftX + circleRadius * 2 + 20;
      const maxTextWidth = rightX - textLeftX - 180; // room for amount
      const truncatedName = truncateText(ctx, project.name, maxTextWidth, 'Inter', BaseBlock.FONT.BODY);

      drawText(ctx, truncatedName, textLeftX, ry + rowHeight * 0.28, {
        size: BaseBlock.FONT.BODY,
        weight: 700,
        color: colors.white,
        baseline: 'middle',
      });

      // Client name smaller below
      const truncatedClient = truncateText(ctx, project.client_name, maxTextWidth, 'Inter', BaseBlock.FONT.SMALL);
      drawText(ctx, truncatedClient, textLeftX, ry + rowHeight * 0.68, {
        size: BaseBlock.FONT.SMALL,
        weight: 400,
        color: colors.gray[400],
        baseline: 'middle',
      });

      // Total value right-aligned in green
      drawText(ctx, formatCurrency(project.total_value), rightX, ry + rowHeight / 2, {
        size: BaseBlock.FONT.VALUE,
        weight: 700,
        color: colors.success,
        align: 'right',
        baseline: 'middle',
      });
    }
  }
}
