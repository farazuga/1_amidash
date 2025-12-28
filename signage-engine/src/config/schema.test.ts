import { describe, it, expect } from 'vitest';
import {
  SlideTypeSchema,
  SlideConfigSchema,
  NDIConfigSchema,
  DisplayConfigSchema,
  PollingConfigSchema,
  TransitionConfigSchema,
  APIConfigSchema,
  SignageConfigSchema,
  validateConfig,
} from './schema';

describe('Config Schema', () => {
  describe('SlideTypeSchema', () => {
    it('should accept valid slide types', () => {
      expect(SlideTypeSchema.parse('active-projects')).toBe('active-projects');
      expect(SlideTypeSchema.parse('project-list')).toBe('project-list');
      expect(SlideTypeSchema.parse('project-metrics')).toBe('project-metrics');
      expect(SlideTypeSchema.parse('po-ticker')).toBe('po-ticker');
      expect(SlideTypeSchema.parse('revenue-dashboard')).toBe('revenue-dashboard');
      expect(SlideTypeSchema.parse('team-schedule')).toBe('team-schedule');
    });

    it('should reject invalid slide types', () => {
      expect(() => SlideTypeSchema.parse('invalid-type')).toThrow();
    });
  });

  describe('SlideConfigSchema', () => {
    it('should parse valid slide config', () => {
      const config = SlideConfigSchema.parse({
        type: 'active-projects',
        enabled: true,
        duration: 15000,
      });

      expect(config.type).toBe('active-projects');
      expect(config.enabled).toBe(true);
      expect(config.duration).toBe(15000);
    });

    it('should apply defaults', () => {
      const config = SlideConfigSchema.parse({
        type: 'po-ticker',
      });

      expect(config.enabled).toBe(true);
      expect(config.duration).toBe(15000);
    });

    it('should reject duration below minimum', () => {
      expect(() =>
        SlideConfigSchema.parse({
          type: 'active-projects',
          duration: 500,
        })
      ).toThrow();
    });
  });

  describe('NDIConfigSchema', () => {
    it('should parse valid NDI config', () => {
      const config = NDIConfigSchema.parse({
        name: 'Test Signage',
        frameRate: 30,
      });

      expect(config.name).toBe('Test Signage');
      expect(config.frameRate).toBe(30);
    });

    it('should apply defaults', () => {
      const config = NDIConfigSchema.parse({});

      expect(config.name).toBe('Amidash Signage');
      expect(config.frameRate).toBe(30);
    });

    it('should reject frame rate out of range', () => {
      expect(() => NDIConfigSchema.parse({ frameRate: 10 })).toThrow();
      expect(() => NDIConfigSchema.parse({ frameRate: 120 })).toThrow();
    });
  });

  describe('DisplayConfigSchema', () => {
    it('should apply defaults for 4K display', () => {
      const config = DisplayConfigSchema.parse({});

      expect(config.width).toBe(3840);
      expect(config.height).toBe(2160);
      expect(config.backgroundColor).toBe('#053B2C');
      expect(config.accentColor).toBe('#C2E0AD');
    });

    it('should allow custom dimensions', () => {
      const config = DisplayConfigSchema.parse({
        width: 1920,
        height: 1080,
      });

      expect(config.width).toBe(1920);
      expect(config.height).toBe(1080);
    });
  });

  describe('PollingConfigSchema', () => {
    it('should apply default polling intervals', () => {
      const config = PollingConfigSchema.parse({});

      expect(config.projects).toBe(30000);
      expect(config.revenue).toBe(60000);
      expect(config.schedule).toBe(30000);
      expect(config.purchaseOrders).toBe(15000);
    });
  });

  describe('TransitionConfigSchema', () => {
    it('should accept valid transition types', () => {
      expect(TransitionConfigSchema.parse({ type: 'fade' }).type).toBe('fade');
      expect(TransitionConfigSchema.parse({ type: 'slide' }).type).toBe('slide');
      expect(TransitionConfigSchema.parse({ type: 'none' }).type).toBe('none');
    });

    it('should apply defaults', () => {
      const config = TransitionConfigSchema.parse({});

      expect(config.type).toBe('fade');
      expect(config.duration).toBe(500);
    });
  });

  describe('APIConfigSchema', () => {
    it('should apply defaults', () => {
      const config = APIConfigSchema.parse({});

      expect(config.port).toBe(3001);
      expect(config.host).toBe('127.0.0.1');
    });

    it('should allow custom port', () => {
      const config = APIConfigSchema.parse({ port: 8080 });

      expect(config.port).toBe(8080);
    });
  });

  describe('SignageConfigSchema', () => {
    it('should parse complete valid config', () => {
      const config = SignageConfigSchema.parse({
        slides: [
          { type: 'active-projects' },
          { type: 'revenue-dashboard' },
        ],
      });

      expect(config.slides).toHaveLength(2);
      expect(config.ndi.name).toBe('Amidash Signage');
      expect(config.display.width).toBe(3840);
    });

    it('should require at least one slide', () => {
      expect(() =>
        SignageConfigSchema.parse({
          slides: [],
        })
      ).toThrow();
    });
  });

  describe('validateConfig', () => {
    it('should validate and return parsed config', () => {
      const config = validateConfig({
        slides: [{ type: 'po-ticker' }],
      });

      expect(config.slides[0].type).toBe('po-ticker');
    });

    it('should throw on invalid config', () => {
      expect(() => validateConfig({})).toThrow();
      expect(() => validateConfig({ slides: [] })).toThrow();
    });
  });
});
