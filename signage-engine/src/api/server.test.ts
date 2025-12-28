import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { createAPIServer, EngineState } from './server';
import { SignageConfig } from '../config/schema';

// Mock the logger module
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  getRecentLogs: vi.fn(() => []),
}));

describe('API Server', () => {
  const mockConfig: SignageConfig = {
    ndi: { name: 'Test Signage', frameRate: 30 },
    display: {
      width: 1920,
      height: 1080,
      backgroundColor: '#000000',
      accentColor: '#FFFFFF',
      fontFamily: 'Arial',
    },
    polling: {
      projects: 30000,
      revenue: 60000,
      schedule: 30000,
      purchaseOrders: 15000,
    },
    slides: [{ type: 'active-projects', enabled: true, duration: 15000 }],
    transitions: { type: 'fade', duration: 500 },
    api: { port: 3001, host: '127.0.0.1' },
    staleData: { warningThresholdMs: 60000, indicatorPosition: 'bottom-right' },
  };

  let mockState: EngineState;
  let startCalled: boolean;
  let stopCalled: boolean;

  beforeAll(() => {
    startCalled = false;
    stopCalled = false;

    mockState = {
      isRunning: false,
      startTime: null,
      config: mockConfig,
      canvasManager: null,
      slideManager: null,
      pollingManager: null,
      ndiOutput: null,
    };
  });

  const createApp = () => {
    return createAPIServer(
      mockConfig.api,
      () => mockState,
      async () => {
        mockState.isRunning = true;
        mockState.startTime = new Date();
        startCalled = true;
      },
      async () => {
        mockState.isRunning = false;
        mockState.startTime = null;
        stopCalled = true;
      },
      (updates) => ({ ...mockConfig, ...updates })
    );
  };

  describe('GET /health', () => {
    it('should return ok status', async () => {
      const app = createApp();
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /status', () => {
    it('should return engine status when stopped', async () => {
      mockState.isRunning = false;
      mockState.startTime = null;

      const app = createApp();
      const response = await request(app).get('/status');

      expect(response.status).toBe(200);
      expect(response.body.isRunning).toBe(false);
      expect(response.body.uptime).toBe(0);
      expect(response.body.currentSlide).toBe(0);
      expect(response.body.totalSlides).toBe(0);
    });

    it('should return uptime when running', async () => {
      mockState.isRunning = true;
      mockState.startTime = new Date(Date.now() - 5000);

      const app = createApp();
      const response = await request(app).get('/status');

      expect(response.status).toBe(200);
      expect(response.body.isRunning).toBe(true);
      expect(response.body.uptime).toBeGreaterThanOrEqual(5000);
    });
  });

  describe('GET /config', () => {
    it('should return current config', async () => {
      const app = createApp();
      const response = await request(app).get('/config');

      expect(response.status).toBe(200);
      expect(response.body.ndi.name).toBe('Test Signage');
      expect(response.body.display.width).toBe(1920);
    });
  });

  describe('POST /control/start', () => {
    it('should start the engine when stopped', async () => {
      mockState.isRunning = false;
      startCalled = false;

      const app = createApp();
      const response = await request(app).post('/control/start');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(startCalled).toBe(true);
    });

    it('should return error when already running', async () => {
      mockState.isRunning = true;

      const app = createApp();
      const response = await request(app).post('/control/start');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already running');
    });
  });

  describe('POST /control/stop', () => {
    it('should stop the engine when running', async () => {
      mockState.isRunning = true;
      stopCalled = false;

      const app = createApp();
      const response = await request(app).post('/control/stop');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(stopCalled).toBe(true);
    });

    it('should return error when not running', async () => {
      mockState.isRunning = false;

      const app = createApp();
      const response = await request(app).post('/control/stop');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('not running');
    });
  });
});
