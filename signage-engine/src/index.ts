import 'dotenv/config';
import { GlobalFonts } from '@napi-rs/canvas';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initConfig, getConfig, updateConfig as updateConfigFn, SignageConfig } from './config/index.js';
import { PollingManager } from './data/polling-manager.js';
import { CanvasManager } from './renderer/canvas-manager.js';
import { LayoutManager } from './renderer/layout-manager.js';
import { NDIOutput } from './ndi/output.js';
import { createAPIServer, startServer, EngineState } from './api/server.js';
import { logger } from './utils/logger.js';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Register fonts at startup
function registerFonts(): void {
  const fontsDir = join(__dirname, '..', 'assets', 'fonts');
  try {
    GlobalFonts.registerFromPath(join(fontsDir, 'Inter-Regular.ttf'), 'Inter');
    GlobalFonts.registerFromPath(join(fontsDir, 'Inter-Bold.ttf'), 'Inter');
    GlobalFonts.registerFromPath(join(fontsDir, 'Inter-SemiBold.ttf'), 'Inter');
    logger.info({ families: GlobalFonts.families.map(f => f.family) }, 'Fonts registered');
  } catch (err) {
    logger.warn({ error: err }, 'Failed to register custom fonts, text may not render correctly');
  }
}

class SignageEngine {
  private state: EngineState;
  private frameLoop: NodeJS.Timeout | null = null;
  private lastSlideConfigHash: string = '';
  private lastFrameTime: number = 0;

  constructor() {
    const config = initConfig();
    this.state = {
      isRunning: false,
      startTime: null,
      config,
      canvasManager: null,
      layoutManager: null,
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
    this.state.layoutManager = new LayoutManager(
      this.state.config.display.width,
      this.state.config.display.height
    );
    this.state.pollingManager = new PollingManager(this.state.config.polling);
    this.state.ndiOutput = new NDIOutput(this.state.config.ndi, this.state.config.display);

    // Start services
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
    this.state.layoutManager = null;
    this.state.pollingManager = null;
    this.state.ndiOutput = null;

    this.state.isRunning = false;
    this.state.startTime = null;

    logger.info('Signage engine stopped');
  }

  private renderFrame(): void {
    if (!this.state.canvasManager || !this.state.layoutManager || !this.state.pollingManager || !this.state.ndiOutput) {
      return;
    }

    const data = this.state.pollingManager.getCache();
    const ctx = this.state.canvasManager.getBackContext();

    // Check if block config has changed and update layout
    this.checkAndReloadBlocks(data);

    // Calculate deltaTime in ms
    const now = Date.now();
    const deltaTime = this.lastFrameTime ? now - this.lastFrameTime : 16.67;
    this.lastFrameTime = now;

    this.state.canvasManager.clear();
    this.state.layoutManager.render(ctx, data as unknown as Record<string, unknown>, deltaTime);
    this.state.canvasManager.swap();

    const frameData = this.state.canvasManager.getFrameData();
    this.state.ndiOutput.sendFrame(frameData);
  }

  private checkAndReloadBlocks(data: ReturnType<PollingManager['getCache']>): void {
    const blocksConfig = data.blocksConfig.data;
    if (!blocksConfig || blocksConfig.blocks.length === 0) return;

    // Create a simple hash of blocks config to detect changes
    const configHash = blocksConfig.blocks.map(b => `${b.id}:${b.enabled}:${b.display_order}`).join('|');

    if (configHash !== this.lastSlideConfigHash) {
      this.lastSlideConfigHash = configHash;
      this.state.layoutManager?.updateConfig(blocksConfig.blocks, blocksConfig.settings);
    }
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

  // Register fonts before initializing engine
  registerFonts();

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
