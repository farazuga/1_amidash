import { logger } from './utils/logger.js';
import { initConfig, getConfig, updateConfig, type SignageConfig } from './config/index.js';
import { testConnection } from './data/supabase-client.js';
import { PollingManager, getPollingManager, destroyPollingManager } from './data/polling-manager.js';
import { CanvasManager, getCanvasManager, destroyCanvasManager } from './renderer/canvas-manager.js';
import { SlideManager } from './renderer/slide-manager.js';
import { createNDIOutput, type NDIOutput, type MockNDIOutput } from './ndi/output.js';
import { createAPIServer, startAPIServer, type SignageEngineInterface, type EngineStatus } from './api/server.js';

/**
 * Main Signage Engine class
 */
class SignageEngine implements SignageEngineInterface {
  private config: SignageConfig;
  private pollingManager: PollingManager | null = null;
  private canvasManager: CanvasManager | null = null;
  private slideManager: SlideManager | null = null;
  private ndiOutput: NDIOutput | MockNDIOutput | null = null;
  private running: boolean = false;
  private startTime: number = 0;
  private renderLoopId: NodeJS.Timeout | null = null;

  constructor(config: SignageConfig) {
    this.config = config;
  }

  /**
   * Initialize all engine components
   */
  async initialize(): Promise<void> {
    logger.info('Initializing signage engine...');

    // Test database connection
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Failed to connect to Supabase database');
    }

    // Initialize canvas manager
    this.canvasManager = getCanvasManager(this.config.display);
    await this.canvasManager.loadLogo(this.config.display.logoPath);

    // Initialize slide manager
    this.slideManager = new SlideManager(
      this.config.slides,
      this.config.display,
      this.config.transitions,
      this.config.staleData
    );
    this.slideManager.setLogo(this.canvasManager.getLogo());

    // Initialize polling manager
    this.pollingManager = getPollingManager(this.config.polling);

    // Initialize NDI output
    this.ndiOutput = await createNDIOutput(this.config.ndi, this.config.display);

    logger.info('Signage engine initialized');
  }

  /**
   * Start the signage engine
   */
  async start(): Promise<void> {
    if (this.running) {
      logger.warn('Engine already running');
      return;
    }

    if (!this.pollingManager || !this.canvasManager || !this.slideManager || !this.ndiOutput) {
      throw new Error('Engine not initialized');
    }

    logger.info('Starting signage engine...');

    // Start data polling
    await this.pollingManager.start();

    // Start render loop
    this.startRenderLoop();

    // Start NDI output
    this.ndiOutput.start(() => this.renderFrame());

    this.running = true;
    this.startTime = Date.now();

    logger.info('Signage engine started');
  }

  /**
   * Stop the signage engine
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    logger.info('Stopping signage engine...');

    // Stop NDI output
    this.ndiOutput?.stop();

    // Stop render loop
    if (this.renderLoopId) {
      clearInterval(this.renderLoopId);
      this.renderLoopId = null;
    }

    // Stop polling
    this.pollingManager?.stop();

    this.running = false;

    logger.info('Signage engine stopped');
  }

  /**
   * Shutdown and cleanup
   */
  shutdown(): void {
    this.stop();

    this.ndiOutput?.destroy();
    destroyPollingManager();
    destroyCanvasManager();

    this.pollingManager = null;
    this.canvasManager = null;
    this.slideManager = null;
    this.ndiOutput = null;

    logger.info('Signage engine shut down');
  }

  /**
   * Start the internal render loop
   */
  private startRenderLoop(): void {
    // Render at slightly higher rate than NDI output for smooth transitions
    const renderInterval = 1000 / (this.config.ndi.frameRate + 5);

    this.renderLoopId = setInterval(() => {
      this.renderToCanvas();
    }, renderInterval);
  }

  /**
   * Render current frame to canvas
   */
  private renderToCanvas(): void {
    if (!this.canvasManager || !this.slideManager || !this.pollingManager) {
      return;
    }

    const { width, height } = this.canvasManager.getDimensions();
    const ctx = this.canvasManager.getBackContext();

    // Clear the back buffer
    this.canvasManager.clearBackBuffer();

    // Get cached data
    const data = this.pollingManager.getAllData();
    const lastUpdate = this.pollingManager.getOldestTimestamp();

    // Render current slide
    this.slideManager.render(ctx, data, lastUpdate, width, height);

    // Swap buffers
    this.canvasManager.swap();
  }

  /**
   * Get the current frame buffer for NDI
   */
  private renderFrame(): Buffer {
    if (!this.canvasManager) {
      // Return empty buffer if not initialized
      return Buffer.alloc(this.config.display.width * this.config.display.height * 4);
    }

    return this.canvasManager.getFrameBuffer();
  }

  // =====================
  // SignageEngineInterface Implementation
  // =====================

  isRunning(): boolean {
    return this.running;
  }

  getConfig(): SignageConfig {
    return this.config;
  }

  updateConfig(updates: Partial<SignageConfig>): void {
    const newConfig = updateConfig(updates);
    this.config = newConfig;

    // Update sub-components
    if (updates.slides && this.slideManager) {
      this.slideManager.updateSlides(newConfig.slides);
    }
    if (updates.display) {
      this.canvasManager?.updateConfig(newConfig.display);
      this.slideManager?.updateDisplayConfig(newConfig.display);
    }
    if (updates.transitions && this.slideManager) {
      this.slideManager.updateTransitionConfig(newConfig.transitions);
    }
    if (updates.polling && this.pollingManager) {
      this.pollingManager.updateConfig(newConfig.polling);
    }

    logger.info('Configuration updated');
  }

  getStatus(): EngineStatus {
    return {
      running: this.running,
      currentSlide: this.slideManager?.getCurrentIndex() || 0,
      totalSlides: this.slideManager?.getTotalSlides() || 0,
      frameRate: this.config.ndi.frameRate,
      actualFps: this.ndiOutput?.getActualFps() || 0,
      uptime: this.running ? Date.now() - this.startTime : 0,
      lastDataUpdate: this.pollingManager?.getOldestTimestamp() || 0,
      ndiName: this.config.ndi.name,
      resolution: {
        width: this.config.display.width,
        height: this.config.display.height,
      },
      errors: 0, // TODO: Track errors
    };
  }

  getPreviewFrame(): Buffer {
    if (!this.canvasManager) {
      throw new Error('Canvas manager not initialized');
    }
    return this.canvasManager.getScaledPreviewBuffer(960);
  }

  getCurrentSlideIndex(): number {
    return this.slideManager?.getCurrentIndex() || 0;
  }

  getTotalSlides(): number {
    return this.slideManager?.getTotalSlides() || 0;
  }

  getActualFps(): number {
    return this.ndiOutput?.getActualFps() || 0;
  }

  getUptime(): number {
    return this.running ? Date.now() - this.startTime : 0;
  }

  getLastDataUpdate(): number {
    return this.pollingManager?.getOldestTimestamp() || 0;
  }

  nextSlide(): void {
    this.slideManager?.forceNext();
  }

  previousSlide(): void {
    this.slideManager?.forcePrevious();
  }

  goToSlide(index: number): void {
    this.slideManager?.goToSlide(index);
  }
}

// =====================
// Main Entry Point
// =====================

let engine: SignageEngine | null = null;

async function main(): Promise<void> {
  logger.info('=== Amidash NDI Signage Engine ===');

  try {
    // Load configuration
    const config = initConfig();

    // Create engine
    engine = new SignageEngine(config);

    // Initialize
    await engine.initialize();

    // Create and start API server
    const app = createAPIServer(() => engine);
    await startAPIServer(app, config.api);

    // Start the engine
    await engine.start();

    // Handle graceful shutdown
    const shutdown = () => {
      logger.info('Shutdown signal received');
      engine?.shutdown();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    logger.info('Signage engine running. Press Ctrl+C to stop.');
  } catch (error) {
    logger.error({ error }, 'Failed to start signage engine');
    process.exit(1);
  }
}

// Run
main().catch((error) => {
  logger.error({ error }, 'Unhandled error');
  process.exit(1);
});

export { SignageEngine };
