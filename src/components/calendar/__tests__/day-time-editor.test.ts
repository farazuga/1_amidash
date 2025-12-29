import { describe, it, expect } from 'vitest';
import { adjustTime } from '../day-time-editor';

describe('adjustTime', () => {
  describe('adding hours', () => {
    it('adds 1 hour to morning time', () => {
      expect(adjustTime('07:00', 1)).toBe('08:00');
    });

    it('adds 1 hour to afternoon time', () => {
      expect(adjustTime('14:30', 1)).toBe('15:30');
    });

    it('adds multiple hours', () => {
      expect(adjustTime('10:00', 3)).toBe('13:00');
    });

    it('preserves minutes when adding hours', () => {
      expect(adjustTime('09:45', 2)).toBe('11:45');
    });
  });

  describe('subtracting hours', () => {
    it('subtracts 1 hour from afternoon time', () => {
      expect(adjustTime('16:00', -1)).toBe('15:00');
    });

    it('subtracts 1 hour from morning time', () => {
      expect(adjustTime('09:30', -1)).toBe('08:30');
    });

    it('subtracts multiple hours', () => {
      expect(adjustTime('15:00', -3)).toBe('12:00');
    });

    it('preserves minutes when subtracting hours', () => {
      expect(adjustTime('14:15', -2)).toBe('12:15');
    });
  });

  describe('clamping at boundaries', () => {
    it('clamps at 23:00 when adding past midnight', () => {
      expect(adjustTime('22:00', 2)).toBe('23:00');
    });

    it('clamps at 23:00 when adding large hours', () => {
      expect(adjustTime('10:00', 20)).toBe('23:00');
    });

    it('clamps at 00:00 when subtracting past midnight', () => {
      expect(adjustTime('01:00', -3)).toBe('00:00');
    });

    it('clamps at 00:00 when subtracting large hours', () => {
      expect(adjustTime('10:00', -15)).toBe('00:00');
    });

    it('preserves minutes when clamping at 23', () => {
      expect(adjustTime('22:30', 5)).toBe('23:30');
    });

    it('preserves minutes when clamping at 0', () => {
      expect(adjustTime('01:45', -5)).toBe('00:45');
    });
  });

  describe('edge cases', () => {
    it('handles midnight (00:00)', () => {
      expect(adjustTime('00:00', 1)).toBe('01:00');
    });

    it('handles 23:00', () => {
      expect(adjustTime('23:00', -1)).toBe('22:00');
    });

    it('handles adding 0 hours', () => {
      expect(adjustTime('10:00', 0)).toBe('10:00');
    });

    it('handles times with leading zeros', () => {
      expect(adjustTime('07:05', 1)).toBe('08:05');
    });

    it('returns properly formatted time with leading zeros', () => {
      expect(adjustTime('01:00', -1)).toBe('00:00');
      expect(adjustTime('10:00', -1)).toBe('09:00');
    });
  });
});
