import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  calculateGoalDate,
  validateDateInRange,
  cleanSalesAmount,
  formatPhoneNumber,
  validateEmail,
} from '../utils';

describe('calculateGoalDate', () => {
  describe('Box Sale projects', () => {
    it('calculates 30 days out and rounds to 15th when landing before 15th', () => {
      // Jan 1 + 30 days = Jan 31, which is after 15th, so use last day
      const result = calculateGoalDate('Box Sale', new Date('2024-01-01'));
      expect(result).toBe('2024-01-31');
    });

    it('calculates 30 days out and rounds to 15th when landing on or before 15th', () => {
      // Dec 10 + 30 days = Jan 9, which is before 15th, so use 15th
      const result = calculateGoalDate('Box Sale', new Date('2024-12-10'));
      expect(result).toBe('2025-01-15');
    });

    it('handles case-insensitive matching for "box"', () => {
      const result1 = calculateGoalDate('BOX SALE', new Date('2024-01-01'));
      const result2 = calculateGoalDate('box sale', new Date('2024-01-01'));
      expect(result1).toBe(result2);
    });

    it('matches partial "box" in project type name', () => {
      const result = calculateGoalDate('Hardware Box', new Date('2024-01-01'));
      expect(result).toBe('2024-01-31');
    });
  });

  describe('Solution projects', () => {
    it('calculates 8 weeks (56 days) out for solution projects', () => {
      // Jan 1 + 56 days = Feb 26, which is after 15th, so use last day (29 in 2024 leap year)
      const result = calculateGoalDate('Solution', new Date('2024-01-01'));
      expect(result).toBe('2024-02-29');
    });

    it('rounds to 15th when solution lands before 15th', () => {
      // Nov 15 + 56 days = Jan 10, which is before 15th, so use 15th
      const result = calculateGoalDate('Solution', new Date('2024-11-15'));
      expect(result).toBe('2025-01-15');
    });

    it('handles case-insensitive matching for "solution"', () => {
      const result1 = calculateGoalDate('SOLUTION', new Date('2024-01-01'));
      const result2 = calculateGoalDate('solution', new Date('2024-01-01'));
      expect(result1).toBe(result2);
    });

    it('matches partial "solution" in project type name', () => {
      const result = calculateGoalDate('Enterprise Solution', new Date('2024-01-01'));
      expect(result).toBe('2024-02-29');
    });
  });

  describe('Default behavior', () => {
    it('defaults to 30 days for unknown project types', () => {
      const result = calculateGoalDate('Custom Project', new Date('2024-01-01'));
      expect(result).toBe('2024-01-31');
    });

    it('defaults to 30 days for empty string', () => {
      const result = calculateGoalDate('', new Date('2024-01-01'));
      expect(result).toBe('2024-01-31');
    });
  });

  describe('Edge cases', () => {
    it('handles month boundary correctly (landing in next month)', () => {
      // Dec 15 + 30 days = Jan 14, before 15th, so use 15th
      const result = calculateGoalDate('Box Sale', new Date('2024-12-15'));
      expect(result).toBe('2025-01-15');
    });

    it('handles year boundary correctly', () => {
      const result = calculateGoalDate('Box Sale', new Date('2024-12-20'));
      // Dec 20 + 30 = Jan 19, after 15th so use last day (31)
      expect(result).toBe('2025-01-31');
    });

    it('handles leap year February correctly', () => {
      // Jan 15 + 30 = Feb 14, before 15th, so use 15th
      const result = calculateGoalDate('Box Sale', new Date('2024-01-15'));
      expect(result).toBe('2024-02-15');
    });

    it('handles non-leap year February correctly', () => {
      // Jan 20 + 30 = Feb 19 (2025), after 15th, so use last day (28)
      const result = calculateGoalDate('Box Sale', new Date('2025-01-20'));
      expect(result).toBe('2025-02-28');
    });

    it('handles months with 30 days', () => {
      // Mar 20 + 30 = Apr 19, after 15th, so use last day (30)
      const result = calculateGoalDate('Box Sale', new Date('2024-03-20'));
      expect(result).toBe('2024-04-30');
    });

    it('uses current date when no fromDate provided', () => {
      const result = calculateGoalDate('Box Sale');
      // Just verify it returns a valid date string
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});

describe('validateDateInRange', () => {
  it('returns true for empty string', () => {
    expect(validateDateInRange('')).toBe(true);
  });

  it('returns true for dates in 2024', () => {
    expect(validateDateInRange('2024-01-01')).toBe(true);
    expect(validateDateInRange('2024-12-31')).toBe(true);
  });

  it('returns true for dates in 2030', () => {
    expect(validateDateInRange('2030-01-01')).toBe(true);
    expect(validateDateInRange('2030-12-31')).toBe(true);
  });

  it('returns false for dates before 2024', () => {
    expect(validateDateInRange('2023-12-31')).toBe(false);
    expect(validateDateInRange('2020-01-01')).toBe(false);
  });

  it('returns false for dates after 2030', () => {
    expect(validateDateInRange('2031-01-01')).toBe(false);
    expect(validateDateInRange('2035-06-15')).toBe(false);
  });

  it('returns false for invalid date format', () => {
    expect(validateDateInRange('01-01-2024')).toBe(false);
    expect(validateDateInRange('2024/01/01')).toBe(false);
    expect(validateDateInRange('invalid')).toBe(false);
  });

  it('returns false for partial date strings', () => {
    expect(validateDateInRange('2024-01')).toBe(false);
    expect(validateDateInRange('2024')).toBe(false);
  });
});

describe('cleanSalesAmount', () => {
  it('removes dollar sign', () => {
    expect(cleanSalesAmount('$1234')).toBe('1234');
  });

  it('removes commas', () => {
    expect(cleanSalesAmount('1,234,567')).toBe('1234567');
  });

  it('removes both dollar signs and commas', () => {
    expect(cleanSalesAmount('$1,234.56')).toBe('1234.56');
  });

  it('trims whitespace', () => {
    expect(cleanSalesAmount('  1234  ')).toBe('1234');
  });

  it('handles decimal numbers', () => {
    expect(cleanSalesAmount('1234.56')).toBe('1234.56');
  });

  it('returns empty string for invalid number formats', () => {
    expect(cleanSalesAmount('$$$')).toBe('');
    expect(cleanSalesAmount(',.,')).toBe('');
    expect(cleanSalesAmount('abc')).toBe('');
  });

  it('handles negative numbers', () => {
    expect(cleanSalesAmount('-1234')).toBe('-1234');
  });

  it('returns empty string for empty input', () => {
    expect(cleanSalesAmount('')).toBe('');
  });
});

describe('formatPhoneNumber', () => {
  it('formats 10-digit phone number', () => {
    expect(formatPhoneNumber('1234567890')).toBe('123-456-7890');
  });

  it('formats phone with existing formatting', () => {
    expect(formatPhoneNumber('(123) 456-7890')).toBe('123-456-7890');
  });

  it('handles phone with extension digits', () => {
    expect(formatPhoneNumber('12345678901234')).toBe('123-456-7890 ext 1234');
  });

  it('preserves text extensions', () => {
    expect(formatPhoneNumber('1234567890 ext 123')).toBe('123-456-7890 ext 123');
  });

  it('returns as-is if less than 10 digits', () => {
    expect(formatPhoneNumber('123456789')).toBe('123456789');
    expect(formatPhoneNumber('12345')).toBe('12345');
  });

  it('handles international format with leading 1', () => {
    expect(formatPhoneNumber('11234567890')).toBe('112-345-6789 ext 0');
  });
});

describe('validateEmail', () => {
  it('returns true for valid emails', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('user.name@domain.org')).toBe(true);
    expect(validateEmail('user+tag@example.co.uk')).toBe(true);
  });

  it('returns false for invalid emails', () => {
    expect(validateEmail('invalid')).toBe(false);
    expect(validateEmail('no@domain')).toBe(false);
    expect(validateEmail('@nodomain.com')).toBe(false);
    expect(validateEmail('spaces in@email.com')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(validateEmail('')).toBe(false);
  });
});
