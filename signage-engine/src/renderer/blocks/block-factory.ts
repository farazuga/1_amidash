import { SignageBlock } from '../../data/fetchers/blocks-config.js';
import { BaseBlock } from './base-block.js';
import { QuickStatsBlock } from './quick-stats.js';
import { POHighlightBlock } from './po-highlight.js';
import { ProjectsInvoicedBlock } from './projects-invoiced.js';
import { RichTextBlock } from './rich-text.js';
import { PictureBlock } from './picture.js';

/**
 * Factory function that creates a BaseBlock instance from a SignageBlock config.
 */
export function createBlock(config: SignageBlock): BaseBlock {
  switch (config.block_type) {
    case 'quick-stats':
      return new QuickStatsBlock(config.title);
    case 'po-highlight':
      return new POHighlightBlock(config.title);
    case 'projects-invoiced':
      return new ProjectsInvoicedBlock(config.title);
    case 'rich-text':
      return new RichTextBlock(config.title, config.content);
    case 'picture':
      return new PictureBlock(config.title, config.content);
    default:
      // Fallback: use QuickStatsBlock as a safe default
      return new QuickStatsBlock(config.title);
  }
}
