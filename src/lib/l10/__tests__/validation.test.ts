import { describe, it, expect } from 'vitest';
import {
  createTeamSchema,
  updateTeamSchema,
  teamMemberSchema,
  updateTeamMemberRoleSchema,
  createRockSchema,
  updateRockSchema,
  createMilestoneSchema,
  updateMilestoneSchema,
  createIssueSchema,
  updateIssueSchema,
  reorderIssuesSchema,
  solveIssueSchema,
  createTodoSchema,
  updateTodoSchema,
  createHeadlineSchema,
  createMeasurableSchema,
  updateMeasurableSchema,
  reorderMeasurablesSchema,
  upsertScorecardEntrySchema,
  startMeetingSchema,
  advanceSegmentSchema,
  submitRatingSchema,
  createCommentSchema,
  updateCommentSchema,
  convertTodoToIssueSchema,
  validateInput,
} from '../validation';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const VALID_UUID_2 = '223e4567-e89b-12d3-a456-426614174000';

describe('L10 validation schemas', () => {
  // ============================================
  // Team Schemas
  // ============================================

  describe('createTeamSchema', () => {
    it('accepts valid input with name only', () => {
      const result = createTeamSchema.safeParse({ name: 'Leadership Team' });
      expect(result.success).toBe(true);
    });

    it('accepts valid input with name and description', () => {
      const result = createTeamSchema.safeParse({
        name: 'Leadership Team',
        description: 'Weekly leadership sync',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing name', () => {
      expect(createTeamSchema.safeParse({}).success).toBe(false);
    });

    it('rejects empty name', () => {
      expect(createTeamSchema.safeParse({ name: '' }).success).toBe(false);
    });

    it('rejects name exceeding 100 characters', () => {
      expect(createTeamSchema.safeParse({ name: 'a'.repeat(101) }).success).toBe(false);
    });

    it('accepts name at 100 characters', () => {
      expect(createTeamSchema.safeParse({ name: 'a'.repeat(100) }).success).toBe(true);
    });

    it('rejects description exceeding 500 characters', () => {
      expect(createTeamSchema.safeParse({ name: 'Team', description: 'a'.repeat(501) }).success).toBe(false);
    });

    it('accepts description at 500 characters', () => {
      expect(createTeamSchema.safeParse({ name: 'Team', description: 'a'.repeat(500) }).success).toBe(true);
    });
  });

  describe('updateTeamSchema', () => {
    it('accepts valid input with all fields', () => {
      const result = updateTeamSchema.safeParse({
        id: VALID_UUID,
        name: 'New Name',
        description: 'New desc',
      });
      expect(result.success).toBe(true);
    });

    it('accepts id only (no updates)', () => {
      expect(updateTeamSchema.safeParse({ id: VALID_UUID }).success).toBe(true);
    });

    it('rejects missing id', () => {
      expect(updateTeamSchema.safeParse({ name: 'Test' }).success).toBe(false);
    });

    it('rejects invalid uuid for id', () => {
      expect(updateTeamSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
    });

    it('accepts null description', () => {
      const result = updateTeamSchema.safeParse({ id: VALID_UUID, description: null });
      expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
      expect(updateTeamSchema.safeParse({ id: VALID_UUID, name: '' }).success).toBe(false);
    });
  });

  describe('teamMemberSchema', () => {
    it('accepts valid input with required fields', () => {
      const result = teamMemberSchema.safeParse({
        teamId: VALID_UUID,
        userId: VALID_UUID_2,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('member');
      }
    });

    it('accepts valid input with role', () => {
      const result = teamMemberSchema.safeParse({
        teamId: VALID_UUID,
        userId: VALID_UUID_2,
        role: 'facilitator',
      });
      expect(result.success).toBe(true);
    });

    it('accepts all valid roles', () => {
      for (const role of ['member', 'facilitator', 'admin']) {
        expect(
          teamMemberSchema.safeParse({ teamId: VALID_UUID, userId: VALID_UUID_2, role }).success
        ).toBe(true);
      }
    });

    it('rejects invalid role', () => {
      expect(
        teamMemberSchema.safeParse({ teamId: VALID_UUID, userId: VALID_UUID_2, role: 'owner' }).success
      ).toBe(false);
    });

    it('rejects missing teamId', () => {
      expect(teamMemberSchema.safeParse({ userId: VALID_UUID_2 }).success).toBe(false);
    });

    it('rejects missing userId', () => {
      expect(teamMemberSchema.safeParse({ teamId: VALID_UUID }).success).toBe(false);
    });

    it('rejects invalid uuid', () => {
      expect(teamMemberSchema.safeParse({ teamId: 'bad', userId: VALID_UUID_2 }).success).toBe(false);
    });
  });

  describe('updateTeamMemberRoleSchema', () => {
    it('accepts valid input', () => {
      const result = updateTeamMemberRoleSchema.safeParse({
        teamId: VALID_UUID,
        userId: VALID_UUID_2,
        role: 'admin',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing role', () => {
      expect(
        updateTeamMemberRoleSchema.safeParse({ teamId: VALID_UUID, userId: VALID_UUID_2 }).success
      ).toBe(false);
    });

    it('rejects missing teamId', () => {
      expect(
        updateTeamMemberRoleSchema.safeParse({ userId: VALID_UUID_2, role: 'admin' }).success
      ).toBe(false);
    });

    it('rejects missing userId', () => {
      expect(
        updateTeamMemberRoleSchema.safeParse({ teamId: VALID_UUID, role: 'admin' }).success
      ).toBe(false);
    });

    it('rejects empty object', () => {
      expect(updateTeamMemberRoleSchema.safeParse({}).success).toBe(false);
    });
  });

  // ============================================
  // Rock Schemas
  // ============================================

  describe('createRockSchema', () => {
    const validRock = {
      teamId: VALID_UUID,
      title: 'Launch new product',
      quarter: '2026-Q1',
    };

    it('accepts valid input with required fields', () => {
      expect(createRockSchema.safeParse(validRock).success).toBe(true);
    });

    it('accepts valid input with all optional fields', () => {
      const result = createRockSchema.safeParse({
        ...validRock,
        description: 'Details here',
        ownerId: VALID_UUID_2,
        dueDate: '2026-03-31',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing teamId', () => {
      expect(createRockSchema.safeParse({ title: 'Rock', quarter: '2026-Q1' }).success).toBe(false);
    });

    it('rejects missing title', () => {
      expect(createRockSchema.safeParse({ teamId: VALID_UUID, quarter: '2026-Q1' }).success).toBe(false);
    });

    it('rejects missing quarter', () => {
      expect(createRockSchema.safeParse({ teamId: VALID_UUID, title: 'Rock' }).success).toBe(false);
    });

    it('rejects empty title', () => {
      expect(createRockSchema.safeParse({ ...validRock, title: '' }).success).toBe(false);
    });

    it('rejects title exceeding 500 characters', () => {
      expect(createRockSchema.safeParse({ ...validRock, title: 'a'.repeat(501) }).success).toBe(false);
    });

    it('rejects invalid quarter format', () => {
      expect(createRockSchema.safeParse({ ...validRock, quarter: '2026Q1' }).success).toBe(false);
      expect(createRockSchema.safeParse({ ...validRock, quarter: 'Q1-2026' }).success).toBe(false);
      expect(createRockSchema.safeParse({ ...validRock, quarter: '2026-Q5' }).success).toBe(false);
    });

    it('accepts valid quarter formats Q1-Q4', () => {
      for (const q of ['2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4']) {
        expect(createRockSchema.safeParse({ ...validRock, quarter: q }).success).toBe(true);
      }
    });

    it('rejects invalid date format', () => {
      expect(createRockSchema.safeParse({ ...validRock, dueDate: '03/31/2026' }).success).toBe(false);
    });

    it('rejects description exceeding 2000 characters', () => {
      expect(createRockSchema.safeParse({ ...validRock, description: 'a'.repeat(2001) }).success).toBe(false);
    });
  });

  describe('updateRockSchema', () => {
    it('accepts valid input with id only', () => {
      expect(updateRockSchema.safeParse({ id: VALID_UUID }).success).toBe(true);
    });

    it('accepts all optional fields', () => {
      const result = updateRockSchema.safeParse({
        id: VALID_UUID,
        title: 'Updated title',
        description: 'Updated',
        ownerId: VALID_UUID_2,
        status: 'on_track',
        dueDate: '2026-06-30',
        isArchived: true,
      });
      expect(result.success).toBe(true);
    });

    it('accepts all valid statuses', () => {
      for (const status of ['on_track', 'off_track', 'complete', 'dropped']) {
        expect(updateRockSchema.safeParse({ id: VALID_UUID, status }).success).toBe(true);
      }
    });

    it('rejects invalid status', () => {
      expect(updateRockSchema.safeParse({ id: VALID_UUID, status: 'pending' }).success).toBe(false);
    });

    it('rejects missing id', () => {
      expect(updateRockSchema.safeParse({ title: 'Test' }).success).toBe(false);
    });

    it('accepts null for nullable fields', () => {
      const result = updateRockSchema.safeParse({
        id: VALID_UUID,
        description: null,
        ownerId: null,
        dueDate: null,
      });
      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // Milestone Schemas
  // ============================================

  describe('createMilestoneSchema', () => {
    const validMilestone = {
      rockId: VALID_UUID,
      title: 'Complete phase 1',
    };

    it('accepts valid input with required fields', () => {
      expect(createMilestoneSchema.safeParse(validMilestone).success).toBe(true);
    });

    it('accepts all optional fields', () => {
      const result = createMilestoneSchema.safeParse({
        ...validMilestone,
        description: 'Details',
        dueDate: '2026-04-15',
        ownerId: VALID_UUID_2,
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing rockId', () => {
      expect(createMilestoneSchema.safeParse({ title: 'Test' }).success).toBe(false);
    });

    it('rejects missing title', () => {
      expect(createMilestoneSchema.safeParse({ rockId: VALID_UUID }).success).toBe(false);
    });

    it('rejects empty title', () => {
      expect(createMilestoneSchema.safeParse({ ...validMilestone, title: '' }).success).toBe(false);
    });

    it('rejects title exceeding 500 characters', () => {
      expect(createMilestoneSchema.safeParse({ ...validMilestone, title: 'a'.repeat(501) }).success).toBe(false);
    });
  });

  describe('updateMilestoneSchema', () => {
    it('accepts valid input with id only', () => {
      expect(updateMilestoneSchema.safeParse({ id: VALID_UUID }).success).toBe(true);
    });

    it('accepts all optional fields', () => {
      const result = updateMilestoneSchema.safeParse({
        id: VALID_UUID,
        title: 'Updated',
        description: 'Updated desc',
        dueDate: '2026-05-01',
        ownerId: VALID_UUID_2,
        isComplete: true,
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing id', () => {
      expect(updateMilestoneSchema.safeParse({ title: 'Test' }).success).toBe(false);
    });

    it('accepts null for nullable fields', () => {
      const result = updateMilestoneSchema.safeParse({
        id: VALID_UUID,
        description: null,
        dueDate: null,
        ownerId: null,
      });
      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // Issue Schemas
  // ============================================

  describe('createIssueSchema', () => {
    const validIssue = {
      teamId: VALID_UUID,
      title: 'Fix broken pipeline',
    };

    it('accepts valid input with required fields', () => {
      expect(createIssueSchema.safeParse(validIssue).success).toBe(true);
    });

    it('accepts all optional fields', () => {
      const result = createIssueSchema.safeParse({
        ...validIssue,
        description: 'Pipeline fails on deploy',
        sourceType: 'rock',
        sourceId: VALID_UUID_2,
        sourceMeta: { key: 'value' },
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing teamId', () => {
      expect(createIssueSchema.safeParse({ title: 'Issue' }).success).toBe(false);
    });

    it('rejects missing title', () => {
      expect(createIssueSchema.safeParse({ teamId: VALID_UUID }).success).toBe(false);
    });

    it('rejects empty title', () => {
      expect(createIssueSchema.safeParse({ ...validIssue, title: '' }).success).toBe(false);
    });

    it('rejects title exceeding 500 characters', () => {
      expect(createIssueSchema.safeParse({ ...validIssue, title: 'a'.repeat(501) }).success).toBe(false);
    });

    it('rejects sourceType exceeding 50 characters', () => {
      expect(createIssueSchema.safeParse({ ...validIssue, sourceType: 'a'.repeat(51) }).success).toBe(false);
    });
  });

  describe('updateIssueSchema', () => {
    it('accepts valid input with id only', () => {
      expect(updateIssueSchema.safeParse({ id: VALID_UUID }).success).toBe(true);
    });

    it('accepts all valid statuses', () => {
      for (const status of ['open', 'solving', 'solved', 'combined']) {
        expect(updateIssueSchema.safeParse({ id: VALID_UUID, status }).success).toBe(true);
      }
    });

    it('rejects invalid status', () => {
      expect(updateIssueSchema.safeParse({ id: VALID_UUID, status: 'closed' }).success).toBe(false);
    });

    it('rejects missing id', () => {
      expect(updateIssueSchema.safeParse({ title: 'Test' }).success).toBe(false);
    });

    it('accepts null for nullable description', () => {
      expect(updateIssueSchema.safeParse({ id: VALID_UUID, description: null }).success).toBe(true);
    });
  });

  describe('reorderIssuesSchema', () => {
    it('accepts valid array', () => {
      const result = reorderIssuesSchema.safeParse([
        { id: VALID_UUID, priority_rank: 0 },
        { id: VALID_UUID_2, priority_rank: 1 },
      ]);
      expect(result.success).toBe(true);
    });

    it('rejects empty array', () => {
      expect(reorderIssuesSchema.safeParse([]).success).toBe(false);
    });

    it('rejects negative priority_rank', () => {
      expect(reorderIssuesSchema.safeParse([{ id: VALID_UUID, priority_rank: -1 }]).success).toBe(false);
    });

    it('rejects non-integer priority_rank', () => {
      expect(reorderIssuesSchema.safeParse([{ id: VALID_UUID, priority_rank: 1.5 }]).success).toBe(false);
    });

    it('rejects missing id', () => {
      expect(reorderIssuesSchema.safeParse([{ priority_rank: 0 }]).success).toBe(false);
    });

    it('rejects invalid uuid', () => {
      expect(reorderIssuesSchema.safeParse([{ id: 'bad', priority_rank: 0 }]).success).toBe(false);
    });

    it('accepts priority_rank of 0', () => {
      expect(reorderIssuesSchema.safeParse([{ id: VALID_UUID, priority_rank: 0 }]).success).toBe(true);
    });
  });

  describe('solveIssueSchema', () => {
    it('accepts valid input with id only', () => {
      expect(solveIssueSchema.safeParse({ id: VALID_UUID }).success).toBe(true);
    });

    it('accepts optional todo fields', () => {
      const result = solveIssueSchema.safeParse({
        id: VALID_UUID,
        todoTitle: 'Follow up on fix',
        todoOwnerId: VALID_UUID_2,
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing id', () => {
      expect(solveIssueSchema.safeParse({}).success).toBe(false);
    });

    it('rejects empty todoTitle', () => {
      expect(solveIssueSchema.safeParse({ id: VALID_UUID, todoTitle: '' }).success).toBe(false);
    });

    it('rejects todoTitle exceeding 500 characters', () => {
      expect(solveIssueSchema.safeParse({ id: VALID_UUID, todoTitle: 'a'.repeat(501) }).success).toBe(false);
    });
  });

  // ============================================
  // Todo Schemas
  // ============================================

  describe('createTodoSchema', () => {
    const validTodo = {
      teamId: VALID_UUID,
      title: 'Update documentation',
    };

    it('accepts valid input with required fields', () => {
      expect(createTodoSchema.safeParse(validTodo).success).toBe(true);
    });

    it('accepts all optional fields', () => {
      const result = createTodoSchema.safeParse({
        ...validTodo,
        ownerId: VALID_UUID_2,
        dueDate: '2026-03-25',
        sourceMeetingId: VALID_UUID,
        sourceIssueId: VALID_UUID_2,
        sourceMilestoneId: VALID_UUID,
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing teamId', () => {
      expect(createTodoSchema.safeParse({ title: 'Test' }).success).toBe(false);
    });

    it('rejects missing title', () => {
      expect(createTodoSchema.safeParse({ teamId: VALID_UUID }).success).toBe(false);
    });

    it('rejects empty title', () => {
      expect(createTodoSchema.safeParse({ ...validTodo, title: '' }).success).toBe(false);
    });

    it('rejects title exceeding 500 characters', () => {
      expect(createTodoSchema.safeParse({ ...validTodo, title: 'a'.repeat(501) }).success).toBe(false);
    });

    it('rejects invalid date format', () => {
      expect(createTodoSchema.safeParse({ ...validTodo, dueDate: '2026/03/25' }).success).toBe(false);
    });
  });

  describe('updateTodoSchema', () => {
    it('accepts valid input with id only', () => {
      expect(updateTodoSchema.safeParse({ id: VALID_UUID }).success).toBe(true);
    });

    it('accepts all optional fields', () => {
      const result = updateTodoSchema.safeParse({
        id: VALID_UUID,
        title: 'Updated',
        description: 'Desc',
        ownerId: VALID_UUID_2,
        dueDate: '2026-04-01',
        isDone: true,
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing id', () => {
      expect(updateTodoSchema.safeParse({ title: 'Test' }).success).toBe(false);
    });

    it('accepts null for nullable fields', () => {
      const result = updateTodoSchema.safeParse({
        id: VALID_UUID,
        description: null,
        ownerId: null,
        dueDate: null,
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-boolean isDone', () => {
      expect(updateTodoSchema.safeParse({ id: VALID_UUID, isDone: 'yes' }).success).toBe(false);
    });
  });

  // ============================================
  // Headline Schemas
  // ============================================

  describe('createHeadlineSchema', () => {
    const validHeadline = {
      teamId: VALID_UUID,
      title: 'Big customer win',
    };

    it('accepts valid input with required fields', () => {
      const result = createHeadlineSchema.safeParse(validHeadline);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sentiment).toBe('neutral');
      }
    });

    it('accepts all optional fields', () => {
      const result = createHeadlineSchema.safeParse({
        ...validHeadline,
        category: 'customer',
        sentiment: 'good',
        meetingId: VALID_UUID_2,
      });
      expect(result.success).toBe(true);
    });

    it('accepts all valid categories', () => {
      for (const category of ['customer', 'employee']) {
        expect(createHeadlineSchema.safeParse({ ...validHeadline, category }).success).toBe(true);
      }
    });

    it('accepts all valid sentiments', () => {
      for (const sentiment of ['good', 'bad', 'neutral']) {
        expect(createHeadlineSchema.safeParse({ ...validHeadline, sentiment }).success).toBe(true);
      }
    });

    it('rejects invalid category', () => {
      expect(createHeadlineSchema.safeParse({ ...validHeadline, category: 'vendor' }).success).toBe(false);
    });

    it('rejects invalid sentiment', () => {
      expect(createHeadlineSchema.safeParse({ ...validHeadline, sentiment: 'excited' }).success).toBe(false);
    });

    it('rejects missing teamId', () => {
      expect(createHeadlineSchema.safeParse({ title: 'Test' }).success).toBe(false);
    });

    it('rejects missing title', () => {
      expect(createHeadlineSchema.safeParse({ teamId: VALID_UUID }).success).toBe(false);
    });

    it('rejects empty title', () => {
      expect(createHeadlineSchema.safeParse({ ...validHeadline, title: '' }).success).toBe(false);
    });
  });

  // ============================================
  // Scorecard Schemas
  // ============================================

  describe('createMeasurableSchema', () => {
    const validMeasurable = {
      scorecardId: VALID_UUID,
      title: 'Weekly Revenue',
    };

    it('accepts valid input with required fields and defaults', () => {
      const result = createMeasurableSchema.safeParse(validMeasurable);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.unit).toBe('number');
        expect(result.data.goalDirection).toBe('above');
      }
    });

    it('accepts all optional fields', () => {
      const result = createMeasurableSchema.safeParse({
        ...validMeasurable,
        ownerId: VALID_UUID_2,
        unit: 'currency',
        goalValue: 10000,
        goalDirection: 'above',
        autoSource: 'po_revenue',
      });
      expect(result.success).toBe(true);
    });

    it('accepts all valid units', () => {
      for (const unit of ['number', 'currency', 'percentage']) {
        expect(createMeasurableSchema.safeParse({ ...validMeasurable, unit }).success).toBe(true);
      }
    });

    it('accepts all valid goal directions', () => {
      for (const goalDirection of ['above', 'below', 'exact']) {
        expect(createMeasurableSchema.safeParse({ ...validMeasurable, goalDirection }).success).toBe(true);
      }
    });

    it('accepts all valid autoSource values', () => {
      for (const autoSource of ['po_revenue', 'invoiced_revenue', 'open_projects']) {
        expect(createMeasurableSchema.safeParse({ ...validMeasurable, autoSource }).success).toBe(true);
      }
    });

    it('accepts null autoSource', () => {
      expect(createMeasurableSchema.safeParse({ ...validMeasurable, autoSource: null }).success).toBe(true);
    });

    it('rejects missing scorecardId', () => {
      expect(createMeasurableSchema.safeParse({ title: 'Test' }).success).toBe(false);
    });

    it('rejects missing title', () => {
      expect(createMeasurableSchema.safeParse({ scorecardId: VALID_UUID }).success).toBe(false);
    });

    it('rejects empty title', () => {
      expect(createMeasurableSchema.safeParse({ ...validMeasurable, title: '' }).success).toBe(false);
    });

    it('rejects title exceeding 200 characters', () => {
      expect(createMeasurableSchema.safeParse({ ...validMeasurable, title: 'a'.repeat(201) }).success).toBe(false);
    });

    it('requires odooAccountCode and odooDateMode when autoSource is odoo_account', () => {
      const result = createMeasurableSchema.safeParse({
        ...validMeasurable,
        autoSource: 'odoo_account',
      });
      expect(result.success).toBe(false);
    });

    it('accepts odoo_account with required odoo fields', () => {
      const result = createMeasurableSchema.safeParse({
        ...validMeasurable,
        autoSource: 'odoo_account',
        odooAccountCode: 'ACC001',
        odooDateMode: 'date_range',
      });
      expect(result.success).toBe(true);
    });

    it('rejects odoo_account with missing odooDateMode', () => {
      const result = createMeasurableSchema.safeParse({
        ...validMeasurable,
        autoSource: 'odoo_account',
        odooAccountCode: 'ACC001',
      });
      expect(result.success).toBe(false);
    });

    it('rejects odoo_account with missing odooAccountCode', () => {
      const result = createMeasurableSchema.safeParse({
        ...validMeasurable,
        autoSource: 'odoo_account',
        odooDateMode: 'last_day',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid unit', () => {
      expect(createMeasurableSchema.safeParse({ ...validMeasurable, unit: 'bytes' }).success).toBe(false);
    });
  });

  describe('updateMeasurableSchema', () => {
    it('accepts valid input with id only', () => {
      expect(updateMeasurableSchema.safeParse({ id: VALID_UUID }).success).toBe(true);
    });

    it('accepts all optional fields', () => {
      const result = updateMeasurableSchema.safeParse({
        id: VALID_UUID,
        title: 'Updated',
        ownerId: VALID_UUID_2,
        unit: 'percentage',
        goalValue: 95,
        goalDirection: 'above',
        autoSource: null,
        isActive: false,
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing id', () => {
      expect(updateMeasurableSchema.safeParse({ title: 'Test' }).success).toBe(false);
    });

    it('accepts null for nullable fields', () => {
      const result = updateMeasurableSchema.safeParse({
        id: VALID_UUID,
        ownerId: null,
        goalValue: null,
        autoSource: null,
        odooAccountCode: null,
        odooAccountName: null,
        odooDateMode: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('reorderMeasurablesSchema', () => {
    it('accepts valid array', () => {
      const result = reorderMeasurablesSchema.safeParse([
        { id: VALID_UUID, display_order: 0 },
        { id: VALID_UUID_2, display_order: 1 },
      ]);
      expect(result.success).toBe(true);
    });

    it('rejects empty array', () => {
      expect(reorderMeasurablesSchema.safeParse([]).success).toBe(false);
    });

    it('rejects negative display_order', () => {
      expect(reorderMeasurablesSchema.safeParse([{ id: VALID_UUID, display_order: -1 }]).success).toBe(false);
    });

    it('rejects non-integer display_order', () => {
      expect(reorderMeasurablesSchema.safeParse([{ id: VALID_UUID, display_order: 0.5 }]).success).toBe(false);
    });
  });

  describe('upsertScorecardEntrySchema', () => {
    const validEntry = {
      measurableId: VALID_UUID,
      weekOf: '2026-03-16',
      value: 42,
    };

    it('accepts valid input', () => {
      expect(upsertScorecardEntrySchema.safeParse(validEntry).success).toBe(true);
    });

    it('accepts null value', () => {
      expect(upsertScorecardEntrySchema.safeParse({ ...validEntry, value: null }).success).toBe(true);
    });

    it('rejects missing measurableId', () => {
      expect(upsertScorecardEntrySchema.safeParse({ weekOf: '2026-03-16', value: 1 }).success).toBe(false);
    });

    it('rejects missing weekOf', () => {
      expect(upsertScorecardEntrySchema.safeParse({ measurableId: VALID_UUID, value: 1 }).success).toBe(false);
    });

    it('rejects invalid date format for weekOf', () => {
      expect(upsertScorecardEntrySchema.safeParse({ ...validEntry, weekOf: '03-16-2026' }).success).toBe(false);
    });

    it('rejects missing value', () => {
      expect(upsertScorecardEntrySchema.safeParse({ measurableId: VALID_UUID, weekOf: '2026-03-16' }).success).toBe(false);
    });

    it('accepts zero value', () => {
      expect(upsertScorecardEntrySchema.safeParse({ ...validEntry, value: 0 }).success).toBe(true);
    });

    it('accepts negative value', () => {
      expect(upsertScorecardEntrySchema.safeParse({ ...validEntry, value: -5 }).success).toBe(true);
    });
  });

  // ============================================
  // Meeting Schemas
  // ============================================

  describe('startMeetingSchema', () => {
    it('accepts valid input with teamId only', () => {
      expect(startMeetingSchema.safeParse({ teamId: VALID_UUID }).success).toBe(true);
    });

    it('accepts optional title', () => {
      const result = startMeetingSchema.safeParse({ teamId: VALID_UUID, title: 'Weekly L10' });
      expect(result.success).toBe(true);
    });

    it('rejects missing teamId', () => {
      expect(startMeetingSchema.safeParse({}).success).toBe(false);
    });

    it('rejects invalid uuid', () => {
      expect(startMeetingSchema.safeParse({ teamId: 'bad-id' }).success).toBe(false);
    });

    it('rejects title exceeding 200 characters', () => {
      expect(startMeetingSchema.safeParse({ teamId: VALID_UUID, title: 'a'.repeat(201) }).success).toBe(false);
    });
  });

  describe('advanceSegmentSchema', () => {
    it('accepts valid input', () => {
      const result = advanceSegmentSchema.safeParse({
        meetingId: VALID_UUID,
        segment: 'scorecard',
      });
      expect(result.success).toBe(true);
    });

    it('accepts all valid segments', () => {
      const segments = ['segue', 'scorecard', 'rock_review', 'headlines', 'todo_review', 'ids', 'conclude'];
      for (const segment of segments) {
        expect(advanceSegmentSchema.safeParse({ meetingId: VALID_UUID, segment }).success).toBe(true);
      }
    });

    it('rejects invalid segment', () => {
      expect(advanceSegmentSchema.safeParse({ meetingId: VALID_UUID, segment: 'intro' }).success).toBe(false);
    });

    it('rejects missing meetingId', () => {
      expect(advanceSegmentSchema.safeParse({ segment: 'segue' }).success).toBe(false);
    });

    it('rejects missing segment', () => {
      expect(advanceSegmentSchema.safeParse({ meetingId: VALID_UUID }).success).toBe(false);
    });
  });

  describe('submitRatingSchema', () => {
    it('accepts valid rating of 8+ without explanation', () => {
      const result = submitRatingSchema.safeParse({
        meetingId: VALID_UUID,
        rating: 8,
      });
      expect(result.success).toBe(true);
    });

    it('accepts rating of 10', () => {
      expect(submitRatingSchema.safeParse({ meetingId: VALID_UUID, rating: 10 }).success).toBe(true);
    });

    it('accepts rating below 8 with explanation', () => {
      const result = submitRatingSchema.safeParse({
        meetingId: VALID_UUID,
        rating: 5,
        explanation: 'Went off topic too much',
      });
      expect(result.success).toBe(true);
    });

    it('rejects rating below 8 without explanation', () => {
      expect(submitRatingSchema.safeParse({ meetingId: VALID_UUID, rating: 7 }).success).toBe(false);
    });

    it('rejects rating below 8 with empty explanation', () => {
      expect(submitRatingSchema.safeParse({ meetingId: VALID_UUID, rating: 3, explanation: '' }).success).toBe(false);
    });

    it('rejects rating below 8 with whitespace-only explanation', () => {
      expect(submitRatingSchema.safeParse({ meetingId: VALID_UUID, rating: 4, explanation: '   ' }).success).toBe(false);
    });

    it('rejects rating of 0', () => {
      expect(submitRatingSchema.safeParse({ meetingId: VALID_UUID, rating: 0 }).success).toBe(false);
    });

    it('rejects rating of 11', () => {
      expect(submitRatingSchema.safeParse({ meetingId: VALID_UUID, rating: 11 }).success).toBe(false);
    });

    it('rejects non-integer rating', () => {
      expect(submitRatingSchema.safeParse({ meetingId: VALID_UUID, rating: 7.5 }).success).toBe(false);
    });

    it('accepts rating of 1 with explanation', () => {
      expect(submitRatingSchema.safeParse({ meetingId: VALID_UUID, rating: 1, explanation: 'Bad' }).success).toBe(true);
    });

    it('rejects missing meetingId', () => {
      expect(submitRatingSchema.safeParse({ rating: 8 }).success).toBe(false);
    });

    it('rejects missing rating', () => {
      expect(submitRatingSchema.safeParse({ meetingId: VALID_UUID }).success).toBe(false);
    });

    it('accepts optional userId', () => {
      const result = submitRatingSchema.safeParse({
        meetingId: VALID_UUID,
        userId: VALID_UUID_2,
        rating: 9,
      });
      expect(result.success).toBe(true);
    });

    it('rejects explanation exceeding 500 characters', () => {
      expect(submitRatingSchema.safeParse({
        meetingId: VALID_UUID,
        rating: 5,
        explanation: 'a'.repeat(501),
      }).success).toBe(false);
    });
  });

  // ============================================
  // Comment Schemas
  // ============================================

  describe('createCommentSchema', () => {
    const validComment = {
      entityType: 'rock' as const,
      entityId: VALID_UUID,
      content: 'Great progress on this!',
    };

    it('accepts valid input', () => {
      expect(createCommentSchema.safeParse(validComment).success).toBe(true);
    });

    it('accepts all valid entity types', () => {
      for (const entityType of ['rock', 'todo', 'milestone', 'issue']) {
        expect(createCommentSchema.safeParse({ ...validComment, entityType }).success).toBe(true);
      }
    });

    it('rejects invalid entity type', () => {
      expect(createCommentSchema.safeParse({ ...validComment, entityType: 'headline' }).success).toBe(false);
    });

    it('rejects empty content', () => {
      expect(createCommentSchema.safeParse({ ...validComment, content: '' }).success).toBe(false);
    });

    it('rejects content exceeding 2000 characters', () => {
      expect(createCommentSchema.safeParse({ ...validComment, content: 'a'.repeat(2001) }).success).toBe(false);
    });

    it('rejects missing required fields', () => {
      expect(createCommentSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('updateCommentSchema', () => {
    it('accepts valid input', () => {
      expect(updateCommentSchema.safeParse({ id: VALID_UUID, content: 'Updated comment' }).success).toBe(true);
    });

    it('rejects missing id', () => {
      expect(updateCommentSchema.safeParse({ content: 'Test' }).success).toBe(false);
    });

    it('rejects missing content', () => {
      expect(updateCommentSchema.safeParse({ id: VALID_UUID }).success).toBe(false);
    });

    it('rejects empty content', () => {
      expect(updateCommentSchema.safeParse({ id: VALID_UUID, content: '' }).success).toBe(false);
    });

    it('rejects content exceeding 2000 characters', () => {
      expect(updateCommentSchema.safeParse({ id: VALID_UUID, content: 'a'.repeat(2001) }).success).toBe(false);
    });
  });

  // ============================================
  // Convert Todo to Issue Schema
  // ============================================

  describe('convertTodoToIssueSchema', () => {
    it('accepts valid input', () => {
      expect(convertTodoToIssueSchema.safeParse({ todoId: VALID_UUID }).success).toBe(true);
    });

    it('rejects missing todoId', () => {
      expect(convertTodoToIssueSchema.safeParse({}).success).toBe(false);
    });

    it('rejects invalid uuid', () => {
      expect(convertTodoToIssueSchema.safeParse({ todoId: 'not-a-uuid' }).success).toBe(false);
    });
  });

  // ============================================
  // validateInput helper
  // ============================================

  describe('validateInput', () => {
    it('returns success with parsed data for valid input', () => {
      const result = validateInput(createTeamSchema, { name: 'Test Team' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Test Team');
      }
    });

    it('returns error message for invalid input', () => {
      const result = validateInput(createTeamSchema, {});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(typeof result.error).toBe('string');
        expect(result.error.length).toBeGreaterThan(0);
      }
    });

    it('returns first error message from validation', () => {
      const result = validateInput(createTeamSchema, { name: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Team name is required');
      }
    });
  });
});
