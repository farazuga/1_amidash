import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { SignageConfig, APIConfig } from '../config/schema.js';
import { logger, getRecentLogs } from '../utils/logger.js';
import { CanvasManager } from '../renderer/canvas-manager.js';
import { SlideManager } from '../renderer/slide-manager.js';
import { PollingManager } from '../data/polling-manager.js';
import { NDIOutput } from '../ndi/output.js';

export interface EngineState {
  isRunning: boolean;
  startTime: Date | null;
  config: SignageConfig;
  canvasManager: CanvasManager | null;
  slideManager: SlideManager | null;
  pollingManager: PollingManager | null;
  ndiOutput: NDIOutput | null;
}

export type StartCallback = () => Promise<void>;
export type StopCallback = () => Promise<void>;

export function createAPIServer(
  config: APIConfig,
  getState: () => EngineState,
  onStart: StartCallback,
  onStop: StopCallback,
  updateConfig: (config: Partial<SignageConfig>) => SignageConfig
): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // Get engine status
  app.get('/status', (_req: Request, res: Response) => {
    const state = getState();
    const currentSlideIndex = state.slideManager?.getCurrentSlideIndex() ?? 0;
    res.json({
      isRunning: state.isRunning,
      uptime: state.startTime ? Date.now() - state.startTime.getTime() : 0,
      currentSlide: currentSlideIndex,
      currentSlideType: state.config.slides[currentSlideIndex]?.type ?? null,
      totalSlides: state.slideManager?.getSlideCount() ?? 0,
      slides: state.config.slides.map((s, i) => ({
        index: i,
        type: s.type,
        enabled: s.enabled,
        title: s.title,
      })),
      fps: state.ndiOutput?.getFPS() ?? 0,
      frameCount: state.ndiOutput?.getFrameCount() ?? 0,
      dataStale: state.pollingManager?.isDataStale(state.config.staleData.warningThresholdMs) ?? false,
    });
  });

  // Get current config
  app.get('/config', (_req: Request, res: Response) => {
    const state = getState();
    res.json(state.config);
  });

  // Update config
  app.put('/config', (req: Request, res: Response) => {
    try {
      const newConfig = updateConfig(req.body);
      res.json(newConfig);
    } catch (error) {
      res.status(400).json({ error: 'Invalid configuration', details: String(error) });
    }
  });

  // Start engine
  app.post('/control/start', async (_req: Request, res: Response) => {
    try {
      const state = getState();
      if (state.isRunning) {
        res.status(400).json({ error: 'Engine is already running' });
        return;
      }
      await onStart();
      res.json({ success: true, message: 'Engine started' });
    } catch (error) {
      logger.error({ error }, 'Failed to start engine');
      res.status(500).json({ error: 'Failed to start engine', details: String(error) });
    }
  });

  // Stop engine
  app.post('/control/stop', async (_req: Request, res: Response) => {
    try {
      const state = getState();
      if (!state.isRunning) {
        res.status(400).json({ error: 'Engine is not running' });
        return;
      }
      await onStop();
      res.json({ success: true, message: 'Engine stopped' });
    } catch (error) {
      logger.error({ error }, 'Failed to stop engine');
      res.status(500).json({ error: 'Failed to stop engine', details: String(error) });
    }
  });

  // Restart engine
  app.post('/control/restart', async (_req: Request, res: Response) => {
    try {
      const state = getState();
      if (state.isRunning) {
        await onStop();
      }
      await onStart();
      res.json({ success: true, message: 'Engine restarted' });
    } catch (error) {
      logger.error({ error }, 'Failed to restart engine');
      res.status(500).json({ error: 'Failed to restart engine', details: String(error) });
    }
  });

  // Get preview frame
  app.get('/preview', async (_req: Request, res: Response) => {
    try {
      const state = getState();
      if (!state.canvasManager) {
        res.status(503).json({ error: 'Engine is not running' });
        return;
      }
      const png = await state.canvasManager.getPreviewPng();
      res.set('Content-Type', 'image/png');
      res.send(png);
    } catch (error) {
      logger.error({ error }, 'Failed to generate preview');
      res.status(500).json({ error: 'Failed to generate preview' });
    }
  });

  // Get recent logs
  app.get('/logs', (req: Request, res: Response) => {
    const count = parseInt(req.query.count as string) || 50;
    const logs = getRecentLogs(count);
    res.json(logs);
  });

  // Jump to specific slide
  app.post('/control/slide/:index', (req: Request, res: Response) => {
    try {
      const state = getState();
      if (!state.slideManager) {
        res.status(503).json({ error: 'Engine is not running' });
        return;
      }
      const index = parseInt(req.params.index);
      const total = state.slideManager.getSlideCount();
      if (isNaN(index) || index < 0 || index >= total) {
        res.status(400).json({ error: `Invalid slide index. Must be 0-${total - 1}` });
        return;
      }
      state.slideManager.jumpToSlide(index);
      res.json({ success: true, currentSlide: index, totalSlides: total });
    } catch (error) {
      res.status(500).json({ error: 'Failed to change slide', details: String(error) });
    }
  });

  return app;
}

export function startServer(app: Express, config: APIConfig): void {
  app.listen(config.port, config.host, () => {
    logger.info({ host: config.host, port: config.port }, 'API server started');
  });
}
