import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('@/lib/l10/supabase-helpers');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/odoo', () => ({
  isOdooConfigured: vi.fn(),
  getOdooClient: vi.fn(),
}));
vi.mock('@/lib/odoo/queries', () => ({
  getOpenQuotesTotal: vi.fn(),
  getAccountMovement: vi.fn(),
  getAccountBalance: vi.fn(),
}));

import { getL10Client } from '@/lib/l10/supabase-helpers';
import { revalidatePath } from 'next/cache';
import { isOdooConfigured, getOdooClient } from '@/lib/odoo';
import { getOpenQuotesTotal, getAccountMovement, getAccountBalance } from '@/lib/odoo/queries';
import { createMockL10Client, createMockL10Chain } from './test-helpers';
import {
  getScorecard,
  createMeasurable,
  updateMeasurable,
  deleteMeasurable,
  reorderMeasurables,
  upsertScorecardEntry,
  autoPopulateScorecardWeek,
} from '../scorecard-actions';

// ============================================
// Helpers
// ============================================

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '660e8400-e29b-41d4-a716-446655440001';
const VALID_UUID_3 = '770e8400-e29b-41d4-a716-446655440002';
const SCORECARD_ID = '880e8400-e29b-41d4-a716-446655440003';

function mockClient(config: Parameters<typeof createMockL10Client>[0] = {}) {
  const client = createMockL10Client(config);
  vi.mocked(getL10Client).mockResolvedValue(client as never);
  return client;
}

function createMockScorecard(overrides: Record<string, unknown> = {}) {
  return {
    id: SCORECARD_ID,
    team_id: VALID_UUID,
    name: 'Scorecard',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function createMockMeasurable(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID_2,
    scorecard_id: SCORECARD_ID,
    title: 'Revenue',
    owner_id: 'test-user-id',
    unit: 'currency',
    goal_value: 10000,
    goal_direction: 'above',
    auto_source: null,
    odoo_account_code: null,
    odoo_account_name: null,
    odoo_date_mode: null,
    display_order: 0,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    profiles: { id: 'test-user-id', full_name: 'Test User', email: 'test@example.com' },
    ...overrides,
  };
}

// ============================================
// getScorecard
// ============================================

describe('getScorecard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns existing scorecard with measurables and entries', async () => {
    const scorecard = createMockScorecard();
    const measurables = [createMockMeasurable()];
    const entries = [{ id: 'e1', measurable_id: VALID_UUID_2, week_of: '2026-03-09', value: 5000 }];

    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    // First call: l10_scorecards → maybeSingle returns scorecard
    const scorecardChain = createMockL10Chain({ data: scorecard, error: null });
    // Second call: l10_scorecard_measurables → returns measurables
    const measurablesChain = createMockL10Chain({ data: measurables, error: null });
    // Third call: l10_scorecard_entries → returns entries
    const entriesChain = createMockL10Chain({ data: entries, error: null });

    mockFrom
      .mockReturnValueOnce(scorecardChain)
      .mockReturnValueOnce(measurablesChain)
      .mockReturnValueOnce(entriesChain);

    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await getScorecard(VALID_UUID);

    expect(result.success).toBe(true);
    expect(result.data?.scorecard).toEqual(scorecard);
    expect(result.data?.measurables).toEqual(measurables);
    expect(result.data?.entries).toEqual(entries);
  });

  it('auto-creates scorecard when none exists', async () => {
    const newScorecard = createMockScorecard();
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    // First call: l10_scorecards maybeSingle → null (no scorecard)
    const noScorecardChain = createMockL10Chain({ data: null, error: null });
    // Second call: l10_scorecards insert → returns new scorecard
    const insertChain = createMockL10Chain({ data: newScorecard, error: null });
    // Third call: l10_scorecard_measurables → empty
    const measurablesChain = createMockL10Chain({ data: [], error: null });

    mockFrom
      .mockReturnValueOnce(noScorecardChain)
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(measurablesChain);

    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await getScorecard(VALID_UUID);

    expect(result.success).toBe(true);
    expect(result.data?.scorecard).toEqual(newScorecard);
    expect(result.data?.entries).toEqual([]);
  });

  it('returns error when scorecard creation fails', async () => {
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    const noScorecardChain = createMockL10Chain({ data: null, error: null });
    const insertErrorChain = createMockL10Chain({ data: null, error: { message: 'insert failed' } });
    // single() should throw/reject for errors
    insertErrorChain.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'insert failed' } });

    mockFrom
      .mockReturnValueOnce(noScorecardChain)
      .mockReturnValueOnce(insertErrorChain);

    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await getScorecard(VALID_UUID);

    expect(result.success).toBe(false);
  });

  it('skips entries fetch when no measurables exist', async () => {
    const scorecard = createMockScorecard();
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    const scorecardChain = createMockL10Chain({ data: scorecard, error: null });
    const measurablesChain = createMockL10Chain({ data: [], error: null });

    mockFrom
      .mockReturnValueOnce(scorecardChain)
      .mockReturnValueOnce(measurablesChain);

    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await getScorecard(VALID_UUID);

    expect(result.success).toBe(true);
    expect(result.data?.entries).toEqual([]);
    // from() should only be called twice (scorecards + measurables), not for entries
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it('returns error on measurables fetch failure', async () => {
    const scorecard = createMockScorecard();
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    const scorecardChain = createMockL10Chain({ data: scorecard, error: null });
    const measurablesChain = createMockL10Chain({ data: null, error: { message: 'measurables error' } });

    mockFrom
      .mockReturnValueOnce(scorecardChain)
      .mockReturnValueOnce(measurablesChain);

    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await getScorecard(VALID_UUID);

    expect(result.success).toBe(false);
    expect(result.error).toBe('measurables error');
  });
});

// ============================================
// createMeasurable
// ============================================

describe('createMeasurable', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a measurable with auto-incremented display_order', async () => {
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    // First call: select display_order → existing with order 2
    const selectChain = createMockL10Chain({ data: [{ display_order: 2 }], error: null });
    // Second call: insert → success
    const insertChain = createMockL10Chain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(insertChain);

    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await createMeasurable({
      scorecardId: SCORECARD_ID,
      title: 'New Metric',
      unit: 'number',
      goalDirection: 'above',
    });

    expect(result.success).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('l10_scorecard_measurables');
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('sets display_order to 0 when no existing measurables', async () => {
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    const selectChain = createMockL10Chain({ data: [], error: null });
    const insertChain = createMockL10Chain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(insertChain);

    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await createMeasurable({
      scorecardId: SCORECARD_ID,
      title: 'First Metric',
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid input (missing title)', async () => {
    mockClient();
    const result = await createMeasurable({
      scorecardId: SCORECARD_ID,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects invalid input (missing scorecardId)', async () => {
    mockClient();
    const result = await createMeasurable({
      title: 'Metric',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects invalid UUID for scorecardId', async () => {
    mockClient();
    const result = await createMeasurable({
      scorecardId: 'not-a-uuid',
      title: 'Metric',
    });

    expect(result.success).toBe(false);
  });

  it('validates odoo_account requires account code and date mode', async () => {
    mockClient();
    const result = await createMeasurable({
      scorecardId: SCORECARD_ID,
      title: 'Odoo Metric',
      autoSource: 'odoo_account',
      // missing odooAccountCode and odooDateMode
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('account code');
  });

  it('creates odoo_account measurable with required fields', async () => {
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    const selectChain = createMockL10Chain({ data: [], error: null });
    const insertChain = createMockL10Chain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(insertChain);

    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await createMeasurable({
      scorecardId: SCORECARD_ID,
      title: 'AR Balance',
      autoSource: 'odoo_account',
      odooAccountCode: '1200',
      odooDateMode: 'last_day',
    });

    expect(result.success).toBe(true);
  });

  it('returns error on database failure', async () => {
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    const selectChain = createMockL10Chain({ data: [], error: null });
    const insertChain = createMockL10Chain({ data: null, error: { message: 'insert failed' } });

    mockFrom
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(insertChain);

    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await createMeasurable({
      scorecardId: SCORECARD_ID,
      title: 'Metric',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('insert failed');
  });
});

// ============================================
// updateMeasurable
// ============================================

describe('updateMeasurable', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates measurable with partial fields', async () => {
    mockClient({
      tables: { l10_scorecard_measurables: { data: null, error: null } },
    });

    const result = await updateMeasurable({
      id: VALID_UUID_2,
      title: 'Updated Revenue',
    });

    expect(result.success).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('clears Odoo fields when auto_source changes away from odoo_account', async () => {
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    const updateChain = createMockL10Chain({ data: null, error: null });
    // Capture what gets passed to update()
    let capturedUpdates: Record<string, unknown> = {};
    updateChain.update = vi.fn().mockImplementation((updates: Record<string, unknown>) => {
      capturedUpdates = updates;
      const thenable = Object.create(updateChain);
      thenable.then = (resolve: (v: unknown) => void) =>
        Promise.resolve({ data: null, error: null }).then(resolve);
      return thenable;
    });

    mockFrom.mockReturnValueOnce(updateChain);
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await updateMeasurable({
      id: VALID_UUID_2,
      autoSource: 'po_revenue',
    });

    expect(result.success).toBe(true);
    expect(capturedUpdates.auto_source).toBe('po_revenue');
    expect(capturedUpdates.odoo_account_code).toBeNull();
    expect(capturedUpdates.odoo_account_name).toBeNull();
    expect(capturedUpdates.odoo_date_mode).toBeNull();
  });

  it('does not clear Odoo fields when auto_source is odoo_account', async () => {
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    const updateChain = createMockL10Chain({ data: null, error: null });
    let capturedUpdates: Record<string, unknown> = {};
    updateChain.update = vi.fn().mockImplementation((updates: Record<string, unknown>) => {
      capturedUpdates = updates;
      const thenable = Object.create(updateChain);
      thenable.then = (resolve: (v: unknown) => void) =>
        Promise.resolve({ data: null, error: null }).then(resolve);
      return thenable;
    });

    mockFrom.mockReturnValueOnce(updateChain);
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await updateMeasurable({
      id: VALID_UUID_2,
      autoSource: 'odoo_account',
    });

    expect(result.success).toBe(true);
    expect(capturedUpdates.auto_source).toBe('odoo_account');
    expect(capturedUpdates.odoo_account_code).toBeUndefined();
    expect(capturedUpdates.odoo_account_name).toBeUndefined();
    expect(capturedUpdates.odoo_date_mode).toBeUndefined();
  });

  it('rejects invalid input (missing id)', async () => {
    mockClient();
    const result = await updateMeasurable({ title: 'No id' });

    expect(result.success).toBe(false);
  });

  it('returns error on database failure', async () => {
    mockClient({
      tables: { l10_scorecard_measurables: { data: null, error: { message: 'update error' } } },
    });

    const result = await updateMeasurable({
      id: VALID_UUID_2,
      title: 'Updated',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('update error');
  });
});

// ============================================
// deleteMeasurable
// ============================================

describe('deleteMeasurable', () => {
  beforeEach(() => vi.clearAllMocks());

  it('soft-deletes by setting is_active to false', async () => {
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    const chain = createMockL10Chain({ data: null, error: null });
    let capturedUpdates: Record<string, unknown> = {};
    chain.update = vi.fn().mockImplementation((updates: Record<string, unknown>) => {
      capturedUpdates = updates;
      const thenable = Object.create(chain);
      thenable.then = (resolve: (v: unknown) => void) =>
        Promise.resolve({ data: null, error: null }).then(resolve);
      return thenable;
    });

    mockFrom.mockReturnValueOnce(chain);
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await deleteMeasurable(VALID_UUID_2);

    expect(result.success).toBe(true);
    expect(capturedUpdates.is_active).toBe(false);
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('returns error on database failure', async () => {
    mockClient({
      tables: { l10_scorecard_measurables: { data: null, error: { message: 'delete error' } } },
    });

    const result = await deleteMeasurable(VALID_UUID_2);

    expect(result.success).toBe(false);
    expect(result.error).toBe('delete error');
  });
});

// ============================================
// reorderMeasurables
// ============================================

describe('reorderMeasurables', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates display_order for each measurable', async () => {
    mockClient({
      tables: { l10_scorecard_measurables: { data: null, error: null } },
    });

    const result = await reorderMeasurables([
      { id: VALID_UUID, display_order: 0 },
      { id: VALID_UUID_2, display_order: 1 },
      { id: VALID_UUID_3, display_order: 2 },
    ]);

    expect(result.success).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('rejects empty array', async () => {
    mockClient();
    const result = await reorderMeasurables([]);

    expect(result.success).toBe(false);
  });

  it('rejects invalid UUIDs', async () => {
    mockClient();
    const result = await reorderMeasurables([
      { id: 'bad-uuid', display_order: 0 },
    ]);

    expect(result.success).toBe(false);
  });

  it('rejects negative display_order', async () => {
    mockClient();
    const result = await reorderMeasurables([
      { id: VALID_UUID, display_order: -1 },
    ]);

    expect(result.success).toBe(false);
  });

  it('returns error on database failure', async () => {
    mockClient({
      tables: { l10_scorecard_measurables: { data: null, error: { message: 'reorder error' } } },
    });

    const result = await reorderMeasurables([
      { id: VALID_UUID, display_order: 0 },
    ]);

    expect(result.success).toBe(false);
    expect(result.error).toBe('reorder error');
  });
});

// ============================================
// upsertScorecardEntry
// ============================================

describe('upsertScorecardEntry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts entry with user id and is_auto_populated=false', async () => {
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    const chain = createMockL10Chain({ data: null, error: null });
    let capturedData: Record<string, unknown> = {};
    chain.upsert = vi.fn().mockImplementation((data: Record<string, unknown>) => {
      capturedData = data;
      const thenable = Object.create(chain);
      thenable.then = (resolve: (v: unknown) => void) =>
        Promise.resolve({ data: null, error: null }).then(resolve);
      return thenable;
    });

    mockFrom.mockReturnValueOnce(chain);
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await upsertScorecardEntry({
      measurableId: VALID_UUID_2,
      weekOf: '2026-03-09',
      value: 5000,
    });

    expect(result.success).toBe(true);
    expect(capturedData).toMatchObject({
      measurable_id: VALID_UUID_2,
      week_of: '2026-03-09',
      value: 5000,
      entered_by: 'test-user-id',
      is_auto_populated: false,
    });
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('allows null value', async () => {
    mockClient({
      tables: { l10_scorecard_entries: { data: null, error: null } },
    });

    const result = await upsertScorecardEntry({
      measurableId: VALID_UUID_2,
      weekOf: '2026-03-09',
      value: null,
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid date format', async () => {
    mockClient();
    const result = await upsertScorecardEntry({
      measurableId: VALID_UUID_2,
      weekOf: 'not-a-date',
      value: 100,
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid UUID', async () => {
    mockClient();
    const result = await upsertScorecardEntry({
      measurableId: 'bad-uuid',
      weekOf: '2026-03-09',
      value: 100,
    });

    expect(result.success).toBe(false);
  });

  it('returns error on database failure', async () => {
    mockClient({
      tables: { l10_scorecard_entries: { data: null, error: { message: 'upsert failed' } } },
    });

    const result = await upsertScorecardEntry({
      measurableId: VALID_UUID_2,
      weekOf: '2026-03-09',
      value: 100,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('upsert failed');
  });
});

// ============================================
// autoPopulateScorecardWeek
// ============================================

describe('autoPopulateScorecardWeek', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when no scorecard found', async () => {
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    // l10_scorecards → single returns null
    const scorecardChain = createMockL10Chain({ data: null, error: null });
    mockFrom.mockReturnValueOnce(scorecardChain);

    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await autoPopulateScorecardWeek(VALID_UUID, '2026-03-09');

    expect(result.success).toBe(false);
    expect(result.error).toBe('No scorecard found');
  });

  it('returns skipped when no auto-source measurables configured', async () => {
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    const scorecardChain = createMockL10Chain({ data: { id: SCORECARD_ID }, error: null });
    const measurablesChain = createMockL10Chain({ data: [], error: null });

    mockFrom
      .mockReturnValueOnce(scorecardChain)
      .mockReturnValueOnce(measurablesChain);

    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await autoPopulateScorecardWeek(VALID_UUID, '2026-03-09');

    expect(result.success).toBe(true);
    expect(result.data?.populated).toBe(0);
    expect(result.data?.skipped).toContain('No auto-source measurables configured');
  });

  it('populates po_revenue from projects table', async () => {
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    const scorecardChain = createMockL10Chain({ data: { id: SCORECARD_ID }, error: null });
    const measurablesChain = createMockL10Chain({
      data: [{ id: VALID_UUID_2, title: 'PO Revenue', auto_source: 'po_revenue', odoo_account_code: null, odoo_date_mode: null }],
      error: null,
    });
    const projectsChain = createMockL10Chain({
      data: [{ sales_amount: 5000 }, { sales_amount: 3000 }],
      error: null,
    });
    const upsertChain = createMockL10Chain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(scorecardChain)
      .mockReturnValueOnce(measurablesChain)
      .mockReturnValueOnce(projectsChain)
      .mockReturnValueOnce(upsertChain);

    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await autoPopulateScorecardWeek(VALID_UUID, '2026-03-09');

    expect(result.success).toBe(true);
    expect(result.data?.populated).toBe(1);
    expect(result.data?.errors).toEqual([]);
  });

  it('populates invoiced_revenue from projects table', async () => {
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    const scorecardChain = createMockL10Chain({ data: { id: SCORECARD_ID }, error: null });
    const measurablesChain = createMockL10Chain({
      data: [{ id: VALID_UUID_2, title: 'Invoiced Revenue', auto_source: 'invoiced_revenue', odoo_account_code: null, odoo_date_mode: null }],
      error: null,
    });
    const projectsChain = createMockL10Chain({
      data: [{ sales_amount: 7500 }],
      error: null,
    });
    const upsertChain = createMockL10Chain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(scorecardChain)
      .mockReturnValueOnce(measurablesChain)
      .mockReturnValueOnce(projectsChain)
      .mockReturnValueOnce(upsertChain);

    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await autoPopulateScorecardWeek(VALID_UUID, '2026-03-09');

    expect(result.success).toBe(true);
    expect(result.data?.populated).toBe(1);
  });

  it('populates open_projects count', async () => {
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    const scorecardChain = createMockL10Chain({ data: { id: SCORECARD_ID }, error: null });
    const measurablesChain = createMockL10Chain({
      data: [{ id: VALID_UUID_2, title: 'Open Projects', auto_source: 'open_projects', odoo_account_code: null, odoo_date_mode: null }],
      error: null,
    });
    const countChain = createMockL10Chain({ data: null, error: null });
    // Override to return count
    countChain.select = vi.fn().mockImplementation(() => {
      const thenable = Object.create(countChain);
      thenable.then = (resolve: (v: unknown) => void) =>
        Promise.resolve({ count: 12, data: null, error: null }).then(resolve);
      return thenable;
    });
    const upsertChain = createMockL10Chain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(scorecardChain)
      .mockReturnValueOnce(measurablesChain)
      .mockReturnValueOnce(countChain)
      .mockReturnValueOnce(upsertChain);

    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await autoPopulateScorecardWeek(VALID_UUID, '2026-03-09');

    expect(result.success).toBe(true);
    expect(result.data?.populated).toBe(1);
  });

  it('populates odoo_quotes when Odoo is configured', async () => {
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    const scorecardChain = createMockL10Chain({ data: { id: SCORECARD_ID }, error: null });
    const measurablesChain = createMockL10Chain({
      data: [{ id: VALID_UUID_2, title: 'Open Quotes', auto_source: 'odoo_quotes', odoo_account_code: null, odoo_date_mode: null }],
      error: null,
    });
    const upsertChain = createMockL10Chain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(scorecardChain)
      .mockReturnValueOnce(measurablesChain)
      .mockReturnValueOnce(upsertChain);

    vi.mocked(isOdooConfigured).mockReturnValue(true);
    const mockOdooClient = {} as never;
    vi.mocked(getOdooClient).mockReturnValue(mockOdooClient);
    vi.mocked(getOpenQuotesTotal).mockResolvedValue(45000);

    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await autoPopulateScorecardWeek(VALID_UUID, '2026-03-09');

    expect(result.success).toBe(true);
    expect(result.data?.populated).toBe(1);
    expect(getOpenQuotesTotal).toHaveBeenCalledWith(mockOdooClient, '2026-03-13');
  });

  it('skips odoo_quotes when Odoo not configured', async () => {
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    const scorecardChain = createMockL10Chain({ data: { id: SCORECARD_ID }, error: null });
    const measurablesChain = createMockL10Chain({
      data: [{ id: VALID_UUID_2, title: 'Open Quotes', auto_source: 'odoo_quotes', odoo_account_code: null, odoo_date_mode: null }],
      error: null,
    });

    mockFrom
      .mockReturnValueOnce(scorecardChain)
      .mockReturnValueOnce(measurablesChain);

    vi.mocked(isOdooConfigured).mockReturnValue(false);
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await autoPopulateScorecardWeek(VALID_UUID, '2026-03-09');

    expect(result.success).toBe(true);
    expect(result.data?.populated).toBe(0);
    expect(result.data?.skipped).toContain('Open Quotes: Odoo not configured');
  });

  it('populates odoo_account with date_range mode', async () => {
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    const scorecardChain = createMockL10Chain({ data: { id: SCORECARD_ID }, error: null });
    const measurablesChain = createMockL10Chain({
      data: [{
        id: VALID_UUID_2,
        title: 'AR Movement',
        auto_source: 'odoo_account',
        odoo_account_code: '1200',
        odoo_date_mode: 'date_range',
      }],
      error: null,
    });
    const upsertChain = createMockL10Chain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(scorecardChain)
      .mockReturnValueOnce(measurablesChain)
      .mockReturnValueOnce(upsertChain);

    vi.mocked(isOdooConfigured).mockReturnValue(true);
    const mockOdooClient = {} as never;
    vi.mocked(getOdooClient).mockReturnValue(mockOdooClient);
    vi.mocked(getAccountMovement).mockResolvedValue(12500);

    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await autoPopulateScorecardWeek(VALID_UUID, '2026-03-09');

    expect(result.success).toBe(true);
    expect(result.data?.populated).toBe(1);
    // weekOf is Monday 2026-03-09; Saturday before is 2026-03-07; Friday is 2026-03-13
    expect(getAccountMovement).toHaveBeenCalledWith(mockOdooClient, '1200', '2026-03-07', '2026-03-13');
  });

  it('populates odoo_account with last_day mode', async () => {
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    const scorecardChain = createMockL10Chain({ data: { id: SCORECARD_ID }, error: null });
    const measurablesChain = createMockL10Chain({
      data: [{
        id: VALID_UUID_2,
        title: 'AR Balance',
        auto_source: 'odoo_account',
        odoo_account_code: '1200',
        odoo_date_mode: 'last_day',
      }],
      error: null,
    });
    const upsertChain = createMockL10Chain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(scorecardChain)
      .mockReturnValueOnce(measurablesChain)
      .mockReturnValueOnce(upsertChain);

    vi.mocked(isOdooConfigured).mockReturnValue(true);
    const mockOdooClient = {} as never;
    vi.mocked(getOdooClient).mockReturnValue(mockOdooClient);
    vi.mocked(getAccountBalance).mockResolvedValue(98000);

    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await autoPopulateScorecardWeek(VALID_UUID, '2026-03-09');

    expect(result.success).toBe(true);
    expect(result.data?.populated).toBe(1);
    // Friday of week starting 2026-03-09 is 2026-03-13
    expect(getAccountBalance).toHaveBeenCalledWith(mockOdooClient, '1200', '2026-03-13');
  });

  it('skips odoo_account when missing account code', async () => {
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    const scorecardChain = createMockL10Chain({ data: { id: SCORECARD_ID }, error: null });
    const measurablesChain = createMockL10Chain({
      data: [{
        id: VALID_UUID_2,
        title: 'Bad Config',
        auto_source: 'odoo_account',
        odoo_account_code: null,
        odoo_date_mode: 'last_day',
      }],
      error: null,
    });

    mockFrom
      .mockReturnValueOnce(scorecardChain)
      .mockReturnValueOnce(measurablesChain);

    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await autoPopulateScorecardWeek(VALID_UUID, '2026-03-09');

    expect(result.success).toBe(true);
    expect(result.data?.populated).toBe(0);
    expect(result.data?.skipped).toContain('Bad Config: missing Odoo account code or date mode');
  });

  it('skips odoo_account when missing date mode', async () => {
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    const scorecardChain = createMockL10Chain({ data: { id: SCORECARD_ID }, error: null });
    const measurablesChain = createMockL10Chain({
      data: [{
        id: VALID_UUID_2,
        title: 'No Mode',
        auto_source: 'odoo_account',
        odoo_account_code: '1200',
        odoo_date_mode: null,
      }],
      error: null,
    });

    mockFrom
      .mockReturnValueOnce(scorecardChain)
      .mockReturnValueOnce(measurablesChain);

    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await autoPopulateScorecardWeek(VALID_UUID, '2026-03-09');

    expect(result.success).toBe(true);
    expect(result.data?.populated).toBe(0);
    expect(result.data?.skipped).toContain('No Mode: missing Odoo account code or date mode');
  });

  it('records error and continues when Odoo API fails', async () => {
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    const scorecardChain = createMockL10Chain({ data: { id: SCORECARD_ID }, error: null });
    const measurablesChain = createMockL10Chain({
      data: [
        { id: VALID_UUID_2, title: 'Quotes', auto_source: 'odoo_quotes', odoo_account_code: null, odoo_date_mode: null },
        { id: VALID_UUID_3, title: 'PO Revenue', auto_source: 'po_revenue', odoo_account_code: null, odoo_date_mode: null },
      ],
      error: null,
    });
    // projects chain for po_revenue (after odoo_quotes fails)
    const projectsChain = createMockL10Chain({
      data: [{ sales_amount: 2000 }],
      error: null,
    });
    const upsertChain = createMockL10Chain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(scorecardChain)
      .mockReturnValueOnce(measurablesChain)
      .mockReturnValueOnce(projectsChain)
      .mockReturnValueOnce(upsertChain);

    vi.mocked(isOdooConfigured).mockReturnValue(true);
    vi.mocked(getOdooClient).mockReturnValue({} as never);
    vi.mocked(getOpenQuotesTotal).mockRejectedValue(new Error('Odoo connection timeout'));

    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await autoPopulateScorecardWeek(VALID_UUID, '2026-03-09');

    expect(result.success).toBe(true);
    expect(result.data?.populated).toBe(1); // po_revenue succeeded
    expect(result.data?.errors).toContain('Quotes: Odoo connection timeout');
  });

  it('handles po_revenue with no projects (zero sum)', async () => {
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    const scorecardChain = createMockL10Chain({ data: { id: SCORECARD_ID }, error: null });
    const measurablesChain = createMockL10Chain({
      data: [{ id: VALID_UUID_2, title: 'PO Revenue', auto_source: 'po_revenue', odoo_account_code: null, odoo_date_mode: null }],
      error: null,
    });
    const projectsChain = createMockL10Chain({ data: [], error: null });
    const upsertChain = createMockL10Chain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(scorecardChain)
      .mockReturnValueOnce(measurablesChain)
      .mockReturnValueOnce(projectsChain)
      .mockReturnValueOnce(upsertChain);

    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await autoPopulateScorecardWeek(VALID_UUID, '2026-03-09');

    expect(result.success).toBe(true);
    // value=0 is still not null, so it should be populated
    expect(result.data?.populated).toBe(1);
  });

  it('handles multiple measurables of different types', async () => {
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    const scorecardChain = createMockL10Chain({ data: { id: SCORECARD_ID }, error: null });
    const measurablesChain = createMockL10Chain({
      data: [
        { id: VALID_UUID, title: 'PO Revenue', auto_source: 'po_revenue', odoo_account_code: null, odoo_date_mode: null },
        { id: VALID_UUID_2, title: 'Invoiced', auto_source: 'invoiced_revenue', odoo_account_code: null, odoo_date_mode: null },
        { id: VALID_UUID_3, title: 'Open Count', auto_source: 'open_projects', odoo_account_code: null, odoo_date_mode: null },
      ],
      error: null,
    });

    // po_revenue projects query
    const poChain = createMockL10Chain({ data: [{ sales_amount: 1000 }], error: null });
    // invoiced_revenue projects query
    const invChain = createMockL10Chain({ data: [{ sales_amount: 2000 }], error: null });
    // open_projects count query
    const countChain = createMockL10Chain({ data: null, error: null });
    countChain.select = vi.fn().mockImplementation(() => {
      const thenable = Object.create(countChain);
      thenable.then = (resolve: (v: unknown) => void) =>
        Promise.resolve({ count: 5, data: null, error: null }).then(resolve);
      return thenable;
    });
    // 3 upsert calls
    const upsert1 = createMockL10Chain({ data: null, error: null });
    const upsert2 = createMockL10Chain({ data: null, error: null });
    const upsert3 = createMockL10Chain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(scorecardChain)
      .mockReturnValueOnce(measurablesChain)
      .mockReturnValueOnce(poChain)
      .mockReturnValueOnce(upsert1)
      .mockReturnValueOnce(invChain)
      .mockReturnValueOnce(upsert2)
      .mockReturnValueOnce(countChain)
      .mockReturnValueOnce(upsert3);

    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await autoPopulateScorecardWeek(VALID_UUID, '2026-03-09');

    expect(result.success).toBe(true);
    expect(result.data?.populated).toBe(3);
    expect(result.data?.errors).toEqual([]);
    expect(result.data?.skipped).toEqual([]);
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('skips odoo_account when Odoo not configured', async () => {
    const client = createMockL10Client();
    const mockFrom = vi.fn();
    (client.supabase as Record<string, unknown>).from = mockFrom;

    const scorecardChain = createMockL10Chain({ data: { id: SCORECARD_ID }, error: null });
    const measurablesChain = createMockL10Chain({
      data: [{
        id: VALID_UUID_2,
        title: 'AR Balance',
        auto_source: 'odoo_account',
        odoo_account_code: '1200',
        odoo_date_mode: 'last_day',
      }],
      error: null,
    });

    mockFrom
      .mockReturnValueOnce(scorecardChain)
      .mockReturnValueOnce(measurablesChain);

    vi.mocked(isOdooConfigured).mockReturnValue(false);
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await autoPopulateScorecardWeek(VALID_UUID, '2026-03-09');

    expect(result.success).toBe(true);
    expect(result.data?.populated).toBe(0);
    expect(result.data?.skipped).toContain('AR Balance: Odoo not configured');
  });
});
