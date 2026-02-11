import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatNumber,
  truncateText,
  formatPercent,
  formatDate,
  formatDaysRemaining,
} from './format';

describe('formatCurrency', () => {
  describe('normal values', () => {
    it('should format small numbers without suffix', () => {
      expect(formatCurrency(0)).toBe('$0');
      expect(formatCurrency(500)).toBe('$500');
      expect(formatCurrency(999)).toBe('$999');
    });

    it('should format thousands with K suffix', () => {
      expect(formatCurrency(1000)).toBe('$1K');
      expect(formatCurrency(1500)).toBe('$2K');
      expect(formatCurrency(15000)).toBe('$15K');
      expect(formatCurrency(999999)).toBe('$1000K');
    });

    it('should format millions with M suffix', () => {
      expect(formatCurrency(1000000)).toBe('$1.00M');
      expect(formatCurrency(1500000)).toBe('$1.50M');
      expect(formatCurrency(25000000)).toBe('$25.00M');
    });

    it('should respect decimalsForMillions parameter', () => {
      expect(formatCurrency(1234567, 0)).toBe('$1M');
      expect(formatCurrency(1234567, 1)).toBe('$1.2M');
      expect(formatCurrency(1234567, 3)).toBe('$1.235M');
    });
  });

  describe('edge cases', () => {
    it('should handle zero', () => {
      expect(formatCurrency(0)).toBe('$0');
    });

    it('should handle extremely large numbers', () => {
      expect(formatCurrency(999999999)).toBe('$1000.00M');
      expect(formatCurrency(1000000000)).toBe('$1000.00M');
    });

    it('should handle negative numbers (falls back to locale string)', () => {
      // Negative numbers don't get K/M suffix, they use locale formatting
      expect(formatCurrency(-1000)).toBe('$-1,000');
      expect(formatCurrency(-1000000)).toBe('$-1,000,000');
    });

    it('should handle decimal values', () => {
      expect(formatCurrency(1234.56)).toBe('$1K');
      expect(formatCurrency(1234567.89)).toBe('$1.23M');
    });
  });
});

describe('formatNumber', () => {
  describe('normal values', () => {
    it('should format small numbers without suffix', () => {
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(123)).toBe('123');
      expect(formatNumber(999)).toBe('999');
    });

    it('should format thousands with K suffix', () => {
      expect(formatNumber(1000)).toBe('1K');
      expect(formatNumber(2500)).toBe('3K');
      expect(formatNumber(45000)).toBe('45K');
    });

    it('should format millions with M suffix', () => {
      expect(formatNumber(1000000)).toBe('1.0M');
      expect(formatNumber(2500000)).toBe('2.5M');
    });
  });

  describe('edge cases', () => {
    it('should handle zero', () => {
      expect(formatNumber(0)).toBe('0');
    });

    it('should handle extremely large numbers', () => {
      expect(formatNumber(999999999)).toBe('1000.0M');
    });

    it('should respect decimals parameter', () => {
      expect(formatNumber(1234567, 0)).toBe('1M');
      expect(formatNumber(1234567, 2)).toBe('1.23M');
    });
  });
});

describe('truncateText', () => {
  describe('normal cases', () => {
    it('should not truncate short text', () => {
      expect(truncateText('hello', 10)).toBe('hello');
      expect(truncateText('hello', 5)).toBe('hello');
    });

    it('should truncate long text with ellipsis', () => {
      expect(truncateText('hello world', 8)).toBe('hello...');
      expect(truncateText('this is a very long string', 15)).toBe('this is a ve...');
    });

    it('should handle exact length', () => {
      expect(truncateText('hello', 5)).toBe('hello');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(truncateText('', 10)).toBe('');
    });

    it('should handle very short maxLength', () => {
      expect(truncateText('hello', 3)).toBe('...');
      expect(truncateText('hello', 4)).toBe('h...');
    });

    it('should handle maxLength of 0 or negative', () => {
      expect(truncateText('hello', 0)).toBe('...');
      expect(truncateText('hello', -1)).toBe('...');
    });
  });
});

describe('formatPercent', () => {
  describe('normal cases', () => {
    it('should format whole numbers', () => {
      expect(formatPercent(50)).toBe('50%');
      expect(formatPercent(100)).toBe('100%');
      expect(formatPercent(0)).toBe('0%');
    });

    it('should handle decimals parameter', () => {
      expect(formatPercent(33.333, 0)).toBe('33%');
      expect(formatPercent(33.333, 1)).toBe('33.3%');
      expect(formatPercent(33.333, 2)).toBe('33.33%');
    });
  });

  describe('edge cases', () => {
    it('should handle zero', () => {
      expect(formatPercent(0)).toBe('0%');
    });

    it('should handle 100', () => {
      expect(formatPercent(100)).toBe('100%');
    });

    it('should handle values over 100', () => {
      expect(formatPercent(150)).toBe('150%');
    });

    it('should handle negative values', () => {
      // -10 < 1, so it gets multiplied by 100 -> -1000
      expect(formatPercent(-10)).toBe('-1000%');
      // For actual negative percentages, use values > 1 (already in percent form)
      expect(formatPercent(-10 / 100)).toBe('-10%');
    });

    it('should handle decimal values (auto-converts to percentage)', () => {
      // 0.1 * 100 = 10%
      expect(formatPercent(0.1, 1)).toBe('10.0%');
      expect(formatPercent(0.005, 1)).toBe('0.5%');
    });
  });
});

describe('formatDate', () => {
  describe('Date objects', () => {
    it('should format Date objects', () => {
      // Use a date created without timezone ambiguity
      const date = new Date(2024, 0, 15); // Jan 15, 2024 local time
      const formatted = formatDate(date);
      expect(formatted).toMatch(/Jan 15/);
    });
  });

  describe('string dates', () => {
    it('should format ISO datetime strings', () => {
      // Use full datetime with timezone to avoid timezone issues
      const formatted = formatDate('2024-06-20T12:00:00');
      expect(formatted).toMatch(/Jun/);
      expect(formatted).toMatch(/2024/);
    });

    it('should format to expected format (Mon DD, YYYY)', () => {
      const date = new Date(2024, 11, 25); // Dec 25, 2024
      const formatted = formatDate(date);
      expect(formatted).toBe('Dec 25, 2024');
    });
  });

  describe('edge cases', () => {
    it('should handle invalid date strings gracefully', () => {
      const result = formatDate('invalid');
      expect(typeof result).toBe('string');
    });
  });
});

describe('formatDaysRemaining', () => {
  describe('positive days (remaining)', () => {
    it('should format single day', () => {
      expect(formatDaysRemaining(1)).toBe('1 day left');
    });

    it('should format multiple days', () => {
      expect(formatDaysRemaining(5)).toBe('5 days left');
      expect(formatDaysRemaining(30)).toBe('30 days left');
    });
  });

  describe('negative days (overdue)', () => {
    it('should format single day overdue', () => {
      expect(formatDaysRemaining(-1)).toBe('1 day overdue');
    });

    it('should format multiple days overdue', () => {
      expect(formatDaysRemaining(-5)).toBe('5 days overdue');
      expect(formatDaysRemaining(-30)).toBe('30 days overdue');
    });
  });

  describe('edge cases', () => {
    it('should handle zero days', () => {
      expect(formatDaysRemaining(0)).toBe('Due today');
    });

    it('should handle large numbers', () => {
      expect(formatDaysRemaining(365)).toBe('365 days left');
      expect(formatDaysRemaining(-365)).toBe('365 days overdue');
    });
  });
});
