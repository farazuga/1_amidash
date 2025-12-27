import { z } from 'zod';

// Base schemas
const uuidSchema = z.string().uuid('Invalid ID format');
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)');
const timeSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Invalid time format (HH:MM or HH:MM:SS)');

// Booking status enum
export const bookingStatusSchema = z.enum(['pencil', 'pending_confirm', 'confirmed']);

// Availability type enum
export const availabilityTypeSchema = z.enum(['unavailable', 'limited', 'training', 'pto', 'sick']);

// Calendar feed type enum
export const calendarFeedTypeSchema = z.enum(['master', 'personal', 'project']);

// ============================================
// Assignment Schemas
// ============================================

export const createAssignmentSchema = z.object({
  projectId: uuidSchema,
  userId: uuidSchema,
  bookingStatus: bookingStatusSchema.optional().default('pencil'),
  notes: z.string().max(1000, 'Notes too long').optional(),
});

export const updateAssignmentStatusSchema = z.object({
  assignmentId: uuidSchema,
  newStatus: bookingStatusSchema,
  note: z.string().max(500, 'Note too long').optional(),
});

export const addExcludedDatesSchema = z.object({
  assignmentId: uuidSchema,
  dates: z.array(dateSchema).min(1, 'At least one date required').max(366, 'Too many dates'),
  reason: z.string().max(500, 'Reason too long').optional(),
});

export const addAssignmentDaysSchema = z.object({
  assignmentId: uuidSchema,
  days: z.array(z.object({
    date: dateSchema,
    startTime: timeSchema,
    endTime: timeSchema,
  })).min(1, 'At least one day required').max(366, 'Too many days'),
});

export const updateAssignmentDaySchema = z.object({
  dayId: uuidSchema,
  startTime: timeSchema,
  endTime: timeSchema,
});

export const removeAssignmentDaysSchema = z.array(uuidSchema).min(1, 'At least one day ID required');

// ============================================
// Project Schemas
// ============================================

export const updateProjectDatesSchema = z.object({
  projectId: uuidSchema,
  startDate: dateSchema.nullable(),
  endDate: dateSchema.nullable(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  { message: 'Start date must be before or equal to end date' }
);

// ============================================
// Conflict Schemas
// ============================================

export const checkConflictsSchema = z.object({
  userId: uuidSchema,
  startDate: dateSchema,
  endDate: dateSchema,
  excludeAssignmentId: uuidSchema.optional(),
}).refine(
  (data) => new Date(data.startDate) <= new Date(data.endDate),
  { message: 'Start date must be before or equal to end date' }
);

export const overrideConflictSchema = z.object({
  conflictId: uuidSchema,
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason too long'),
});

// ============================================
// Calendar Data Schemas
// ============================================

export const calendarDataSchema = z.object({
  startDate: dateSchema,
  endDate: dateSchema,
  projectId: uuidSchema.optional(),
  userId: uuidSchema.optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
}).refine(
  (data) => new Date(data.startDate) <= new Date(data.endDate),
  { message: 'Start date must be before or equal to end date' }
);

export const ganttDataSchema = z.object({
  startDate: dateSchema,
  endDate: dateSchema,
  userId: uuidSchema.optional(),
}).refine(
  (data) => new Date(data.startDate) <= new Date(data.endDate),
  { message: 'Start date must be before or equal to end date' }
);

// ============================================
// Subscription Schemas
// ============================================

export const createSubscriptionSchema = z.object({
  feedType: calendarFeedTypeSchema,
  projectId: uuidSchema.optional(),
}).refine(
  (data) => data.feedType !== 'project' || !!data.projectId,
  { message: 'Project ID is required for project feeds' }
);

// ============================================
// Availability Schemas
// ============================================

export const createAvailabilitySchema = z.object({
  userId: uuidSchema,
  startDate: dateSchema,
  endDate: dateSchema,
  availabilityType: availabilityTypeSchema,
  reason: z.string().max(500, 'Reason too long').optional(),
}).refine(
  (data) => new Date(data.startDate) <= new Date(data.endDate),
  { message: 'Start date must be before or equal to end date' }
);

export const updateAvailabilitySchema = z.object({
  id: uuidSchema,
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  availabilityType: availabilityTypeSchema.optional(),
  reason: z.string().max(500, 'Reason too long').optional(),
});

export const userAvailabilityRangeSchema = z.object({
  userId: uuidSchema,
  startDate: dateSchema,
  endDate: dateSchema,
}).refine(
  (data) => new Date(data.startDate) <= new Date(data.endDate),
  { message: 'Start date must be before or equal to end date' }
);

export const teamAvailabilitySchema = z.object({
  startDate: dateSchema,
  endDate: dateSchema,
  userIds: z.array(uuidSchema).optional(),
}).refine(
  (data) => new Date(data.startDate) <= new Date(data.endDate),
  { message: 'Start date must be before or equal to end date' }
);

// ============================================
// Helper function to validate and parse
// ============================================

export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    // Return first error message
    const firstIssue = result.error.issues[0];
    return {
      success: false,
      error: firstIssue?.message || 'Validation failed',
    };
  }
  return { success: true, data: result.data };
}
