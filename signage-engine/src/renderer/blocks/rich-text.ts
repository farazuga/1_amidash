import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseBlock, BlockBounds } from './base-block.js';
import { drawText, drawTextWrapped } from '../components/text.js';
import { colors } from '../components/colors.js';

interface RichTextItem {
  type: 'heading' | 'paragraph' | 'bullet';
  text: string;
}

/**
 * Strip markdown bold (**text**) and italic (*text*) markers.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1');
}

export class RichTextBlock extends BaseBlock {
  private body: RichTextItem[];

  constructor(title: string, content: Record<string, unknown>) {
    super('rich-text', title);
    const rawBody = content?.body;
    this.body = Array.isArray(rawBody) ? (rawBody as RichTextItem[]) : [];
  }

  renderContent(
    ctx: SKRSContext2D,
    contentBounds: BlockBounds,
    _data: Record<string, unknown>,
    _deltaTime: number
  ): void {
    if (this.body.length === 0) {
      drawText(ctx, 'No content', contentBounds.x + contentBounds.width / 2, contentBounds.y + contentBounds.height / 2, {
        size: BaseBlock.FONT.BODY,
        weight: 600,
        color: colors.gray[400],
        align: 'center',
        baseline: 'middle',
      });
      return;
    }

    let currentY = contentBounds.y;
    const maxWidth = contentBounds.width;
    const bottomLimit = contentBounds.y + contentBounds.height;

    for (const item of this.body) {
      if (currentY >= bottomLimit) break;

      const text = stripMarkdown(item.text || '');

      switch (item.type) {
        case 'heading': {
          const lineHeight = BaseBlock.FONT.VALUE + 12;
          // Add spacing before heading (unless first item)
          if (currentY > contentBounds.y) {
            currentY += 16;
          }
          drawText(ctx, text, contentBounds.x, currentY, {
            size: BaseBlock.FONT.VALUE,
            weight: 700,
            color: colors.primary,
            baseline: 'top',
          });
          currentY += lineHeight;
          break;
        }

        case 'paragraph': {
          const lineHeight = BaseBlock.FONT.BODY + 10;
          currentY = drawTextWrapped(
            ctx,
            text,
            contentBounds.x,
            currentY,
            maxWidth,
            lineHeight,
            {
              size: BaseBlock.FONT.BODY,
              weight: 400,
              color: colors.gray[200],
              baseline: 'top',
            }
          );
          currentY += 8; // paragraph spacing
          break;
        }

        case 'bullet': {
          const bulletIndent = 36;
          const lineHeight = BaseBlock.FONT.BODY + 10;

          // Draw bullet dot
          const dotY = currentY + BaseBlock.FONT.BODY / 2;
          ctx.fillStyle = colors.gray[400];
          ctx.beginPath();
          ctx.arc(contentBounds.x + 12, dotY, 6, 0, Math.PI * 2);
          ctx.fill();

          // Draw text with wrap
          currentY = drawTextWrapped(
            ctx,
            text,
            contentBounds.x + bulletIndent,
            currentY,
            maxWidth - bulletIndent,
            lineHeight,
            {
              size: BaseBlock.FONT.BODY,
              weight: 400,
              color: colors.gray[200],
              baseline: 'top',
            }
          );
          currentY += 4; // bullet spacing
          break;
        }
      }
    }
  }
}
