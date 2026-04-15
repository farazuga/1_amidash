import { describe, it, expect } from 'vitest';
import { getLocationType, calculateNights, calculateTotal, formatCurrency } from '../utils';

describe('getLocationType', () => {
  it('returns in_state for GA', () => expect(getLocationType('GA')).toBe('in_state'));
  it('returns in_state for Georgia', () => expect(getLocationType('Georgia')).toBe('in_state'));
  it('returns in_state for ga (lowercase)', () => expect(getLocationType('ga')).toBe('in_state'));
  it('returns in_state for null', () => expect(getLocationType(null)).toBe('in_state'));
  it('returns in_state for undefined', () => expect(getLocationType(undefined)).toBe('in_state'));
  it('returns in_state for empty string', () => expect(getLocationType('')).toBe('in_state'));
  it('returns out_of_state for FL', () => expect(getLocationType('FL')).toBe('out_of_state'));
  it('returns out_of_state for California', () => expect(getLocationType('California')).toBe('out_of_state'));
  it('handles whitespace', () => expect(getLocationType(' GA ')).toBe('in_state'));
});

describe('calculateNights', () => {
  it('calculates 3 nights for Apr 1-4', () => expect(calculateNights('2026-04-01', '2026-04-04')).toBe(3));
  it('calculates 1 night for same consecutive days', () => expect(calculateNights('2026-04-01', '2026-04-02')).toBe(1));
  it('returns 0 for same day', () => expect(calculateNights('2026-04-01', '2026-04-01')).toBe(0));
  it('returns 0 if end before start', () => expect(calculateNights('2026-04-05', '2026-04-01')).toBe(0));
  it('handles month boundary', () => expect(calculateNights('2026-03-30', '2026-04-02')).toBe(3));
});

describe('calculateTotal', () => {
  it('multiplies nights by rate', () => expect(calculateTotal(3, 50)).toBe(150));
  it('handles decimal rates', () => expect(calculateTotal(2, 75.50)).toBe(151));
  it('returns 0 for 0 nights', () => expect(calculateTotal(0, 50)).toBe(0));
});

describe('formatCurrency', () => {
  it('formats as USD', () => expect(formatCurrency(1500)).toBe('$1,500.00'));
  it('formats decimals', () => expect(formatCurrency(75.5)).toBe('$75.50'));
  it('formats zero', () => expect(formatCurrency(0)).toBe('$0.00'));
});
