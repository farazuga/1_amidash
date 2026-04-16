import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { PerDiemLocationType } from '@/types/per-diem';

/**
 * Determine location type from a project's delivery_state.
 * Georgia (any form: "GA", "Georgia", "ga") = in_state.
 * No state = defaults to in_state.
 * Anything else = out_of_state.
 */
export function getLocationType(deliveryState: string | null | undefined): PerDiemLocationType {
  if (!deliveryState) return 'in_state';
  const normalized = deliveryState.trim().toLowerCase();
  if (normalized === 'ga' || normalized === 'georgia') return 'in_state';
  return 'out_of_state';
}

/**
 * Calculate nights from start and end dates.
 * End date is excluded (e.g., Apr 1 to Apr 4 = 3 nights).
 */
export function calculateNights(startDate: string, endDate: string): number {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const diff = differenceInCalendarDays(end, start);
  return Math.max(0, diff);
}

/**
 * Calculate total from nights and rate.
 */
export function calculateTotal(nights: number, rate: number): number {
  return Number((nights * rate).toFixed(2));
}

/**
 * Format currency for display.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}
