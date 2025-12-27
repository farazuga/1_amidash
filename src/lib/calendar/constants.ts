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
  }
> = {
  pencil: {
    label: 'Pencil',
    shortLabel: 'P',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-800',
    borderColor: 'border-amber-300',
    dotColor: 'bg-amber-500',
  },
  pending_confirm: {
    label: 'Pending Confirm',
    shortLabel: 'PC',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-300',
    dotColor: 'bg-blue-500',
  },
  confirmed: {
    label: 'Confirmed',
    shortLabel: 'C',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    borderColor: 'border-green-300',
    dotColor: 'bg-green-500',
  },
};

// Days of the week
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAYS_FULL = [
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

// Booking status order for sorting
export const BOOKING_STATUS_ORDER: BookingStatus[] = [
  'confirmed',
  'pending_confirm',
  'pencil',
];
