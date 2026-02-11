/**
 * Shared formatting utilities for slide rendering.
 * These functions standardize number and text formatting across all slides.
 */
/**
 * Format a number as currency with K/M suffix.
 * Examples: 1500 -> "$2K", 1500000 -> "$1.50M", 500 -> "$500"
 */
export declare function formatCurrency(value: number, decimalsForMillions?: number): string;
/**
 * Format a number with K/M suffix (no currency symbol).
 * Examples: 1500 -> "2K", 1500000 -> "1.5M", 500 -> "500"
 */
export declare function formatNumber(value: number, decimalsForMillions?: number): string;
/**
 * Truncate text to a maximum length, adding ellipsis if truncated.
 * Example: truncateText("Hello World", 8) -> "Hello..."
 */
export declare function truncateText(text: string, maxLength: number): string;
/**
 * Format a percentage value.
 * Examples: 0.85 -> "85%", 85 -> "85%" (auto-detects if value is decimal or already percentage)
 */
export declare function formatPercent(value: number, decimals?: number): string;
/**
 * Format a date as a short readable string.
 * Example: new Date() -> "Jan 15, 2024"
 */
export declare function formatDate(date: Date | string): string;
/**
 * Format days remaining or overdue.
 * Examples: 5 -> "5 days left", -3 -> "3 days overdue", 0 -> "Due today"
 */
export declare function formatDaysRemaining(days: number): string;
