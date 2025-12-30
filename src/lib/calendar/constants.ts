import type { BookingStatus } from '@/types/calendar';

// Booking status display configuration
export const BOOKING_STATUS_CONFIG: Record<
  BookingStatus,
  {
    label: string;
    shortLabel: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
    dotColor: string;
    description: string;
    visibleToEngineers: boolean;
  }
> = {
  draft: {
    label: 'Draft',
    shortLabel: 'D',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-300',
    dotColor: 'bg-blue-500',
    description: 'PM planning - not visible to engineers',
    visibleToEngineers: false,
  },
  tentative: {
    label: 'Tentative',
    shortLabel: 'T',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-800',
    borderColor: 'border-amber-300',
    dotColor: 'bg-amber-500',
    description: 'Planned but not yet sent to customer',
    visibleToEngineers: true,
  },
  pending_confirm: {
    label: 'Pending Confirmation',
    shortLabel: 'PC',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-800',
    borderColor: 'border-purple-300',
    dotColor: 'bg-purple-500',
    description: 'Awaiting customer confirmation',
    visibleToEngineers: true,
  },
  confirmed: {
    label: 'Confirmed',
    shortLabel: 'C',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    borderColor: 'border-green-300',
    dotColor: 'bg-green-500',
    description: 'Customer confirmed',
    visibleToEngineers: true,
  },
};

// Default working hours (7am - 4pm)
export const DEFAULT_WORKING_HOURS = {
  start: '07:00',
  end: '16:00',
} as const;

// Days of the week (weekdays only - no weekends)
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;
export const WEEKDAYS_FULL = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
] as const;

// Full week including weekends (for legacy support if needed)
export const WEEKDAYS_WITH_WEEKENDS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAYS_FULL_WITH_WEEKENDS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

// Month names
export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

// Booking status order for sorting (most important first)
export const BOOKING_STATUS_ORDER: BookingStatus[] = [
  'confirmed',
  'pending_confirm',
  'tentative',
  'draft',
];

// Status cycle for manual PM cycling (skips pending_confirm - requires confirmation flow)
export const BOOKING_STATUS_CYCLE: BookingStatus[] = [
  'draft',
  'tentative',
  'confirmed',
];
