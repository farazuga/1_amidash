import { SKRSContext2D } from '@napi-rs/canvas';
import { drawText } from '../components/text.js';
import { colors } from '../components/colors.js';

export interface BlockBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export abstract class BaseBlock {
  readonly type: string;
  readonly title: string;

  static readonly FONT = {
    TITLE: 56,
    LARGE_VALUE: 72,
    VALUE: 56,
    BODY: 44,
    LABEL: 36,
    SMALL: 32,
  };

  static readonly PADDING = 60;
  static readonly TITLE_HEIGHT = 80;

  constructor(type: string, title: string) {
    this.type = type;
    this.title = title;
  }

  /**
   * Returns the content area bounds after accounting for title and padding.
   */
  protected getContentBounds(bounds: BlockBounds): BlockBounds {
    const padding = BaseBlock.PADDING;
    return {
      x: bounds.x + padding,
      y: bounds.y + padding + BaseBlock.TITLE_HEIGHT,
      width: bounds.width - padding * 2,
      height: bounds.height - padding * 2 - BaseBlock.TITLE_HEIGHT,
    };
  }

  /**
   * Draws the block title in dark green at the top of the block area.
   */
  protected drawTitle(ctx: SKRSContext2D, bounds: BlockBounds): void {
    drawText(ctx, this.title, bounds.x + BaseBlock.PADDING, bounds.y + BaseBlock.PADDING, {
      size: BaseBlock.FONT.TITLE,
      weight: 700,
      color: colors.primary,
      align: 'left',
      baseline: 'top',
    });
  }

  /**
   * Each block subclass implements this to render its content.
   */
  abstract renderContent(
    ctx: SKRSContext2D,
    contentBounds: BlockBounds,
    data: Record<string, unknown>,
    deltaTime: number
  ): void;

  /**
   * Called by LayoutManager — draws title then delegates to renderContent.
   */
  render(
    ctx: SKRSContext2D,
    bounds: BlockBounds,
    data: Record<string, unknown>,
    deltaTime: number
  ): void {
    this.drawTitle(ctx, bounds);
    const contentBounds = this.getContentBounds(bounds);
    this.renderContent(ctx, contentBounds, data, deltaTime);
  }
}
