import { z } from 'zod';

// Reusable email schema
export const emailSchema = z.string().email('Invalid email address');

// Role enum validation
export const roleSchema = z.enum(['admin', 'editor', 'viewer', 'customer']);

// Status change email request schema
export const statusChangeEmailSchema = z.object({
  to: emailSchema,
  clientName: z.string().min(1, 'Client name required'),
  newStatus: z.string().min(1, 'Status required'),
  previousStatus: z.string().optional(),
  clientToken: z.string().optional(),
  note: z.string().optional(),
  projectId: z.string().optional(), // For checking project email settings
});

// Welcome email request schema
export const welcomeEmailSchema = z.object({
  to: emailSchema,
  clientName: z.string().min(1, 'Client name required'),
  pocName: z.string().min(1, 'POC name required'),
  projectType: z.string().optional(),
  initialStatus: z.string().optional(),
  clientToken: z.string().min(1, 'Client token required'),
});

// ============================================
// Calendar & Booking Validation
// ============================================

// Booking status enum validation (4 statuses: draft -> tentative -> pending_confirm -> confirmed)
export const bookingStatusSchema = z.enum([
  'draft',
  'tentative',
  'pending_confirm',
  'confirmed',
]);

// Availability type enum validation
export const availabilityTypeSchema = z.enum([
  'unavailable',
  'limited',
  'training',
  'pto',
  'sick',
]);

// Calendar feed type enum validation
export const calendarFeedTypeSchema = z.enum(['master', 'personal', 'project']);

// Date validation (YYYY-MM-DD format)
export const dateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Date must be in YYYY-MM-DD format'
);

// Time validation (HH:MM or HH:MM:SS format)
export const timeSchema = z.string().regex(
  /^\d{2}:\d{2}(:\d{2})?$/,
  'Time must be in HH:MM or HH:MM:SS format'
);

// Assignment day validation
export const assignmentDaySchema = z.object({
  date: dateSchema,
  startTime: timeSchema.default('07:00'),
  endTime: timeSchema.default('16:00'),
}).refine(
  (data) => data.endTime > data.startTime,
  { message: 'End time must be after start time' }
);

// ============================================
// Confirmation Request Validation
// ============================================

// Create confirmation request schema
export const createConfirmationRequestSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  assignmentIds: z.array(z.string().uuid()).min(1, 'At least one assignment required'),
  sendToEmail: emailSchema,
  sendToName: z.string().optional(),
});

// Confirmation response schema (customer action)
export const confirmationResponseSchema = z.object({
  token: z.string().min(1, 'Token required'),
  action: z.enum(['confirm', 'decline']),
  declineReason: z.string().optional(),
});

// Confirmation request status
export const confirmationRequestStatusSchema = z.enum([
  'pending',
  'confirmed',
  'declined',
  'expired',
]);

// ============================================
// Bulk Operations Validation
// ============================================

// Bulk status update schema
export const bulkStatusUpdateSchema = z.object({
  assignmentIds: z.array(z.string().uuid()).min(1, 'At least one assignment required'),
  newStatus: bookingStatusSchema,
  note: z.string().optional(),
});

// ============================================
// Type exports for convenience
// ============================================

export type StatusChangeEmailInput = z.infer<typeof statusChangeEmailSchema>;
export type WelcomeEmailInput = z.infer<typeof welcomeEmailSchema>;
export type Role = z.infer<typeof roleSchema>;
export type BookingStatusInput = z.infer<typeof bookingStatusSchema>;
export type AvailabilityTypeInput = z.infer<typeof availabilityTypeSchema>;
export type CreateConfirmationRequestInput = z.infer<typeof createConfirmationRequestSchema>;
export type ConfirmationResponseInput = z.infer<typeof confirmationResponseSchema>;
export type BulkStatusUpdateInput = z.infer<typeof bulkStatusUpdateSchema>;
