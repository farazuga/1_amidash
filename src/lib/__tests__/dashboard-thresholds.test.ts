import { describe, it, expect } from 'vitest';
import { DEFAULT_THRESHOLDS, type DashboardThresholds } from '../dashboard-thresholds';

// ---------------------------------------------------------------------------
// Structure & completeness
// ---------------------------------------------------------------------------

describe('DashboardThresholds interface keys', () => {
  const expectedKeys: Array<keyof DashboardThresholds> = [
    'wipAgingDays',
    'salesHealthThreshold',
    'operationsHealthThreshold',
    'ontimeGoodThreshold',
    'ontimeWarningThreshold',
    'concentrationHighThreshold',
    'concentrationMediumThreshold',
    'backlogWarningMonths',
    'notScheduledWarningDays',
    'lowInvoiceWarningPercent',
    'signageMinProjectValue',
    'signageUpcomingDays',
  ];

  it('DEFAULT_THRESHOLDS contains all 12 expected keys', () => {
    expect(Object.keys(DEFAULT_THRESHOLDS)).toHaveLength(expectedKeys.length);
  });

  expectedKeys.forEach((key) => {
    it(`DEFAULT_THRESHOLDS has key "${key}"`, () => {
      expect(DEFAULT_THRESHOLDS).toHaveProperty(key);
    });
  });
});

// ---------------------------------------------------------------------------
// Type correctness – every value must be a number
// ---------------------------------------------------------------------------

describe('DEFAULT_THRESHOLDS value types', () => {
  it('every threshold value is a number', () => {
    for (const [key, value] of Object.entries(DEFAULT_THRESHOLDS)) {
      expect(typeof value, `${key} should be a number`).toBe('number');
    }
  });
});

// ---------------------------------------------------------------------------
// Specific default values
// ---------------------------------------------------------------------------

describe('DEFAULT_THRESHOLDS specific values', () => {
  it('wipAgingDays is 14', () => {
    expect(DEFAULT_THRESHOLDS.wipAgingDays).toBe(14);
  });

  it('salesHealthThreshold is 80', () => {
    expect(DEFAULT_THRESHOLDS.salesHealthThreshold).toBe(80);
  });

  it('operationsHealthThreshold is 60', () => {
    expect(DEFAULT_THRESHOLDS.operationsHealthThreshold).toBe(60);
  });

  it('ontimeGoodThreshold is 80', () => {
    expect(DEFAULT_THRESHOLDS.ontimeGoodThreshold).toBe(80);
  });

  it('ontimeWarningThreshold is 60', () => {
    expect(DEFAULT_THRESHOLDS.ontimeWarningThreshold).toBe(60);
  });

  it('concentrationHighThreshold is 70', () => {
    expect(DEFAULT_THRESHOLDS.concentrationHighThreshold).toBe(70);
  });

  it('concentrationMediumThreshold is 50', () => {
    expect(DEFAULT_THRESHOLDS.concentrationMediumThreshold).toBe(50);
  });

  it('backlogWarningMonths is 6', () => {
    expect(DEFAULT_THRESHOLDS.backlogWarningMonths).toBe(6);
  });

  it('notScheduledWarningDays is 14', () => {
    expect(DEFAULT_THRESHOLDS.notScheduledWarningDays).toBe(14);
  });

  it('lowInvoiceWarningPercent is 80', () => {
    expect(DEFAULT_THRESHOLDS.lowInvoiceWarningPercent).toBe(80);
  });

  it('signageMinProjectValue is 10000', () => {
    expect(DEFAULT_THRESHOLDS.signageMinProjectValue).toBe(10_000);
  });

  it('signageUpcomingDays is 30', () => {
    expect(DEFAULT_THRESHOLDS.signageUpcomingDays).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// Positivity – all threshold values must be > 0
// ---------------------------------------------------------------------------

describe('DEFAULT_THRESHOLDS positivity', () => {
  it('all threshold values are positive numbers', () => {
    for (const [key, value] of Object.entries(DEFAULT_THRESHOLDS)) {
      expect(value, `${key} must be > 0`).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Logical relationships between related thresholds
// ---------------------------------------------------------------------------

describe('DEFAULT_THRESHOLDS logical relationships', () => {
  it('ontimeGoodThreshold is greater than ontimeWarningThreshold', () => {
    expect(DEFAULT_THRESHOLDS.ontimeGoodThreshold).toBeGreaterThan(
      DEFAULT_THRESHOLDS.ontimeWarningThreshold
    );
  });

  it('concentrationHighThreshold is greater than concentrationMediumThreshold', () => {
    expect(DEFAULT_THRESHOLDS.concentrationHighThreshold).toBeGreaterThan(
      DEFAULT_THRESHOLDS.concentrationMediumThreshold
    );
  });

  it('salesHealthThreshold is greater than or equal to operationsHealthThreshold', () => {
    expect(DEFAULT_THRESHOLDS.salesHealthThreshold).toBeGreaterThanOrEqual(
      DEFAULT_THRESHOLDS.operationsHealthThreshold
    );
  });

  it('signageMinProjectValue is meaningfully large (above 1000)', () => {
    expect(DEFAULT_THRESHOLDS.signageMinProjectValue).toBeGreaterThan(1_000);
  });

  it('signageUpcomingDays is greater than notScheduledWarningDays', () => {
    expect(DEFAULT_THRESHOLDS.signageUpcomingDays).toBeGreaterThan(
      DEFAULT_THRESHOLDS.notScheduledWarningDays
    );
  });
});
