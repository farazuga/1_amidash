/**
 * Shared formatting utilities for slide rendering.
 * These functions standardize number and text formatting across all slides.
 */

/**
 * Format a number as currency with K/M suffix.
 * Examples: 1500 -> "$2K", 1500000 -> "$1.50M", 500 -> "$500"
 */
export function formatCurrency(value: number, decimalsForMillions = 2): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(decimalsForMillions)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
}

/**
 * Format a number with K/M suffix (no currency symbol).
 * Examples: 1500 -> "2K", 1500000 -> "1.5M", 500 -> "500"
 */
export function formatNumber(value: number, decimalsForMillions = 1): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(decimalsForMillions)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toLocaleString();
}

/**
 * Truncate text to a maximum length, adding ellipsis if truncated.
 * Example: truncateText("Hello World", 8) -> "Hello..."
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format a percentage value.
 * Examples: 0.85 -> "85%", 85 -> "85%" (auto-detects if value is decimal or already percentage)
 */
export function formatPercent(value: number, decimals = 0): string {
  const normalized = value > 1 ? value : value * 100;
  return `${normalized.toFixed(decimals)}%`;
}

/**
 * Format a date as a short readable string.
 * Example: new Date() -> "Jan 15, 2024"
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Format days remaining or overdue.
 * Examples: 5 -> "5 days left", -3 -> "3 days overdue", 0 -> "Due today"
 */
export function formatDaysRemaining(days: number): string {
  if (days === 0) return 'Due today';
  if (days === 1) return '1 day left';
  if (days === -1) return '1 day overdue';
  if (days > 0) return `${days} days left`;
  return `${Math.abs(days)} days overdue`;
}
