import { SKRSContext2D } from '@napi-rs/canvas';
import { BaseBlock, BlockBounds } from './base-block.js';
import { drawText } from '../components/text.js';
import { colors } from '../components/colors.js';
import { getCachedImageSync, preloadImage, isImageLoading } from '../../data/fetchers/images.js';

export class PictureBlock extends BaseBlock {
  private imageUrl: string | null;

  constructor(title: string, content: Record<string, unknown>) {
    super('picture', title);
    this.imageUrl = typeof content?.image_url === 'string' ? content.image_url : null;

    // Start async loading immediately
    if (this.imageUrl) {
      preloadImage(this.imageUrl);
    }
  }

  renderContent(
    ctx: SKRSContext2D,
    contentBounds: BlockBounds,
    _data: Record<string, unknown>,
    _deltaTime: number
  ): void {
    const centerX = contentBounds.x + contentBounds.width / 2;
    const centerY = contentBounds.y + contentBounds.height / 2;

    if (!this.imageUrl) {
      drawText(ctx, 'No image set', centerX, centerY, {
        size: BaseBlock.FONT.BODY,
        weight: 600,
        color: colors.gray[400],
        align: 'center',
        baseline: 'middle',
      });
      return;
    }

    const image = getCachedImageSync(this.imageUrl);

    if (!image) {
      const statusText = isImageLoading(this.imageUrl) ? 'Loading...' : 'Image failed to load';
      drawText(ctx, statusText, centerX, centerY, {
        size: BaseBlock.FONT.BODY,
        weight: 600,
        color: colors.gray[400],
        align: 'center',
        baseline: 'middle',
      });
      return;
    }

    // Contain mode: maintain aspect ratio, fit within bounds
    const imgWidth = image.width;
    const imgHeight = image.height;
    const boundsWidth = contentBounds.width;
    const boundsHeight = contentBounds.height;

    const scale = Math.min(boundsWidth / imgWidth, boundsHeight / imgHeight);
    const drawWidth = imgWidth * scale;
    const drawHeight = imgHeight * scale;

    // Center the image
    const drawX = contentBounds.x + (boundsWidth - drawWidth) / 2;
    const drawY = contentBounds.y + (boundsHeight - drawHeight) / 2;

    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  }
}
