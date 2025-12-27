import type { Profile, Project } from './index';

// Booking status for project assignments
export type BookingStatus = 'pencil' | 'pending_confirm' | 'confirmed';

// Display labels for booking statuses
export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pencil: 'Pencil',
  pending_confirm: 'Pending Confirm',
  confirmed: 'Confirmed',
};

// Colors for booking statuses (Tailwind classes)
export const BOOKING_STATUS_COLORS: Record<BookingStatus, { bg: string; text: string; border: string }> = {
  pencil: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-300',
  },
  pending_confirm: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-300',
  },
  confirmed: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-300',
  },
};

// Project assignment - user assigned to a project
export interface ProjectAssignment {
  id: string;
  project_id: string;
  user_id: string;
  booking_status: BookingStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  project?: Project;
  user?: Profile;
  excluded_dates?: AssignmentExcludedDate[];
  days?: AssignmentDay[];  // New: per-day time tracking
  created_by_profile?: Profile;
}

// Days excluded from an assignment (legacy - kept for backward compatibility)
export interface AssignmentExcludedDate {
  id: string;
  assignment_id: string;
  excluded_date: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
  // Joined relations
  created_by_profile?: Profile;
}

// Assignment day with start/end times (new model)
export interface AssignmentDay {
  id: string;
  assignment_id: string;
  work_date: string;  // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  end_time: string;   // HH:MM:SS
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  created_by_profile?: Profile;
}

// Block of consecutive days for Gantt display
export interface AssignmentBlock {
  startDate: string;
  endDate: string;
  days: AssignmentDay[];
}

// Gantt-style assignment for display
export interface GanttAssignment {
  id: string;
  assignmentId: string;
  userId: string;
  userName: string;
  projectId: string;
  projectName: string;
  projectStartDate: string | null;
  projectEndDate: string | null;
  bookingStatus: BookingStatus;
  notes: string | null;
  // Consecutive day blocks
  blocks: AssignmentBlock[];
}

// Booking conflict when user is double-booked
export interface BookingConflict {
  id: string;
  user_id: string;
  assignment_id_1: string;
  assignment_id_2: string;
  conflict_date: string;
  override_reason: string | null;
  overridden_by: string | null;
  overridden_at: string | null;
  is_resolved: boolean;
  created_at: string;
  // Joined relations
  user?: Profile;
  assignment1?: ProjectAssignment;
  assignment2?: ProjectAssignment;
  overridden_by_profile?: Profile;
}

// Booking status change history
export interface BookingStatusHistory {
  id: string;
  assignment_id: string;
  old_status: BookingStatus | null;
  new_status: BookingStatus;
  changed_by: string | null;
  note: string | null;
  changed_at: string;
  // Joined relations
  changed_by_profile?: Profile;
  assignment?: ProjectAssignment;
}

// Calendar subscription for iCal feeds
export type CalendarFeedType = 'master' | 'personal' | 'project';

export interface CalendarSubscription {
  id: string;
  user_id: string | null;
  feed_type: CalendarFeedType;
  project_id: string | null;
  token: string;
  created_at: string;
  last_accessed_at: string | null;
  // Joined relations
  user?: Profile;
  project?: Project;
}

// Calendar event for UI display
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  projectId: string;
  projectName: string;
  userId: string;
  userName: string;
  bookingStatus: BookingStatus;
  assignmentId: string;
  excludedDates: string[];
}

// Date range for calendar queries
export interface CalendarViewRange {
  start: Date;
  end: Date;
}

// User's schedule for a specific day
export interface UserScheduleDay {
  date: Date;
  assignments: ProjectAssignment[];
  hasConflict: boolean;
}

// Form data for creating an assignment
export interface CreateAssignmentData {
  projectId: string;
  userId: string;
  bookingStatus?: BookingStatus;
  notes?: string;
}

// Form data for updating assignment status
export interface UpdateAssignmentStatusData {
  assignmentId: string;
  newStatus: BookingStatus;
  note?: string;
}

// Form data for adding excluded dates (legacy)
export interface AddExcludedDatesData {
  assignmentId: string;
  dates: string[];
  reason?: string;
}

// Form data for adding assignment days
export interface AddAssignmentDaysData {
  assignmentId: string;
  days: {
    date: string;
    startTime: string;
    endTime: string;
  }[];
}

// Form data for updating a single assignment day
export interface UpdateAssignmentDayData {
  dayId: string;
  startTime: string;
  endTime: string;
}

// Form data for removing assignment days
export interface RemoveAssignmentDaysData {
  dayIds: string[];
}

// Form data for overriding a conflict
export interface OverrideConflictData {
  conflictId: string;
  reason: string;
}

// Form data for updating project dates
export interface UpdateProjectDatesData {
  projectId: string;
  startDate: string | null;
  endDate: string | null;
}

// Calendar view filters
export interface CalendarFilters {
  projectId?: string;
  userId?: string;
  bookingStatus?: BookingStatus[];
  showExcludedDates?: boolean;
}

// Conflict detection result
export interface ConflictCheckResult {
  hasConflicts: boolean;
  conflicts: {
    projectId: string;
    projectName: string;
    conflictDate: string;
    assignmentId: string;
  }[];
  error?: string;
}

// Result from get_user_schedule database function
export interface UserScheduleResult {
  schedule_date: string;
  project_id: string;
  project_name: string;
  booking_status: BookingStatus;
  assignment_id: string;
}

// Result from get_calendar_assignments database function
export interface CalendarAssignmentResult {
  assignment_id: string;
  project_id: string;
  project_name: string;
  user_id: string;
  user_name: string;
  booking_status: BookingStatus;
  project_start_date: string;
  project_end_date: string;
}

// User availability types
export type AvailabilityType = 'unavailable' | 'limited' | 'training' | 'pto' | 'sick';

export const AVAILABILITY_TYPE_LABELS: Record<AvailabilityType, string> = {
  unavailable: 'Unavailable',
  limited: 'Limited Availability',
  training: 'Training',
  pto: 'PTO',
  sick: 'Sick Leave',
};

export const AVAILABILITY_TYPE_COLORS: Record<AvailabilityType, { bg: string; text: string; border: string }> = {
  unavailable: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-300',
  },
  limited: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    border: 'border-orange-300',
  },
  training: {
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    border: 'border-purple-300',
  },
  pto: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    border: 'border-blue-300',
  },
  sick: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-300',
  },
};

// User availability block
export interface UserAvailability {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  availability_type: AvailabilityType;
  created_at: string;
  created_by: string | null;
  // Joined relations
  user?: Profile;
  created_by_profile?: Profile;
}

// Form data for creating/updating availability
export interface CreateAvailabilityData {
  userId: string;
  startDate: string;
  endDate: string;
  availabilityType: AvailabilityType;
  reason?: string;
}

// Result from check_user_availability function
export interface UserAvailabilityCheck {
  is_available: boolean;
  availability_type: string;
  reason: string | null;
}
