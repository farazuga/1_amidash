import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('@/lib/l10/supabase-helpers');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { getL10Client } from '@/lib/l10/supabase-helpers';
import { revalidatePath } from 'next/cache';
import { createMockL10Client, createMockL10Chain } from './test-helpers';
import {
  getHeadlines,
  createHeadline,
  deleteHeadline,
  dropHeadlineToIssue,
} from '../headlines-actions';

// ============================================
// Helpers
// ============================================

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '660e8400-e29b-41d4-a716-446655440001';

function mockClient(config: Parameters<typeof createMockL10Client>[0] = {}) {
  const client = createMockL10Client(config);
  vi.mocked(getL10Client).mockResolvedValue(client as never);
  return client;
}

function createMockHeadline(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    team_id: VALID_UUID_2,
    title: 'Test Headline',
    category: null,
    sentiment: 'neutral',
    created_by: 'test-user-id',
    meeting_id: null,
    created_at: '2026-01-01T00:00:00Z',
    profiles: { id: 'test-user-id', full_name: 'Test User', email: 'test@example.com' },
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe('headlines-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // getHeadlines
  // ==========================================

  describe('getHeadlines', () => {
    it('returns headlines for a team', async () => {
      const headlines = [createMockHeadline(), createMockHeadline({ id: VALID_UUID_2, title: 'Another' })];
      mockClient({ tables: { l10_headlines: { data: headlines, error: null } } });

      const result = await getHeadlines(VALID_UUID_2);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(headlines);
    });

    it('filters by meetingId when provided', async () => {
      const chain = createMockL10Chain({ data: [createMockHeadline()], error: null });
      const client = createMockL10Client();
      (client.supabase as Record<string, unknown>).from = vi.fn().mockReturnValue(chain);
      vi.mocked(getL10Client).mockResolvedValue(client as never);

      await getHeadlines(VALID_UUID_2, VALID_UUID);

      expect(chain.eq).toHaveBeenCalledWith('team_id', VALID_UUID_2);
      expect(chain.eq).toHaveBeenCalledWith('meeting_id', VALID_UUID);
    });

    it('does not filter by meetingId when omitted', async () => {
      const chain = createMockL10Chain({ data: [], error: null });
      const client = createMockL10Client();
      (client.supabase as Record<string, unknown>).from = vi.fn().mockReturnValue(chain);
      vi.mocked(getL10Client).mockResolvedValue(client as never);

      await getHeadlines(VALID_UUID_2);

      expect(chain.eq).toHaveBeenCalledWith('team_id', VALID_UUID_2);
      expect(chain.eq).toHaveBeenCalledTimes(1);
    });

    it('returns empty array when data is null', async () => {
      mockClient({ tables: { l10_headlines: { data: null, error: null } } });

      const result = await getHeadlines(VALID_UUID_2);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('returns empty array when no headlines exist', async () => {
      mockClient({ tables: { l10_headlines: { data: [], error: null } } });

      const result = await getHeadlines(VALID_UUID_2);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('returns error on DB failure', async () => {
      mockClient({ tables: { l10_headlines: { data: null, error: new Error('DB error') } } });

      const result = await getHeadlines(VALID_UUID_2);

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });
  });

  // ==========================================
  // createHeadline
  // ==========================================

  describe('createHeadline', () => {
    const validInput = {
      teamId: VALID_UUID_2,
      title: 'New Headline',
    };

    it('creates a headline with defaults', async () => {
      const chain = createMockL10Chain({ data: null, error: null });
      const client = createMockL10Client();
      (client.supabase as Record<string, unknown>).from = vi.fn().mockReturnValue(chain);
      vi.mocked(getL10Client).mockResolvedValue(client as never);

      const result = await createHeadline(validInput);

      expect(result.success).toBe(true);
      expect(chain.insert).toHaveBeenCalledWith({
        team_id: VALID_UUID_2,
        title: 'New Headline',
        category: null,
        sentiment: 'neutral',
        created_by: 'test-user-id',
        meeting_id: null,
      });
      expect(revalidatePath).toHaveBeenCalledWith('/l10');
    });

    it('creates a headline with all fields', async () => {
      const chain = createMockL10Chain({ data: null, error: null });
      const client = createMockL10Client();
      (client.supabase as Record<string, unknown>).from = vi.fn().mockReturnValue(chain);
      vi.mocked(getL10Client).mockResolvedValue(client as never);

      const input = {
        teamId: VALID_UUID_2,
        title: 'Customer Headline',
        category: 'customer',
        sentiment: 'good',
        meetingId: VALID_UUID,
      };

      const result = await createHeadline(input);

      expect(result.success).toBe(true);
      expect(chain.insert).toHaveBeenCalledWith({
        team_id: VALID_UUID_2,
        title: 'Customer Headline',
        category: 'customer',
        sentiment: 'good',
        created_by: 'test-user-id',
        meeting_id: VALID_UUID,
      });
    });

    it('returns validation error for missing title', async () => {
      const result = await createHeadline({ teamId: VALID_UUID_2 });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(getL10Client).not.toHaveBeenCalled();
    });

    it('returns validation error for missing teamId', async () => {
      const result = await createHeadline({ title: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(getL10Client).not.toHaveBeenCalled();
    });

    it('returns validation error for empty title', async () => {
      const result = await createHeadline({ teamId: VALID_UUID_2, title: '' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns validation error for invalid input', async () => {
      const result = await createHeadline(null);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns error on DB failure', async () => {
      mockClient({ tables: { l10_headlines: { data: null, error: new Error('Insert failed') } } });

      const result = await createHeadline(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insert failed');
    });
  });

  // ==========================================
  // deleteHeadline
  // ==========================================

  describe('deleteHeadline', () => {
    it('deletes a headline by id', async () => {
      const chain = createMockL10Chain({ data: null, error: null });
      const client = createMockL10Client();
      (client.supabase as Record<string, unknown>).from = vi.fn().mockReturnValue(chain);
      vi.mocked(getL10Client).mockResolvedValue(client as never);

      const result = await deleteHeadline(VALID_UUID);

      expect(result.success).toBe(true);
      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('id', VALID_UUID);
      expect(revalidatePath).toHaveBeenCalledWith('/l10');
    });

    it('returns error on DB failure', async () => {
      mockClient({ tables: { l10_headlines: { data: null, error: new Error('Delete failed') } } });

      const result = await deleteHeadline(VALID_UUID);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete failed');
    });

    it('succeeds even if headline does not exist (no row matched)', async () => {
      mockClient({ tables: { l10_headlines: { data: null, error: null } } });

      const result = await deleteHeadline(VALID_UUID);

      expect(result.success).toBe(true);
    });
  });

  // ==========================================
  // dropHeadlineToIssue
  // ==========================================

  describe('dropHeadlineToIssue', () => {
    it('converts a headline to an issue', async () => {
      const headline = { team_id: VALID_UUID_2, title: 'Headline to Drop' };

      // Need separate chains for l10_headlines (fetch) and l10_issues (insert)
      const headlineChain = createMockL10Chain({ data: headline, error: null });
      const issueChain = createMockL10Chain({ data: null, error: null });

      const client = createMockL10Client();
      (client.supabase as Record<string, unknown>).from = vi.fn().mockImplementation((table: string) => {
        if (table === 'l10_headlines') return headlineChain;
        if (table === 'l10_issues') return issueChain;
        return createMockL10Chain({ data: null, error: null });
      });
      vi.mocked(getL10Client).mockResolvedValue(client as never);

      const result = await dropHeadlineToIssue(VALID_UUID);

      expect(result.success).toBe(true);
      expect(headlineChain.select).toHaveBeenCalledWith('team_id, title');
      expect(headlineChain.eq).toHaveBeenCalledWith('id', VALID_UUID);
      expect(headlineChain.single).toHaveBeenCalled();
      expect(issueChain.insert).toHaveBeenCalledWith({
        team_id: VALID_UUID_2,
        title: 'Headline to Drop',
        created_by: 'test-user-id',
        source_type: 'headline',
        source_id: VALID_UUID,
      });
      expect(revalidatePath).toHaveBeenCalledWith('/l10');
    });

    it('returns error when headline not found', async () => {
      const headlineChain = createMockL10Chain({ data: null, error: new Error('Row not found') });

      const client = createMockL10Client();
      (client.supabase as Record<string, unknown>).from = vi.fn().mockImplementation((table: string) => {
        if (table === 'l10_headlines') return headlineChain;
        return createMockL10Chain({ data: null, error: null });
      });
      vi.mocked(getL10Client).mockResolvedValue(client as never);

      const result = await dropHeadlineToIssue(VALID_UUID);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Row not found');
    });

    it('returns error when issue insert fails', async () => {
      const headline = { team_id: VALID_UUID_2, title: 'Headline' };
      const headlineChain = createMockL10Chain({ data: headline, error: null });
      const issueChain = createMockL10Chain({ data: null, error: new Error('Insert failed') });

      const client = createMockL10Client();
      (client.supabase as Record<string, unknown>).from = vi.fn().mockImplementation((table: string) => {
        if (table === 'l10_headlines') return headlineChain;
        if (table === 'l10_issues') return issueChain;
        return createMockL10Chain({ data: null, error: null });
      });
      vi.mocked(getL10Client).mockResolvedValue(client as never);

      const result = await dropHeadlineToIssue(VALID_UUID);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insert failed');
    });
  });
});
