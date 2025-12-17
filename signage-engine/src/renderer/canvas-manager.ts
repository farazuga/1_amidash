import { createCanvas, Canvas, CanvasRenderingContext2D, loadImage, Image } from 'canvas';
import { logger } from '../utils/logger.js';
import type { DisplayConfig } from '../config/schema.js';

/**
 * Canvas manager with double-buffering for smooth rendering.
 * Maintains two canvases: one for rendering (back buffer) and one for display (front buffer).
 */
export class CanvasManager {
  private frontCanvas: Canvas;
  private backCanvas: Canvas;
  private frontCtx: CanvasRenderingContext2D;
  private backCtx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private logo: Image | null = null;
  private config: DisplayConfig;

  constructor(config: DisplayConfig) {
    this.config = config;
    this.width = config.width;
    this.height = config.height;

    // Create double buffer
    this.frontCanvas = createCanvas(this.width, this.height);
    this.backCanvas = createCanvas(this.width, this.height);
    this.frontCtx = this.frontCanvas.getContext('2d');
    this.backCtx = this.backCanvas.getContext('2d');

    // Initialize both buffers with background
    this.clearBuffer(this.frontCtx);
    this.clearBuffer(this.backCtx);

    logger.info({ width: this.width, height: this.height }, 'Canvas manager initialized');
  }

  /**
   * Load the company logo
   */
  async loadLogo(logoPath?: string): Promise<void> {
    const path = logoPath || this.config.logoPath;
    if (!path) {
      logger.info('No logo path configured');
      return;
    }

    try {
      this.logo = await loadImage(path);
      logger.info({ path }, 'Logo loaded successfully');
    } catch (error) {
      logger.warn({ error, path }, 'Failed to load logo');
      this.logo = null;
    }
  }

  /**
   * Get the back buffer context for rendering
   */
  getBackContext(): CanvasRenderingContext2D {
    return this.backCtx;
  }

  /**
   * Get the front buffer context (for reading/preview)
   */
  getFrontContext(): CanvasRenderingContext2D {
    return this.frontCtx;
  }

  /**
   * Clear the back buffer with background color
   */
  clearBackBuffer(): void {
    this.clearBuffer(this.backCtx);
  }

  /**
   * Swap front and back buffers
   */
  swap(): void {
    // Swap references
    [this.frontCanvas, this.backCanvas] = [this.backCanvas, this.frontCanvas];
    [this.frontCtx, this.backCtx] = [this.backCtx, this.frontCtx];
  }

  /**
   * Get the front buffer as a raw BGRA buffer (for NDI)
   */
  getFrameBuffer(): Buffer {
    const imageData = this.frontCtx.getImageData(0, 0, this.width, this.height);
    const data = imageData.data;

    // Convert RGBA to BGRA for NDI
    const buffer = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i += 4) {
      buffer[i] = data[i + 2];     // B
      buffer[i + 1] = data[i + 1]; // G
      buffer[i + 2] = data[i];     // R
      buffer[i + 3] = data[i + 3]; // A
    }

    return buffer;
  }

  /**
   * Get the front buffer as a PNG buffer (for preview)
   */
  getPreviewBuffer(): Buffer {
    return this.frontCanvas.toBuffer('image/png');
  }

  /**
   * Get the front buffer as a scaled-down PNG (for admin preview)
   */
  getScaledPreviewBuffer(maxWidth: number = 960): Buffer {
    const scale = maxWidth / this.width;
    const scaledHeight = Math.round(this.height * scale);

    const previewCanvas = createCanvas(maxWidth, scaledHeight);
    const previewCtx = previewCanvas.getContext('2d');

    // Draw scaled version
    previewCtx.drawImage(
      this.frontCanvas,
      0, 0, this.width, this.height,
      0, 0, maxWidth, scaledHeight
    );

    return previewCanvas.toBuffer('image/png');
  }

  /**
   * Get canvas dimensions
   */
  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /**
   * Get the loaded logo image
   */
  getLogo(): Image | null {
    return this.logo;
  }

  /**
   * Get display configuration
   */
  getConfig(): DisplayConfig {
    return this.config;
  }

  /**
   * Update display configuration
   */
  updateConfig(config: DisplayConfig): void {
    this.config = config;

    // Check if dimensions changed
    if (config.width !== this.width || config.height !== this.height) {
      this.width = config.width;
      this.height = config.height;

      // Recreate canvases with new dimensions
      this.frontCanvas = createCanvas(this.width, this.height);
      this.backCanvas = createCanvas(this.width, this.height);
      this.frontCtx = this.frontCanvas.getContext('2d');
      this.backCtx = this.backCanvas.getContext('2d');

      logger.info({ width: this.width, height: this.height }, 'Canvas resized');
    }

    this.clearBuffer(this.frontCtx);
    this.clearBuffer(this.backCtx);
  }

  /**
   * Clear a buffer with background color
   */
  private clearBuffer(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.config.backgroundColor;
    ctx.fillRect(0, 0, this.width, this.height);
  }
}

// Singleton instance
let canvasManager: CanvasManager | null = null;

/**
 * Get or create the canvas manager instance
 */
export function getCanvasManager(config?: DisplayConfig): CanvasManager {
  if (!canvasManager && config) {
    canvasManager = new CanvasManager(config);
  }
  if (!canvasManager) {
    throw new Error('Canvas manager not initialized. Call with config first.');
  }
  return canvasManager;
}

/**
 * Destroy the canvas manager instance
 */
export function destroyCanvasManager(): void {
  canvasManager = null;
}
