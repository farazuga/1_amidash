import { logger } from '../utils/logger.js';
import { NDIConfig, DisplayConfig } from '../config/schema.js';

// NDI SDK interface (optional dependency, may not be installed)
interface NDIModule {
  initialize(): boolean;
  destroy(): void;
  Sender: new (options: { name: string; clockVideo: boolean; clockAudio: boolean }) => NDINativeSender;
  FourCC: { BGRA: string; RGBA: string };
}

interface NDINativeSender {
  sendVideo(frame: {
    xres: number;
    yres: number;
    fourCC: string;
    frameRateN: number;
    frameRateD: number;
    data: Buffer;
  }): void;
  destroy(): void;
}

// Try to import ndi-node (optional dependency)
let ndi: NDIModule | null = null;
let ndiInitialized = false;

async function loadNDI(): Promise<void> {
  try {
    // Dynamic import with error handling for missing module
    ndi = await import('@vygr-labs/ndi-node' as string) as unknown as NDIModule;
    if (ndi.initialize()) {
      ndiInitialized = true;
      logger.info('NDI SDK (@vygr-labs/ndi-node) loaded and initialized successfully');
    } else {
      logger.warn('NDI SDK failed to initialize. Using mock output for testing.');
      ndi = null;
    }
  } catch {
    logger.warn('NDI SDK (@vygr-labs/ndi-node) not available. Using mock output for testing.');
  }
}
// Load on module init
loadNDI();

export interface NDISender {
  sendFrame(frame: {
    data: Buffer;
    width: number;
    height: number;
    frameRateN: number;
    frameRateD: number;
  }): void;
  destroy(): void;
}

// Wrapper class for the native NDI sender
class NativeNDISenderWrapper implements NDISender {
  private nativeSender: NDINativeSender;
  private fourCC: string;

  constructor(nativeSender: NDINativeSender, fourCC: string) {
    this.nativeSender = nativeSender;
    this.fourCC = fourCC;
  }

  sendFrame(frame: {
    data: Buffer;
    width: number;
    height: number;
    frameRateN: number;
    frameRateD: number;
  }): void {
    this.nativeSender.sendVideo({
      xres: frame.width,
      yres: frame.height,
      fourCC: this.fourCC,
      frameRateN: frame.frameRateN,
      frameRateD: frame.frameRateD,
      data: frame.data,
    });
  }

  destroy(): void {
    this.nativeSender.destroy();
  }
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
    if (ndi && ndiInitialized) {
      try {
        const nativeSender = new ndi.Sender({
          name: this.config.name,
          clockVideo: true,
          clockAudio: false,
        });
        this.sender = new NativeNDISenderWrapper(nativeSender, ndi.FourCC.BGRA);
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
      this.sender.sendFrame({
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

  sendFrame(_frame: {
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

// Cleanup NDI on process exit
process.on('exit', () => {
  if (ndi && ndiInitialized) {
    ndi.destroy();
    logger.info('NDI SDK destroyed');
  }
});
