import { logger } from '../utils/logger.js';
import { NDIConfig, DisplayConfig } from '../config/schema.js';

// Try to import grandiose (optional dependency)
let grandiose: typeof import('grandiose') | null = null;
try {
  grandiose = await import('grandiose');
  logger.info('NDI SDK (grandiose) loaded successfully');
} catch {
  logger.warn('NDI SDK (grandiose) not available. Using mock output for testing.');
}

export interface NDISender {
  send(frame: {
    data: Buffer;
    width: number;
    height: number;
    frameRateN: number;
    frameRateD: number;
  }): void;
  destroy(): void;
}

export class NDIOutput {
  private sender: NDISender | null = null;
  private config: NDIConfig;
  private displayConfig: DisplayConfig;
  private frameCount: number = 0;
  private startTime: number = 0;

  constructor(config: NDIConfig, displayConfig: DisplayConfig) {
    this.config = config;
    this.displayConfig = displayConfig;
  }

  async initialize(): Promise<void> {
    if (grandiose) {
      try {
        this.sender = grandiose.send({
          name: this.config.name,
          clockVideo: true,
          clockAudio: false,
        }) as unknown as NDISender;
        logger.info({ name: this.config.name }, 'NDI sender initialized');
      } catch (error) {
        logger.error({ error }, 'Failed to initialize NDI sender');
        this.sender = new MockNDISender(this.config.name);
      }
    } else {
      this.sender = new MockNDISender(this.config.name);
    }

    this.startTime = Date.now();
    this.frameCount = 0;
  }

  sendFrame(frameData: Buffer): void {
    if (!this.sender) return;

    try {
      this.sender.send({
        data: frameData,
        width: this.displayConfig.width,
        height: this.displayConfig.height,
        frameRateN: this.config.frameRate,
        frameRateD: 1,
      });
      this.frameCount++;
    } catch (error) {
      logger.error({ error }, 'Failed to send NDI frame');
    }
  }

  getFPS(): number {
    const elapsed = (Date.now() - this.startTime) / 1000;
    return elapsed > 0 ? this.frameCount / elapsed : 0;
  }

  getFrameCount(): number {
    return this.frameCount;
  }

  destroy(): void {
    if (this.sender) {
      this.sender.destroy();
      this.sender = null;
      logger.info('NDI sender destroyed');
    }
  }
}

// Mock NDI sender for testing without NDI SDK
class MockNDISender implements NDISender {
  private name: string;
  private frameCount: number = 0;

  constructor(name: string) {
    this.name = name;
    logger.info({ name }, 'Mock NDI sender initialized (no actual NDI output)');
  }

  send(_frame: {
    data: Buffer;
    width: number;
    height: number;
    frameRateN: number;
    frameRateD: number;
  }): void {
    this.frameCount++;
    if (this.frameCount % 300 === 0) {
      logger.debug({ name: this.name, frames: this.frameCount }, 'Mock NDI frame count');
    }
  }

  destroy(): void {
    logger.info({ name: this.name }, 'Mock NDI sender destroyed');
  }
}
