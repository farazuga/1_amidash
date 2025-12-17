import express, { Express, Request, Response, NextFunction } from 'express';
import { logger, getRecentLogs } from '../utils/logger.js';
import type { SignageConfig, APIConfig } from '../config/schema.js';

// Types for engine interface
export interface SignageEngineInterface {
  isRunning(): boolean;
  start(): Promise<void>;
  stop(): void;
  getConfig(): SignageConfig;
  updateConfig(config: Partial<SignageConfig>): void;
  getStatus(): EngineStatus;
  getPreviewFrame(): Buffer;
  getCurrentSlideIndex(): number;
  getTotalSlides(): number;
  getActualFps(): number;
  getUptime(): number;
  getLastDataUpdate(): number;
  nextSlide(): void;
  previousSlide(): void;
  goToSlide(index: number): void;
}

export interface EngineStatus {
  running: boolean;
  currentSlide: number;
  totalSlides: number;
  frameRate: number;
  actualFps: number;
  uptime: number;
  lastDataUpdate: number;
  ndiName: string;
  resolution: {
    width: number;
    height: number;
  };
  errors: number;
}

/**
 * Create and configure the Express API server
 */
export function createAPIServer(getEngine: () => SignageEngineInterface | null): Express {
  const app = express();

  // Middleware
  app.use(express.json());

  // CORS for local development
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }

    next();
  });

  // Request logging
  app.use((req: Request, res: Response, next: NextFunction) => {
    logger.debug({ method: req.method, path: req.path }, 'API request');
    next();
  });

  // =====================
  // Status Endpoints
  // =====================

  /**
   * GET /status - Get engine status
   */
  app.get('/status', (req: Request, res: Response) => {
    const engine = getEngine();

    if (!engine) {
      res.status(503).json({
        running: false,
        error: 'Engine not initialized',
      });
      return;
    }

    const status = engine.getStatus();
    res.json(status);
  });

  /**
   * GET /health - Health check endpoint
   */
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // =====================
  // Control Endpoints
  // =====================

  /**
   * POST /control/start - Start the engine
   */
  app.post('/control/start', async (req: Request, res: Response) => {
    const engine = getEngine();

    if (!engine) {
      res.status(503).json({ success: false, error: 'Engine not initialized' });
      return;
    }

    if (engine.isRunning()) {
      res.json({ success: true, message: 'Engine already running' });
      return;
    }

    try {
      await engine.start();
      res.json({ success: true, message: 'Engine started' });
    } catch (error) {
      logger.error({ error }, 'Failed to start engine');
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /control/stop - Stop the engine
   */
  app.post('/control/stop', (req: Request, res: Response) => {
    const engine = getEngine();

    if (!engine) {
      res.status(503).json({ success: false, error: 'Engine not initialized' });
      return;
    }

    if (!engine.isRunning()) {
      res.json({ success: true, message: 'Engine already stopped' });
      return;
    }

    try {
      engine.stop();
      res.json({ success: true, message: 'Engine stopped' });
    } catch (error) {
      logger.error({ error }, 'Failed to stop engine');
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /control/restart - Restart the engine
   */
  app.post('/control/restart', async (req: Request, res: Response) => {
    const engine = getEngine();

    if (!engine) {
      res.status(503).json({ success: false, error: 'Engine not initialized' });
      return;
    }

    try {
      engine.stop();
      await new Promise((resolve) => setTimeout(resolve, 500));
      await engine.start();
      res.json({ success: true, message: 'Engine restarted' });
    } catch (error) {
      logger.error({ error }, 'Failed to restart engine');
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /control/next - Advance to next slide
   */
  app.post('/control/next', (req: Request, res: Response) => {
    const engine = getEngine();

    if (!engine) {
      res.status(503).json({ success: false, error: 'Engine not initialized' });
      return;
    }

    engine.nextSlide();
    res.json({ success: true, currentSlide: engine.getCurrentSlideIndex() });
  });

  /**
   * POST /control/previous - Go to previous slide
   */
  app.post('/control/previous', (req: Request, res: Response) => {
    const engine = getEngine();

    if (!engine) {
      res.status(503).json({ success: false, error: 'Engine not initialized' });
      return;
    }

    engine.previousSlide();
    res.json({ success: true, currentSlide: engine.getCurrentSlideIndex() });
  });

  /**
   * POST /control/slide/:index - Go to specific slide
   */
  app.post('/control/slide/:index', (req: Request, res: Response) => {
    const engine = getEngine();

    if (!engine) {
      res.status(503).json({ success: false, error: 'Engine not initialized' });
      return;
    }

    const index = parseInt(req.params.index, 10);
    if (isNaN(index) || index < 0 || index >= engine.getTotalSlides()) {
      res.status(400).json({ success: false, error: 'Invalid slide index' });
      return;
    }

    engine.goToSlide(index);
    res.json({ success: true, currentSlide: engine.getCurrentSlideIndex() });
  });

  // =====================
  // Configuration Endpoints
  // =====================

  /**
   * GET /config - Get current configuration
   */
  app.get('/config', (req: Request, res: Response) => {
    const engine = getEngine();

    if (!engine) {
      res.status(503).json({ error: 'Engine not initialized' });
      return;
    }

    res.json(engine.getConfig());
  });

  /**
   * PUT /config - Update configuration
   */
  app.put('/config', (req: Request, res: Response) => {
    const engine = getEngine();

    if (!engine) {
      res.status(503).json({ success: false, error: 'Engine not initialized' });
      return;
    }

    try {
      engine.updateConfig(req.body);
      res.json({ success: true, config: engine.getConfig() });
    } catch (error) {
      logger.error({ error }, 'Failed to update config');
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Invalid configuration',
      });
    }
  });

  // =====================
  // Preview Endpoints
  // =====================

  /**
   * GET /preview - Get current frame as PNG
   */
  app.get('/preview', (req: Request, res: Response) => {
    const engine = getEngine();

    if (!engine) {
      res.status(503).send('Engine not initialized');
      return;
    }

    try {
      const frame = engine.getPreviewFrame();
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(frame);
    } catch (error) {
      logger.error({ error }, 'Failed to get preview frame');
      res.status(500).send('Failed to generate preview');
    }
  });

  // =====================
  // Logging Endpoints
  // =====================

  /**
   * GET /logs - Get recent log entries
   */
  app.get('/logs', (req: Request, res: Response) => {
    const count = parseInt(req.query.count as string, 10) || 50;
    const logs = getRecentLogs(Math.min(count, 100));
    res.json(logs);
  });

  // =====================
  // Error Handler
  // =====================

  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error({ error: err, path: req.path }, 'API error');
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    });
  });

  return app;
}

/**
 * Start the API server
 */
export function startAPIServer(
  app: Express,
  config: APIConfig
): Promise<ReturnType<Express['listen']>> {
  return new Promise((resolve, reject) => {
    const server = app.listen(config.port, config.host, () => {
      logger.info({ host: config.host, port: config.port }, 'API server started');
      resolve(server);
    });

    server.on('error', (error) => {
      logger.error({ error }, 'API server error');
      reject(error);
    });
  });
}
