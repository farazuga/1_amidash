/**
 * Color palette for signage rendering
 * Based on Amidash brand colors
 */

export const colors = {
  // Brand colors
  primary: '#023A2D',      // Amidash green
  secondary: '#1a1a2e',    // Dark background
  accent: '#4ade80',       // Bright green accent

  // Background variations
  background: '#1a1a2e',
  backgroundLight: '#2a2a3e',
  backgroundDark: '#0a0a1e',

  // Text colors
  textPrimary: '#ffffff',
  textSecondary: '#a0a0b0',
  textMuted: '#6b7280',

  // Status colors
  statusGreen: '#22c55e',
  statusYellow: '#eab308',
  statusOrange: '#f97316',
  statusRed: '#ef4444',
  statusBlue: '#3b82f6',
  statusPurple: '#a855f7',

  // Booking status colors (for schedule)
  pencil: '#fbbf24',         // Yellow/amber for tentative
  pendingConfirm: '#60a5fa', // Blue for pending
  confirmed: '#34d399',      // Green for confirmed

  // Chart colors
  chartBar: '#4ade80',
  chartBarSecondary: '#22c55e',
  chartGoal: '#60a5fa',
  chartBackground: '#374151',

  // Borders and dividers
  border: '#374151',
  borderLight: '#4b5563',

  // Stale indicator
  staleWarning: '#fbbf24',
  staleError: '#ef4444',
};

/**
 * Get booking status color
 */
export function getBookingStatusColor(status: 'pencil' | 'pending_confirm' | 'confirmed'): string {
  switch (status) {
    case 'pencil':
      return colors.pencil;
    case 'pending_confirm':
      return colors.pendingConfirm;
    case 'confirmed':
      return colors.confirmed;
    default:
      return colors.textMuted;
  }
}

/**
 * Get status color based on name (common status names)
 */
export function getStatusColor(statusName: string): string {
  const name = statusName.toLowerCase();

  if (name.includes('complete') || name.includes('done') || name.includes('invoiced')) {
    return colors.statusGreen;
  }
  if (name.includes('progress') || name.includes('active') || name.includes('working')) {
    return colors.statusBlue;
  }
  if (name.includes('review') || name.includes('pending') || name.includes('waiting')) {
    return colors.statusYellow;
  }
  if (name.includes('hold') || name.includes('blocked') || name.includes('paused')) {
    return colors.statusOrange;
  }
  if (name.includes('cancel') || name.includes('overdue') || name.includes('fail')) {
    return colors.statusRed;
  }
  if (name.includes('new') || name.includes('draft') || name.includes('start')) {
    return colors.statusPurple;
  }

  return colors.textSecondary;
}

/**
 * Convert hex color to RGBA
 */
export function hexToRgba(hex: string, alpha: number = 1): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(255, 255, 255, ${alpha})`;

  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Lighten a hex color
 */
export function lightenColor(hex: string, percent: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;

  let r = parseInt(result[1], 16);
  let g = parseInt(result[2], 16);
  let b = parseInt(result[3], 16);

  r = Math.min(255, Math.round(r + (255 - r) * (percent / 100)));
  g = Math.min(255, Math.round(g + (255 - g) * (percent / 100)));
  b = Math.min(255, Math.round(b + (255 - b) * (percent / 100)));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Darken a hex color
 */
export function darkenColor(hex: string, percent: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;

  let r = parseInt(result[1], 16);
  let g = parseInt(result[2], 16);
  let b = parseInt(result[3], 16);

  r = Math.max(0, Math.round(r * (1 - percent / 100)));
  g = Math.max(0, Math.round(g * (1 - percent / 100)));
  b = Math.max(0, Math.round(b * (1 - percent / 100)));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
