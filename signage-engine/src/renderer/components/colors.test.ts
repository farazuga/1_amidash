import { describe, it, expect } from 'vitest';
import { colors, hexToRgba, getContrastColor } from './colors';

describe('colors constants', () => {
  describe('brand colors', () => {
    it('should have primary brand colors', () => {
      expect(colors.primary).toBe('#053B2C');
      expect(colors.primaryLight).toBe('#C2E0AD');
      expect(colors.primaryDark).toBe('#032218');
    });

    it('should have secondary brand colors', () => {
      expect(colors.mauve).toBe('#C67CA8');
      expect(colors.coral).toBe('#DE3829');
      expect(colors.amber).toBe('#F59F43');
    });
  });

  describe('status colors', () => {
    it('should have success color', () => {
      expect(colors.success).toBeDefined();
      expect(colors.success).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should have warning color', () => {
      expect(colors.warning).toBeDefined();
      expect(colors.warning).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should have error color', () => {
      expect(colors.error).toBeDefined();
      expect(colors.error).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  describe('chart colors', () => {
    it('should have chart color series', () => {
      expect(colors.chartPrimary).toBe('#3B82F6');
      expect(colors.chartSecondary).toBe('#22C55E');
      expect(colors.chartTertiary).toBe('#F59E0B');
    });
  });

  describe('medal colors', () => {
    it('should have gold, silver, bronze', () => {
      expect(colors.gold).toBeDefined();
      expect(colors.silver).toBeDefined();
      expect(colors.bronze).toBeDefined();
    });

    it('should have distinct medal colors', () => {
      expect(colors.gold).not.toBe(colors.silver);
      expect(colors.silver).not.toBe(colors.bronze);
      expect(colors.gold).not.toBe(colors.bronze);
    });
  });

  describe('gray scale', () => {
    it('should have full gray scale', () => {
      expect(colors.gray[50]).toBeDefined();
      expect(colors.gray[100]).toBeDefined();
      expect(colors.gray[500]).toBeDefined();
      expect(colors.gray[900]).toBeDefined();
    });

    it('should have proper gray progression (lighter to darker)', () => {
      const gray50 = parseInt(colors.gray[50].slice(1, 3), 16);
      const gray900 = parseInt(colors.gray[900].slice(1, 3), 16);
      expect(gray50).toBeGreaterThan(gray900);
    });
  });
});

describe('hexToRgba', () => {
  describe('basic conversions', () => {
    it('should convert black', () => {
      expect(hexToRgba('#000000')).toBe('rgba(0, 0, 0, 1)');
    });

    it('should convert white', () => {
      expect(hexToRgba('#ffffff')).toBe('rgba(255, 255, 255, 1)');
    });

    it('should convert red', () => {
      expect(hexToRgba('#ff0000')).toBe('rgba(255, 0, 0, 1)');
    });

    it('should convert green', () => {
      expect(hexToRgba('#00ff00')).toBe('rgba(0, 255, 0, 1)');
    });

    it('should convert blue', () => {
      expect(hexToRgba('#0000ff')).toBe('rgba(0, 0, 255, 1)');
    });
  });

  describe('alpha values', () => {
    it('should default alpha to 1', () => {
      expect(hexToRgba('#ff0000')).toBe('rgba(255, 0, 0, 1)');
    });

    it('should accept custom alpha', () => {
      expect(hexToRgba('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
    });

    it('should handle alpha of 0', () => {
      expect(hexToRgba('#ff0000', 0)).toBe('rgba(255, 0, 0, 0)');
    });

    it('should handle alpha of 1', () => {
      expect(hexToRgba('#ff0000', 1)).toBe('rgba(255, 0, 0, 1)');
    });

    it('should handle decimal alpha', () => {
      expect(hexToRgba('#ffffff', 0.75)).toBe('rgba(255, 255, 255, 0.75)');
    });
  });

  describe('brand color conversions', () => {
    it('should convert primary brand color', () => {
      expect(hexToRgba(colors.primary, 0.5)).toBe('rgba(5, 59, 44, 0.5)');
    });

    it('should convert primaryLight brand color', () => {
      expect(hexToRgba(colors.primaryLight, 0.8)).toBe('rgba(194, 224, 173, 0.8)');
    });
  });

  describe('case insensitivity', () => {
    it('should handle uppercase hex', () => {
      expect(hexToRgba('#FFFFFF')).toBe('rgba(255, 255, 255, 1)');
    });

    it('should handle lowercase hex', () => {
      expect(hexToRgba('#ffffff')).toBe('rgba(255, 255, 255, 1)');
    });

    it('should handle mixed case', () => {
      expect(hexToRgba('#FfFfFf')).toBe('rgba(255, 255, 255, 1)');
    });
  });
});

describe('getContrastColor', () => {
  describe('dark backgrounds', () => {
    it('should return white for black background', () => {
      expect(getContrastColor('#000000')).toBe('#ffffff');
    });

    it('should return white for dark blue', () => {
      expect(getContrastColor('#000080')).toBe('#ffffff');
    });

    it('should return white for brand primary (dark green)', () => {
      expect(getContrastColor(colors.primary)).toBe('#ffffff');
    });
  });

  describe('light backgrounds', () => {
    it('should return black for white background', () => {
      expect(getContrastColor('#ffffff')).toBe('#000000');
    });

    it('should return black for light yellow', () => {
      expect(getContrastColor('#ffff00')).toBe('#000000');
    });

    it('should return black for light green', () => {
      expect(getContrastColor(colors.primaryLight)).toBe('#000000');
    });
  });

  describe('edge cases', () => {
    it('should handle pure red', () => {
      expect(getContrastColor('#ff0000')).toBe('#ffffff');
    });

    it('should handle pure green', () => {
      expect(getContrastColor('#00ff00')).toBe('#000000');
    });

    it('should handle mid-gray', () => {
      const result = getContrastColor('#808080');
      expect(result === '#000000' || result === '#ffffff').toBe(true);
    });
  });
});
