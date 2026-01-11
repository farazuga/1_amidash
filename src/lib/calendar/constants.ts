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
    ringColor: string;
    glowColor?: string;
    pulse?: boolean;
    description: string;
    visibleToEngineers: boolean;
  }
> = {
  draft: {
    label: 'Draft',
    shortLabel: 'D',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-200',
    dotColor: 'bg-blue-500',
    ringColor: 'ring-blue-200',
    description: 'PM planning - not visible to engineers',
    visibleToEngineers: false,
  },
  tentative: {
    label: 'Tentative',
    shortLabel: 'T',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-800',
    borderColor: 'border-amber-200',
    dotColor: 'bg-amber-500',
    ringColor: 'ring-amber-200',
    glowColor: 'shadow-amber-200/50',
    description: 'Planned but not yet sent to customer',
    visibleToEngineers: true,
  },
  pending_confirm: {
    label: 'Pending',
    shortLabel: 'PC',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-800',
    borderColor: 'border-purple-200',
    dotColor: 'bg-purple-500',
    ringColor: 'ring-purple-200',
    glowColor: 'shadow-purple-200/50',
    pulse: true,
    description: 'Awaiting customer confirmation',
    visibleToEngineers: true,
  },
  confirmed: {
    label: 'Confirmed',
    shortLabel: 'C',
    bgColor: 'bg-green-50',
    textColor: 'text-green-800',
    borderColor: 'border-green-200',
    dotColor: 'bg-green-500',
    ringColor: 'ring-green-200',
    glowColor: 'shadow-green-200/50',
    description: 'Customer confirmed',
    visibleToEngineers: true,
  },
};

// Default working hours (8:30am - 4:30pm)
export const DEFAULT_WORKING_HOURS = {
  start: '08:30',
  end: '16:30',
} as const;

// Default working hours with seconds (for database storage)
export const DEFAULT_WORK_TIMES = {
  startTime: '08:30:00',
  endTime: '16:30:00',
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
