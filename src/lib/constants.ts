export const APP_NAME = 'Amitrace';

export const LOGO_URL = 'https://www.amitrace.com/wp-content/uploads/2022/04/amitrace-logo.png';

export const BRAND_COLORS = {
  primary: '#023A2D',
  primaryLight: '#035544',
  primaryDark: '#012219',
  white: '#FFFFFF',
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
} as const;

export const CONTRACT_TYPES = [
  'None',
  'South Carolina Purchasing',
  'TIPs Contract',
  'State of Georgia Purchasing Agreement',
] as const;

export const DEFAULT_STATUSES = [
  { name: 'PO Received', display_order: 1, require_note: false },
  { name: 'Engineering Review', display_order: 2, require_note: false },
  { name: 'In Procurement', display_order: 3, require_note: false },
  { name: 'Pending Scheduling', display_order: 4, require_note: false },
  { name: 'Scheduled', display_order: 5, require_note: false },
  { name: 'IP', display_order: 6, require_note: false },
  { name: 'Hold', display_order: 7, require_note: true },
  { name: 'Invoiced', display_order: 8, require_note: false },
] as const;

export const USER_ROLES = ['viewer', 'editor', 'admin'] as const;

export const EXPECTED_UPDATE_DAYS_BEFORE = 7; // Days before goal completion date
