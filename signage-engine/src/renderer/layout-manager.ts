import { SKRSContext2D, loadImage, Image } from '@napi-rs/canvas';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { format } from 'date-fns';
import { SignageBlock, SignageSettings } from '../data/fetchers/blocks-config.js';
import { BaseBlock } from './blocks/base-block.js';
import { createBlock } from './blocks/block-factory.js';
import { drawText } from './components/text.js';
import { colors } from './components/colors.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Layout constants
const FOOTER_HEIGHT = 100;
const BLOCK_GAP = 30;
const SCREEN_PADDING = 30;
const BORDER_RADIUS = 40;
const BORDER_WIDTH = 8;
const TRANSITION_DURATION = 500;

interface SlotState {
  blocks: BaseBlock[];
  blockIds: string[]; // for change detection
  currentIndex: number;
  timer: number; // ms elapsed on current block
  fadeProgress: number; // 0 = no transition, 0..1 = fading
  isFading: boolean;
}

function createSlotState(): SlotState {
  return {
    blocks: [],
    blockIds: [],
    currentIndex: 0,
    timer: 0,
    fadeProgress: 0,
    isFading: false,
  };
}

export class LayoutManager {
  private width: number;
  private height: number;
  private leftSlot: SlotState = createSlotState();
  private rightSlot: SlotState = createSlotState();
  private rotationIntervalMs: number = 15000;
  private logo: Image | null = null;
  private logoLoaded: boolean = false;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.loadLogo();
  }

  private async loadLogo(): Promise<void> {
    if (this.logoLoaded) return;
    try {
      const logoPath = join(__dirname, '..', '..', 'assets', 'logo.png');
      this.logo = await loadImage(logoPath);
      this.logoLoaded = true;
      logger.info('Logo loaded for layout manager');
    } catch {
      this.logo = null;
      this.logoLoaded = true;
      logger.debug('Logo not found at assets/logo.png, skipping');
    }
  }

  /**
   * Update the block configuration. Filters blocks into left/right slots
   * and only resets slot state if the block list actually changed.
   */
  updateConfig(blockConfigs: SignageBlock[], settings: SignageSettings): void {
    this.rotationIntervalMs = settings.rotation_interval_ms;

    const enabledBlocks = blockConfigs.filter((b) => b.enabled);

    // Partition blocks into slots
    const leftConfigs = enabledBlocks.filter(
      (b) => b.position === 'left' || b.position === 'both'
    );
    const rightConfigs = enabledBlocks.filter(
      (b) => b.position === 'right' || b.position === 'both'
    );

    this.updateSlot(this.leftSlot, leftConfigs);
    this.updateSlot(this.rightSlot, rightConfigs);
  }

  private updateSlot(slot: SlotState, configs: SignageBlock[]): void {
    const newIds = configs.map((c) => c.id).join(',');
    const oldIds = slot.blockIds.join(',');

    if (newIds === oldIds) return; // no change

    slot.blocks = configs.map((c) => createBlock(c));
    slot.blockIds = configs.map((c) => c.id);
    slot.currentIndex = 0;
    slot.timer = 0;
    slot.fadeProgress = 0;
    slot.isFading = false;

    logger.debug({ blockCount: slot.blocks.length, ids: newIds }, 'Slot updated');
  }

  /**
   * Main render method called each frame.
   * Draws: background -> block containers -> block content (with rotation/fade) -> footer
   */
  render(ctx: SKRSContext2D, data: Record<string, unknown>, deltaTime: number): void {
    // 1. White background
    ctx.fillStyle = colors.white;
    ctx.fillRect(0, 0, this.width, this.height);

    // 2. Calculate container bounds
    const contentHeight = this.height - FOOTER_HEIGHT - SCREEN_PADDING * 2;
    const totalContentWidth = this.width - SCREEN_PADDING * 2 - BLOCK_GAP;
    const blockWidth = totalContentWidth / 2;

    const leftBounds = {
      x: SCREEN_PADDING,
      y: SCREEN_PADDING,
      width: blockWidth,
      height: contentHeight,
    };
    const rightBounds = {
      x: SCREEN_PADDING + blockWidth + BLOCK_GAP,
      y: SCREEN_PADDING,
      width: blockWidth,
      height: contentHeight,
    };

    // 3. Draw rounded rectangle containers
    this.drawContainer(ctx, leftBounds);
    this.drawContainer(ctx, rightBounds);

    // 4. Render block content in each slot (clipped)
    this.renderSlot(ctx, this.leftSlot, leftBounds, data, deltaTime);
    this.renderSlot(ctx, this.rightSlot, rightBounds, data, deltaTime);

    // 5. Footer
    this.renderFooter(ctx);
  }

  private drawContainer(
    ctx: SKRSContext2D,
    bounds: { x: number; y: number; width: number; height: number }
  ): void {
    const { x, y, width, height } = bounds;

    // White fill with rounded corners
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, BORDER_RADIUS);
    ctx.fillStyle = colors.white;
    ctx.fill();

    // Dark green stroke
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, BORDER_RADIUS);
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = BORDER_WIDTH;
    ctx.stroke();
  }

  private renderSlot(
    ctx: SKRSContext2D,
    slot: SlotState,
    bounds: { x: number; y: number; width: number; height: number },
    data: Record<string, unknown>,
    deltaTime: number
  ): void {
    if (slot.blocks.length === 0) return;

    // Advance timer
    slot.timer += deltaTime;

    // Check if we should start a transition
    if (!slot.isFading && slot.blocks.length > 1 && slot.timer >= this.rotationIntervalMs) {
      slot.isFading = true;
      slot.fadeProgress = 0;
    }

    // Advance fade
    if (slot.isFading) {
      slot.fadeProgress += deltaTime / TRANSITION_DURATION;
      if (slot.fadeProgress >= 1) {
        // Transition complete
        slot.isFading = false;
        slot.fadeProgress = 0;
        slot.currentIndex = (slot.currentIndex + 1) % slot.blocks.length;
        slot.timer = 0;
      }
    }

    // Clip to rounded rect
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(
      bounds.x + BORDER_WIDTH / 2,
      bounds.y + BORDER_WIDTH / 2,
      bounds.width - BORDER_WIDTH,
      bounds.height - BORDER_WIDTH,
      BORDER_RADIUS - BORDER_WIDTH / 2
    );
    ctx.clip();

    const currentBlock = slot.blocks[slot.currentIndex];

    if (slot.isFading) {
      const nextIndex = (slot.currentIndex + 1) % slot.blocks.length;
      const nextBlock = slot.blocks[nextIndex];

      // Draw current block fading out
      ctx.globalAlpha = 1 - slot.fadeProgress;
      currentBlock.render(ctx, bounds, data, deltaTime);

      // Draw next block fading in
      ctx.globalAlpha = slot.fadeProgress;
      nextBlock.render(ctx, bounds, data, deltaTime);

      ctx.globalAlpha = 1;
    } else {
      currentBlock.render(ctx, bounds, data, deltaTime);
    }

    ctx.restore();
  }

  private renderFooter(ctx: SKRSContext2D): void {
    const footerY = this.height - FOOTER_HEIGHT;

    // Dark green background
    ctx.fillStyle = colors.primary;
    ctx.fillRect(0, footerY, this.width, FOOTER_HEIGHT);

    // Live clock on the left: "HH:mm | Day, M/d"
    const now = new Date();
    const clockText = format(now, "HH:mm | EEEE, M/d");
    drawText(ctx, clockText, SCREEN_PADDING + 20, footerY + FOOTER_HEIGHT / 2, {
      size: 40,
      weight: 600,
      color: colors.white,
      align: 'left',
      baseline: 'middle',
    });

    // Logo on the right
    if (this.logo) {
      const logoHeight = FOOTER_HEIGHT - 20;
      const logoWidth = (this.logo.width / this.logo.height) * logoHeight;
      const logoX = this.width - SCREEN_PADDING - 20 - logoWidth;
      const logoY = footerY + (FOOTER_HEIGHT - logoHeight) / 2;
      ctx.drawImage(this.logo, logoX, logoY, logoWidth, logoHeight);
    }
  }
}
