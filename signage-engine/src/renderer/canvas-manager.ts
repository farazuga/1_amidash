import { createCanvas, Canvas, SKRSContext2D } from '@napi-rs/canvas';
import { DisplayConfig } from '../config/schema.js';
import { logger } from '../utils/logger.js';

export class CanvasManager {
  private frontBuffer: Canvas;
  private backBuffer: Canvas;
  private frontCtx: SKRSContext2D;
  private backCtx: SKRSContext2D;
  private config: DisplayConfig;

  constructor(config: DisplayConfig) {
    this.config = config;

    // Double buffering for smooth rendering
    this.frontBuffer = createCanvas(config.width, config.height);
    this.backBuffer = createCanvas(config.width, config.height);
    this.frontCtx = this.frontBuffer.getContext('2d');
    this.backCtx = this.backBuffer.getContext('2d');

    logger.info({ width: config.width, height: config.height }, 'Canvas manager initialized');
  }

  getBackContext(): SKRSContext2D {
    return this.backCtx;
  }

  getFrontBuffer(): Canvas {
    return this.frontBuffer;
  }

  getConfig(): DisplayConfig {
    return this.config;
  }

  clear(): void {
    this.backCtx.fillStyle = this.config.backgroundColor;
    this.backCtx.fillRect(0, 0, this.config.width, this.config.height);
  }

  swap(): void {
    // Copy back buffer to front buffer
    this.frontCtx.drawImage(this.backBuffer, 0, 0);
  }

  // Get raw pixel data in BGRA format for NDI
  getFrameData(): Buffer {
    const imageData = this.frontCtx.getImageData(0, 0, this.config.width, this.config.height);
    const rgba = imageData.data;
    const bgra = Buffer.alloc(rgba.length);

    // Convert RGBA to BGRA
    for (let i = 0; i < rgba.length; i += 4) {
      bgra[i] = rgba[i + 2];     // B
      bgra[i + 1] = rgba[i + 1]; // G
      bgra[i + 2] = rgba[i];     // R
      bgra[i + 3] = rgba[i + 3]; // A
    }

    return bgra;
  }

  // Get PNG for preview
  async getPreviewPng(): Promise<Buffer> {
    return this.frontBuffer.toBuffer('image/png');
  }
}
