import { describe, it, expect } from 'vitest';
import { getDateRange, getPreviousPeriod } from '../periods';
import type { PeriodParams } from '../types';

function makeParams(overrides: Partial<PeriodParams> = {}): PeriodParams {
  return {
    periodType: 'month',
    selectedYear: 2026,
    selectedMonth: 3,
    selectedQuarter: 1,
    ...overrides,
  };
}

describe('getDateRange', () => {
  it('month: returns first to last day', () => {
    const range = getDateRange(makeParams({ periodType: 'month', selectedMonth: 3 }));
    expect(range.start).toEqual(new Date(2026, 2, 1));
    expect(range.end.getFullYear()).toBe(2026);
    expect(range.end.getMonth()).toBe(2);
    expect(range.end.getDate()).toBe(31);
  });

  it('month: handles February', () => {
    const range = getDateRange(makeParams({ periodType: 'month', selectedMonth: 2 }));
    expect(range.start).toEqual(new Date(2026, 1, 1));
    expect(range.end.getDate()).toBe(28);
  });

  it('quarter: Q1 = Jan 1 to Mar 31', () => {
    const range = getDateRange(makeParams({ periodType: 'quarter', selectedQuarter: 1 }));
    expect(range.start.getMonth()).toBe(0);
    expect(range.end.getMonth()).toBe(2);
    expect(range.end.getDate()).toBe(31);
  });

  it('quarter: Q2 = Apr 1 to Jun 30', () => {
    const range = getDateRange(makeParams({ periodType: 'quarter', selectedQuarter: 2 }));
    expect(range.start.getMonth()).toBe(3);
    expect(range.end.getMonth()).toBe(5);
    expect(range.end.getDate()).toBe(30);
  });

  it('quarter: Q4 = Oct 1 to Dec 31', () => {
    const range = getDateRange(makeParams({ periodType: 'quarter', selectedQuarter: 4 }));
    expect(range.start.getMonth()).toBe(9);
    expect(range.end.getMonth()).toBe(11);
    expect(range.end.getDate()).toBe(31);
  });

  it('ytd: Jan 1 to now', () => {
    const range = getDateRange(makeParams({ periodType: 'ytd', selectedYear: 2026 }));
    expect(range.start.getFullYear()).toBe(2026);
    expect(range.start.getMonth()).toBe(0);
    expect(range.start.getDate()).toBe(1);
    // end is "now" — just verify it's a Date in 2026
    expect(range.end.getFullYear()).toBe(new Date().getFullYear());
  });

  it('last12: 12 month window ending now', () => {
    const range = getDateRange(makeParams({ periodType: 'last12' }));
    // Start should be ~11 months ago
    const now = new Date();
    const expectedStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    expect(range.start.getFullYear()).toBe(expectedStart.getFullYear());
    expect(range.start.getMonth()).toBe(expectedStart.getMonth());
    expect(range.start.getDate()).toBe(1);
  });
});

describe('getPreviousPeriod', () => {
  it('previous month: March → February', () => {
    const prev = getPreviousPeriod(makeParams({ periodType: 'month', selectedMonth: 3 }));
    expect(prev.start.getMonth()).toBe(1); // February
    expect(prev.end.getMonth()).toBe(1);
  });

  it('previous month: January → December of prior year', () => {
    const prev = getPreviousPeriod(makeParams({ periodType: 'month', selectedYear: 2026, selectedMonth: 1 }));
    expect(prev.start.getFullYear()).toBe(2025);
    expect(prev.start.getMonth()).toBe(11); // December
    expect(prev.end.getMonth()).toBe(11);
  });

  it('previous quarter: Q1 → Q4 of prior year', () => {
    const prev = getPreviousPeriod(makeParams({ periodType: 'quarter', selectedYear: 2026, selectedQuarter: 1 }));
    expect(prev.start.getFullYear()).toBe(2025);
    expect(prev.start.getMonth()).toBe(9); // October
    expect(prev.end.getMonth()).toBe(11); // December
  });

  it('previous quarter: Q3 → Q2', () => {
    const prev = getPreviousPeriod(makeParams({ periodType: 'quarter', selectedYear: 2026, selectedQuarter: 3 }));
    expect(prev.start.getMonth()).toBe(3); // April
    expect(prev.end.getMonth()).toBe(5); // June
  });

  it('previous YTD: 2026 → 2025', () => {
    const prev = getPreviousPeriod(makeParams({ periodType: 'ytd', selectedYear: 2026 }));
    expect(prev.start.getFullYear()).toBe(2025);
    expect(prev.start.getMonth()).toBe(0); // January
  });
});
