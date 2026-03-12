import { z } from 'zod';

// Base schemas
const uuidSchema = z.string().uuid('Invalid ID format');
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)');

// ============================================
// Team Schemas
// ============================================

export const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100, 'Team name too long'),
  description: z.string().max(500, 'Description too long').optional(),
});

export const updateTeamSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1, 'Team name is required').max(100, 'Team name too long').optional(),
  description: z.string().max(500, 'Description too long').nullable().optional(),
});

export const teamMemberSchema = z.object({
  teamId: uuidSchema,
  userId: uuidSchema,
  role: z.enum(['member', 'facilitator', 'admin']).optional().default('member'),
});

export const updateTeamMemberRoleSchema = z.object({
  teamId: uuidSchema,
  userId: uuidSchema,
  role: z.enum(['member', 'facilitator', 'admin']),
});

// ============================================
// Rock Schemas
// ============================================

const quarterSchema = z.string().regex(/^\d{4}-Q[1-4]$/, 'Invalid quarter format (YYYY-Q#)');

export const createRockSchema = z.object({
  teamId: uuidSchema,
  title: z.string().min(1, 'Title is required').max(500, 'Title too long'),
  description: z.string().max(2000, 'Description too long').optional(),
  ownerId: uuidSchema.optional(),
  quarter: quarterSchema,
  dueDate: dateSchema.optional(),
});

export const updateRockSchema = z.object({
  id: uuidSchema,
  title: z.string().min(1, 'Title is required').max(500, 'Title too long').optional(),
  description: z.string().max(2000, 'Description too long').nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  status: z.enum(['on_track', 'off_track', 'complete', 'dropped']).optional(),
  dueDate: dateSchema.nullable().optional(),
  isArchived: z.boolean().optional(),
});

// ============================================
// Milestone Schemas
// ============================================

export const createMilestoneSchema = z.object({
  rockId: uuidSchema,
  title: z.string().min(1, 'Title is required').max(500, 'Title too long'),
  description: z.string().max(2000, 'Description too long').optional(),
  dueDate: dateSchema.optional(),
  ownerId: uuidSchema.optional(),
});

export const updateMilestoneSchema = z.object({
  id: uuidSchema,
  title: z.string().min(1, 'Title is required').max(500, 'Title too long').optional(),
  description: z.string().max(2000, 'Description too long').nullable().optional(),
  dueDate: dateSchema.nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  isComplete: z.boolean().optional(),
});

// ============================================
// Issue Schemas
// ============================================

export const createIssueSchema = z.object({
  teamId: uuidSchema,
  title: z.string().min(1, 'Title is required').max(500, 'Title too long'),
  description: z.string().max(2000, 'Description too long').optional(),
  sourceType: z.string().max(50).optional(),
  sourceId: uuidSchema.optional(),
  sourceMeta: z.record(z.string(), z.string()).optional(),
});

export const updateIssueSchema = z.object({
  id: uuidSchema,
  title: z.string().min(1, 'Title is required').max(500, 'Title too long').optional(),
  description: z.string().max(2000, 'Description too long').nullable().optional(),
  status: z.enum(['open', 'solving', 'solved', 'combined']).optional(),
  sourceMeta: z.record(z.string(), z.string()).optional(),
});

export const reorderIssuesSchema = z.array(z.object({
  id: uuidSchema,
  priority_rank: z.number().int().min(0),
})).min(1, 'At least one issue required');

export const solveIssueSchema = z.object({
  id: uuidSchema,
  todoTitle: z.string().min(1).max(500).optional(),
  todoOwnerId: uuidSchema.optional(),
});

// ============================================
// Todo Schemas
// ============================================

export const createTodoSchema = z.object({
  teamId: uuidSchema,
  title: z.string().min(1, 'Title is required').max(500, 'Title too long'),
  ownerId: uuidSchema.optional(),
  dueDate: dateSchema.optional(),
  sourceMeetingId: uuidSchema.optional(),
  sourceIssueId: uuidSchema.optional(),
  sourceMilestoneId: uuidSchema.optional(),
});

export const updateTodoSchema = z.object({
  id: uuidSchema,
  title: z.string().min(1, 'Title is required').max(500, 'Title too long').optional(),
  description: z.string().max(2000, 'Description too long').nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  dueDate: dateSchema.nullable().optional(),
  isDone: z.boolean().optional(),
});

// ============================================
// Headline Schemas
// ============================================

export const createHeadlineSchema = z.object({
  teamId: uuidSchema,
  title: z.string().min(1, 'Title is required').max(500, 'Title too long'),
  category: z.enum(['customer', 'employee']).optional(),
  sentiment: z.enum(['good', 'bad', 'neutral']).optional().default('neutral'),
  meetingId: uuidSchema.optional(),
});

// ============================================
// Scorecard Schemas
// ============================================

export const createMeasurableSchema = z.object({
  scorecardId: uuidSchema,
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  ownerId: uuidSchema.optional(),
  unit: z.enum(['number', 'currency', 'percentage']).optional().default('number'),
  goalValue: z.number().optional(),
  goalDirection: z.enum(['above', 'below', 'exact']).optional().default('above'),
  autoSource: z.enum(['po_revenue', 'invoiced_revenue', 'open_projects']).nullable().optional(),
});

export const updateMeasurableSchema = z.object({
  id: uuidSchema,
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  ownerId: uuidSchema.nullable().optional(),
  unit: z.enum(['number', 'currency', 'percentage']).optional(),
  goalValue: z.number().nullable().optional(),
  goalDirection: z.enum(['above', 'below', 'exact']).optional(),
  autoSource: z.enum(['po_revenue', 'invoiced_revenue', 'open_projects']).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const reorderMeasurablesSchema = z.array(z.object({
  id: uuidSchema,
  display_order: z.number().int().min(0),
})).min(1, 'At least one measurable required');

export const upsertScorecardEntrySchema = z.object({
  measurableId: uuidSchema,
  weekOf: dateSchema,
  value: z.number().nullable(),
});

// ============================================
// Meeting Schemas
// ============================================

export const startMeetingSchema = z.object({
  teamId: uuidSchema,
  title: z.string().max(200).optional(),
});

export const advanceSegmentSchema = z.object({
  meetingId: uuidSchema,
  segment: z.enum(['segue', 'scorecard', 'rock_review', 'headlines', 'todo_review', 'ids', 'conclude']),
});

export const submitRatingSchema = z.object({
  meetingId: uuidSchema,
  rating: z.number().int().min(1).max(10),
  explanation: z.string().max(500).optional(),
}).refine(
  (data) => data.rating >= 8 || (data.explanation && data.explanation.trim().length > 0),
  { message: 'Explanation is required for ratings below 8', path: ['explanation'] }
);

// ============================================
// Comment Schemas
// ============================================

export const createCommentSchema = z.object({
  entityType: z.enum(['rock', 'todo', 'milestone', 'issue']),
  entityId: uuidSchema,
  content: z.string().min(1, 'Comment cannot be empty').max(2000, 'Comment too long'),
});

export const updateCommentSchema = z.object({
  id: uuidSchema,
  content: z.string().min(1, 'Comment cannot be empty').max(2000, 'Comment too long'),
});

// ============================================
// Convert Todo to Issue Schema
// ============================================

export const convertTodoToIssueSchema = z.object({
  todoId: uuidSchema,
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
