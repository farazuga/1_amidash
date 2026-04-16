import { z } from 'zod';

// Base schemas
const uuidSchema = z.string().uuid('Invalid ID format');
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)');

// ============================================
// Rate Schemas
// ============================================

export const updateRatesSchema = z.object({
  in_state_rate: z.number().min(0, 'Rate must be non-negative'),
  out_of_state_rate: z.number().min(0, 'Rate must be non-negative'),
});

// ============================================
// Deposit Schemas
// ============================================

export const createDepositsSchema = z.object({
  deposits: z.array(z.object({
    user_id: uuidSchema,
    amount: z.number().positive('Amount must be positive'),
    note: z.string().max(500, 'Note too long').optional(),
  })).min(1, 'At least one deposit is required'),
});

export const updateDepositSchema = z.object({
  id: uuidSchema,
  amount: z.number().positive('Amount must be positive').optional(),
  note: z.string().max(500, 'Note too long').nullable().optional(),
});

// ============================================
// Entry Schemas
// ============================================

export const createEntrySchema = z.object({
  user_id: uuidSchema,
  project_id: uuidSchema.nullable(),
  project_other_note: z.string().max(500, 'Note too long').nullable().optional(),
  start_date: dateSchema,
  end_date: dateSchema,
  nights: z.number().int().positive('Nights must be a positive integer'),
  nights_overridden: z.boolean(),
  location_type: z.enum(['in_state', 'out_of_state']),
  rate: z.number().min(0, 'Rate must be non-negative'),
  total: z.number().min(0, 'Total must be non-negative'),
}).refine(
  (data) => data.project_id !== null || (data.project_other_note !== null && data.project_other_note !== undefined && data.project_other_note.trim().length > 0),
  { message: 'Either a project must be selected or a project note must be provided', path: ['project_id'] }
);

export const updateEntrySchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema.optional(),
  project_id: uuidSchema.nullable().optional(),
  project_other_note: z.string().max(500, 'Note too long').nullable().optional(),
  start_date: dateSchema.optional(),
  end_date: dateSchema.optional(),
  nights: z.number().int().positive('Nights must be a positive integer').optional(),
  nights_overridden: z.boolean().optional(),
  location_type: z.enum(['in_state', 'out_of_state']).optional(),
  rate: z.number().min(0, 'Rate must be non-negative').optional(),
  total: z.number().min(0, 'Total must be non-negative').optional(),
});

// ============================================
// Approval Schemas
// ============================================

export const approveEntriesSchema = z.object({
  entry_ids: z.array(uuidSchema).min(1, 'At least one entry is required'),
});

// ============================================
// Helper function to validate and parse
// ============================================

export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return {
      success: false,
      error: firstIssue?.message || 'Validation failed',
    };
  }
  return { success: true, data: result.data };
}
