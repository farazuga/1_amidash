export const colors = {
  // Amitrace Official Brand Colors (from Brand Guide)
  primary: '#053B2C',        // Main Dark Green
  primaryLight: '#C2E0AD',   // Main Light Green
  primaryDark: '#032218',    // Darker green for contrast
  primaryGlow: '#C2E0AD',    // Light green for glows

  // Secondary brand colors
  mauve: '#C67CA8',          // Mauve/Pink accent
  coral: '#DE3829',          // Red/Coral accent
  amber: '#F59F43',          // Orange/Amber accent

  // Accent colors (derived from brand palette)
  accent: '#C67CA8',         // Mauve for variety
  accentAlt: '#F59F43',      // Amber accent

  // Status colors - using brand palette
  success: '#C2E0AD',        // Light green for success
  warning: '#F59F43',        // Amber for warning
  error: '#DE3829',          // Coral for errors
  info: '#C67CA8',           // Mauve for info

  // Neutral
  white: '#ffffff',
  black: '#000000',
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    950: '#0a0a0f',
  },

  // Background - using brand dark green for cohesive look
  background: '#053B2C',        // Main Dark Green as background
  backgroundAlt: '#042a20',     // Slightly darker for depth
  cardBackground: 'rgba(255, 255, 255, 0.12)',      // More visible cards
  cardBackgroundHover: 'rgba(255, 255, 255, 0.18)',
  overlayBackground: 'rgba(0, 0, 0, 0.7)',

  // Gradients (as CSS strings)
  gradientPrimary: 'linear-gradient(135deg, #053B2C, #C2E0AD)',
  gradientDark: 'linear-gradient(180deg, #111118 0%, #0a0a0f 100%)',
};

export function hexToRgba(hex: string, alpha: number = 1): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}
