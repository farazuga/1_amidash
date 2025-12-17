import 'dotenv/config';
import { initConfig, getConfig, updateConfig as updateConfigFn, SignageConfig } from './config/index.js';
import { PollingManager } from './data/polling-manager.js';
import { CanvasManager } from './renderer/canvas-manager.js';
import { SlideManager } from './renderer/slide-manager.js';
import { NDIOutput } from './ndi/output.js';
import { createAPIServer, startServer, EngineState } from './api/server.js';
import { logger } from './utils/logger.js';

class SignageEngine {
  private state: EngineState;
  private frameLoop: NodeJS.Timeout | null = null;

  constructor() {
    const config = initConfig();
    this.state = {
      isRunning: false,
      startTime: null,
      config,
      canvasManager: null,
      slideManager: null,
      pollingManager: null,
      ndiOutput: null,
    };
  }

  async start(): Promise<void> {
    if (this.state.isRunning) {
      logger.warn('Engine already running');
      return;
    }

    logger.info('Starting signage engine...');

    // Initialize components
    this.state.canvasManager = new CanvasManager(this.state.config.display);
    this.state.slideManager = new SlideManager(
      this.state.config.slides,
      this.state.config.display,
      this.state.config.transitions
    );
    this.state.pollingManager = new PollingManager(this.state.config.polling);
    this.state.ndiOutput = new NDIOutput(this.state.config.ndi, this.state.config.display);

    // Load assets and start services
    await this.state.slideManager.loadAssets();
    await this.state.pollingManager.start();
    await this.state.ndiOutput.initialize();

    // Start frame loop
    const frameInterval = 1000 / this.state.config.ndi.frameRate;
    this.frameLoop = setInterval(() => this.renderFrame(), frameInterval);

    this.state.isRunning = true;
    this.state.startTime = new Date();

    logger.info({ frameRate: this.state.config.ndi.frameRate }, 'Signage engine started');
  }

  async stop(): Promise<void> {
    if (!this.state.isRunning) {
      logger.warn('Engine not running');
      return;
    }

    logger.info('Stopping signage engine...');

    // Stop frame loop
    if (this.frameLoop) {
      clearInterval(this.frameLoop);
      this.frameLoop = null;
    }

    // Stop services
    this.state.pollingManager?.stop();
    this.state.ndiOutput?.destroy();

    // Clear references
    this.state.canvasManager = null;
    this.state.slideManager = null;
    this.state.pollingManager = null;
    this.state.ndiOutput = null;

    this.state.isRunning = false;
    this.state.startTime = null;

    logger.info('Signage engine stopped');
  }

  private renderFrame(): void {
    if (!this.state.canvasManager || !this.state.slideManager || !this.state.pollingManager || !this.state.ndiOutput) {
      return;
    }

    const data = this.state.pollingManager.getCache();
    this.state.slideManager.render(this.state.canvasManager, data);
    const frameData = this.state.canvasManager.getFrameData();
    this.state.ndiOutput.sendFrame(frameData);
  }

  getState(): EngineState {
    return this.state;
  }

  updateConfig(updates: Partial<SignageConfig>): SignageConfig {
    this.state.config = updateConfigFn(updates);
    return this.state.config;
  }
}

// Main entry point
async function main(): Promise<void> {
  logger.info('Initializing Amidash Digital Signage Engine');

  const engine = new SignageEngine();
  const config = getConfig();

  // Create and start API server
  const app = createAPIServer(
    config.api,
    () => engine.getState(),
    () => engine.start(),
    () => engine.stop(),
    (updates) => engine.updateConfig(updates)
  );
  startServer(app, config.api);

  // Auto-start engine if configured
  const autoStart = process.env.AUTO_START !== 'false';
  if (autoStart) {
    await engine.start();
  }

  // Handle shutdown
  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down...');
    await engine.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
