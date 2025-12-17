import { logger } from '../utils/logger.js';
import type { NDIConfig, DisplayConfig } from '../config/schema.js';

// Grandiose types (since it doesn't have TypeScript definitions)
interface GrandioseSender {
  video(frame: NDIFrame): Promise<void>;
  destroy(): void;
}

interface NDIFrame {
  xres: number;
  yres: number;
  frameRateN: number;
  frameRateD: number;
  fourCC: number;
  data: Buffer;
  lineStrideBytes?: number;
  timestamp?: bigint;
}

// FourCC constants for NDI
const FOURCC_BGRA = 0x41524742; // 'BGRA' in little-endian

// Dynamic import for grandiose (native module)
let grandiose: {
  send(options: { name: string; clockVideo?: boolean; clockAudio?: boolean }): Promise<GrandioseSender>;
  FOURCC_BGRA: number;
} | null = null;

/**
 * NDI Output handler using grandiose
 */
export class NDIOutput {
  private sender: GrandioseSender | null = null;
  private running: boolean = false;
  private frameInterval: NodeJS.Timeout | null = null;
  private config: NDIConfig;
  private displayConfig: DisplayConfig;
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private actualFps: number = 0;
  private getFrameCallback: (() => Buffer) | null = null;

  constructor(config: NDIConfig, displayConfig: DisplayConfig) {
    this.config = config;
    this.displayConfig = displayConfig;
  }

  /**
   * Initialize the NDI sender
   */
  async initialize(): Promise<boolean> {
    try {
      // Dynamically import grandiose
      if (!grandiose) {
        try {
          const module = await import('grandiose');
          grandiose = module.default || module;
          logger.info('Grandiose NDI module loaded');
        } catch (importError) {
          logger.error({ error: importError }, 'Failed to load grandiose NDI module');
          logger.warn('NDI output will be disabled. Install NDI SDK and grandiose for NDI support.');
          return false;
        }
      }

      // Create NDI sender
      this.sender = await grandiose.send({
        name: this.config.name,
        clockVideo: true,
        clockAudio: false,
      });

      logger.info({ name: this.config.name }, 'NDI sender initialized');
      return true;
    } catch (error) {
      logger.error({ error }, 'Failed to initialize NDI sender');
      return false;
    }
  }

  /**
   * Start the frame output loop
   */
  start(getFrame: () => Buffer): void {
    if (this.running) {
      logger.warn('NDI output already running');
      return;
    }

    if (!this.sender) {
      logger.error('NDI sender not initialized');
      return;
    }

    this.running = true;
    this.getFrameCallback = getFrame;
    this.frameCount = 0;
    this.lastFrameTime = Date.now();

    const frameTime = 1000 / this.config.frameRate;

    logger.info({ frameRate: this.config.frameRate, frameTime }, 'Starting NDI output loop');

    // Use setInterval for frame output
    this.frameInterval = setInterval(() => this.sendFrame(), frameTime);
  }

  /**
   * Send a single frame to NDI
   */
  private async sendFrame(): Promise<void> {
    if (!this.running || !this.sender || !this.getFrameCallback) {
      return;
    }

    try {
      const startTime = performance.now();

      // Get frame buffer from callback
      const frameBuffer = this.getFrameCallback();

      // Create NDI frame
      const frame: NDIFrame = {
        xres: this.displayConfig.width,
        yres: this.displayConfig.height,
        frameRateN: this.config.frameRate * 1000,
        frameRateD: 1000,
        fourCC: grandiose?.FOURCC_BGRA || FOURCC_BGRA,
        data: frameBuffer,
        lineStrideBytes: this.displayConfig.width * 4, // BGRA = 4 bytes per pixel
      };

      // Send frame
      await this.sender.video(frame);

      // Update stats
      this.frameCount++;
      const now = Date.now();
      const elapsed = now - this.lastFrameTime;

      if (elapsed >= 1000) {
        this.actualFps = Math.round((this.frameCount * 1000) / elapsed);
        this.frameCount = 0;
        this.lastFrameTime = now;
      }

      // Log if frame took too long
      const renderTime = performance.now() - startTime;
      if (renderTime > 33) {
        logger.debug({ renderTime: Math.round(renderTime) }, 'Frame render exceeded budget');
      }
    } catch (error) {
      logger.error({ error }, 'Error sending NDI frame');
    }
  }

  /**
   * Stop the frame output loop
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.frameInterval) {
      clearInterval(this.frameInterval);
      this.frameInterval = null;
    }

    logger.info('NDI output loop stopped');
  }

  /**
   * Destroy the NDI sender
   */
  destroy(): void {
    this.stop();

    if (this.sender) {
      try {
        this.sender.destroy();
        this.sender = null;
        logger.info('NDI sender destroyed');
      } catch (error) {
        logger.error({ error }, 'Error destroying NDI sender');
      }
    }
  }

  /**
   * Check if NDI output is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get the actual frames per second being output
   */
  getActualFps(): number {
    return this.actualFps;
  }

  /**
   * Get NDI sender name
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Update configuration
   */
  updateConfig(config: NDIConfig): void {
    const wasRunning = this.running;
    const callback = this.getFrameCallback;

    // If frame rate changed, restart the loop
    if (config.frameRate !== this.config.frameRate && wasRunning && callback) {
      this.stop();
      this.config = config;
      this.start(callback);
    } else {
      this.config = config;
    }

    // Note: Changing NDI name requires re-initialization
    if (config.name !== this.config.name) {
      logger.warn('Changing NDI name requires restart of the signage engine');
    }
  }
}

/**
 * Create a mock NDI output for testing without NDI SDK
 */
export class MockNDIOutput {
  private running: boolean = false;
  private frameInterval: NodeJS.Timeout | null = null;
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private actualFps: number = 0;
  private config: NDIConfig;

  constructor(config: NDIConfig) {
    this.config = config;
  }

  async initialize(): Promise<boolean> {
    logger.info({ name: this.config.name }, 'Mock NDI output initialized (no actual NDI output)');
    return true;
  }

  start(getFrame: () => Buffer): void {
    if (this.running) return;

    this.running = true;
    this.frameCount = 0;
    this.lastFrameTime = Date.now();

    const frameTime = 1000 / this.config.frameRate;

    this.frameInterval = setInterval(() => {
      if (!this.running) return;

      // Call getFrame to keep rendering working, but don't output
      getFrame();

      this.frameCount++;
      const now = Date.now();
      const elapsed = now - this.lastFrameTime;

      if (elapsed >= 1000) {
        this.actualFps = Math.round((this.frameCount * 1000) / elapsed);
        this.frameCount = 0;
        this.lastFrameTime = now;
      }
    }, frameTime);

    logger.info('Mock NDI output started');
  }

  stop(): void {
    if (!this.running) return;

    this.running = false;
    if (this.frameInterval) {
      clearInterval(this.frameInterval);
      this.frameInterval = null;
    }
  }

  destroy(): void {
    this.stop();
  }

  isRunning(): boolean {
    return this.running;
  }

  getActualFps(): number {
    return this.actualFps;
  }

  getName(): string {
    return this.config.name;
  }

  updateConfig(config: NDIConfig): void {
    this.config = config;
  }
}

/**
 * Create NDI output (real or mock based on availability)
 */
export async function createNDIOutput(
  config: NDIConfig,
  displayConfig: DisplayConfig
): Promise<NDIOutput | MockNDIOutput> {
  const ndiOutput = new NDIOutput(config, displayConfig);
  const success = await ndiOutput.initialize();

  if (success) {
    return ndiOutput;
  }

  // Fall back to mock output
  logger.info('Falling back to mock NDI output');
  const mockOutput = new MockNDIOutput(config);
  await mockOutput.initialize();
  return mockOutput;
}
