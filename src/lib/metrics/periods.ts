import {
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
} from 'date-fns';
import type { PeriodParams, DateRange } from './types';

/**
 * Return the date range (start, end) for the given period parameters.
 */
export function getDateRange(params: PeriodParams): DateRange {
  const { periodType, selectedYear, selectedMonth, selectedQuarter } = params;
  const now = new Date();

  if (periodType === 'month') {
    const date = new Date(selectedYear, selectedMonth - 1, 1);
    return { start: startOfMonth(date), end: endOfMonth(date) };
  }

  if (periodType === 'quarter') {
    const quarterMonth = (selectedQuarter - 1) * 3;
    const date = new Date(selectedYear, quarterMonth, 1);
    return { start: startOfQuarter(date), end: endOfQuarter(date) };
  }

  if (periodType === 'ytd') {
    return { start: startOfYear(new Date(selectedYear, 0, 1)), end: now };
  }

  // 'last12' (or any other)
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  return { start: startOfMonth(start), end: now };
}

/**
 * Return the date range for the period immediately before the given one.
 * Used for comparison / trend indicators.
 */
export function getPreviousPeriod(params: PeriodParams): DateRange {
  const { periodType, selectedYear, selectedMonth, selectedQuarter } = params;

  if (periodType === 'month') {
    const prevDate = new Date(selectedYear, selectedMonth - 2, 1);
    return { start: startOfMonth(prevDate), end: endOfMonth(prevDate) };
  }

  if (periodType === 'quarter') {
    const prevQuarter = selectedQuarter === 1 ? 4 : selectedQuarter - 1;
    const prevYear = selectedQuarter === 1 ? selectedYear - 1 : selectedYear;
    const prevMonth = (prevQuarter - 1) * 3;
    const prevDate = new Date(prevYear, prevMonth, 1);
    return { start: startOfQuarter(prevDate), end: endOfQuarter(prevDate) };
  }

  if (periodType === 'ytd') {
    const now = new Date();
    const endMonth = selectedYear === now.getFullYear() ? now.getMonth() + 1 : 12;
    const prevYearStart = startOfYear(new Date(selectedYear - 1, 0, 1));
    const prevYearEnd = new Date(
      selectedYear - 1,
      endMonth - 1,
      new Date(selectedYear - 1, endMonth, 0).getDate(),
    );
    return { start: prevYearStart, end: prevYearEnd };
  }

  // 'last12' → previous 12 months (12-24 months ago)
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 23, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - 12, 0);
  return { start: startOfMonth(start), end };
}
