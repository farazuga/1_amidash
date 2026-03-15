import { SKRSContext2D } from '@napi-rs/canvas';
import { SignageBlock } from '../../data/fetchers/blocks-config.js';
import { BaseBlock, BlockBounds } from './base-block.js';
import { drawText } from '../components/text.js';
import { colors } from '../components/colors.js';

/**
 * Placeholder block that renders the block type name centered in the content area.
 * Used until the real block implementations are created (Tasks 9-13).
 */
class PlaceholderBlock extends BaseBlock {
  renderContent(
    ctx: SKRSContext2D,
    contentBounds: BlockBounds,
    _data: Record<string, unknown>,
    _deltaTime: number
  ): void {
    const centerX = contentBounds.x + contentBounds.width / 2;
    const centerY = contentBounds.y + contentBounds.height / 2;

    drawText(ctx, this.type, centerX, centerY, {
      size: BaseBlock.FONT.BODY,
      weight: 600,
      color: colors.gray[400],
      align: 'center',
      baseline: 'middle',
    });
  }
}

/**
 * Factory function that creates a BaseBlock instance from a SignageBlock config.
 * Currently all types route to PlaceholderBlock; real implementations will be
 * swapped in as they are built.
 */
export function createBlock(config: SignageBlock): BaseBlock {
  switch (config.block_type) {
    case 'po-highlight':
      return new PlaceholderBlock(config.block_type, config.title);
    case 'projects-invoiced':
      return new PlaceholderBlock(config.block_type, config.title);
    case 'quick-stats':
      return new PlaceholderBlock(config.block_type, config.title);
    case 'rich-text':
      return new PlaceholderBlock(config.block_type, config.title);
    case 'picture':
      return new PlaceholderBlock(config.block_type, config.title);
    default:
      return new PlaceholderBlock(config.block_type, config.title);
  }
}
