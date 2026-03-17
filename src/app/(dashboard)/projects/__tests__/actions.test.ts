import { describe, it, expect, vi, beforeEach } from 'vitest';

// Module mocks
vi.mock('@/lib/supabase/server');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/sharepoint/folder-operations', () => ({
  createProjectSharePointFolder: vi.fn(),
}));
vi.mock('@/app/(dashboard)/projects/[salesOrder]/files/actions', () => ({
  getGlobalSharePointConfig: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/microsoft-graph/sync', () => ({
  syncProjectAssignmentsToOutlook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/odoo', () => ({
  isOdooConfigured: vi.fn().mockReturnValue(true),
  getOdooClient: vi.fn().mockReturnValue({}),
}));
vi.mock('@/lib/odoo/queries', () => ({
  getInvoiceStatus: vi.fn().mockResolvedValue('invoiced'),
}));

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { syncProjectAssignmentsToOutlook } from '@/lib/microsoft-graph/sync';

import {
  updateProjectStatus,
  updateProjectDates,
  bulkUpdateScheduleStatus,
  updateProjectScheduleStatus,
  getProjectScheduledHours,
  getProjectBasicInfo,
  inlineEditProjectField,
  createProject,
  refreshOdooInvoiceStatus,
} from '../actions';

// ---------------------------------------------------------------------------
// Mock Supabase helper
// ---------------------------------------------------------------------------

type ChainResult = { data?: unknown; error?: unknown; count?: number | null };

function createChain(result: ChainResult = {}) {
  const chain: Record<string, unknown> = {};
  const methods = [
    'select', 'insert', 'update', 'delete',
    'eq', 'neq', 'in', 'order', 'single', 'maybeSingle', 'limit',
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  // Make the chain thenable so `await supabase.from(...).select()...` resolves
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve({
      data: result.data ?? null,
      error: result.error ?? null,
      count: result.count ?? null,
    }).then(resolve);
  return chain;
}

function createMockSupabase(user: Record<string, unknown> | null = { id: 'user-1' }) {
  const chains: Record<string, ReturnType<typeof createChain>> = {};

  const mock = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: 'not authenticated' },
      }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (!chains[table]) chains[table] = createChain();
      return chains[table];
    }),
    /** Set a fixed return value for a specific table */
    _setTable(table: string, result: ChainResult) {
      chains[table] = createChain(result);
    },
    /** Get the chain mock for a table (for assertions) */
    _getChain(table: string) {
      return chains[table];
    },
  };

  return mock;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let mockSupabase: ReturnType<typeof createMockSupabase>;

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabase = createMockSupabase();
  vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
});

// ======================= updateProjectStatus ===============================
describe('updateProjectStatus', () => {
  it('returns error when not authenticated', async () => {
    mockSupabase = createMockSupabase(null);
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await updateProjectStatus({
      projectId: 'p1',
      newStatusId: 's1',
    });

    expect(result).toEqual({ success: false, error: 'Authentication required' });
  });

  it('returns error when update fails', async () => {
    mockSupabase._setTable('projects', { error: { message: 'db error' } });

    const result = await updateProjectStatus({
      projectId: 'p1',
      newStatusId: 's1',
    });

    expect(result).toEqual({ success: false, error: 'Failed to update status' });
  });

  it('succeeds and creates status history + audit log', async () => {
    // projects table for status update
    mockSupabase._setTable('projects', { data: { sales_order_number: 'SO-100' } });

    const result = await updateProjectStatus({
      projectId: 'p1',
      newStatusId: 's2',
      currentStatusName: 'Active',
      newStatusName: 'Complete',
    });

    expect(result).toEqual({ success: true });

    // Verify from was called for status_history and audit_logs
    const fromCalls = mockSupabase.from.mock.calls.map((c: unknown[]) => c[0]);
    expect(fromCalls).toContain('status_history');
    expect(fromCalls).toContain('audit_logs');

    // Verify revalidation
    expect(revalidatePath).toHaveBeenCalledWith('/projects');
  });
});

// ======================= updateProjectDates ================================
describe('updateProjectDates', () => {
  it('returns error when not authenticated', async () => {
    mockSupabase = createMockSupabase(null);
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await updateProjectDates({
      projectId: 'p1',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });

    expect(result).toEqual({ success: false, error: 'Authentication required' });
  });

  it('returns error when project not found', async () => {
    mockSupabase._setTable('projects', { error: { message: 'not found' } });

    const result = await updateProjectDates({
      projectId: 'p1',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });

    expect(result).toEqual({ success: false, error: 'Project not found' });
  });

  it('succeeds and syncs to Outlook when both dates set', async () => {
    mockSupabase._setTable('projects', {
      data: { start_date: '2026-01-01', end_date: '2026-01-15', sales_order_number: 'SO-200' },
    });

    const result = await updateProjectDates({
      projectId: 'p1',
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    });

    expect(result).toEqual({ success: true });
    expect(syncProjectAssignmentsToOutlook).toHaveBeenCalledWith('p1');
    expect(revalidatePath).toHaveBeenCalledWith('/projects/SO-200');
    expect(revalidatePath).toHaveBeenCalledWith('/projects');
    expect(revalidatePath).toHaveBeenCalledWith('/project-calendar');
  });

  it('does not sync to Outlook when dates are null', async () => {
    mockSupabase._setTable('projects', {
      data: { start_date: null, end_date: null, sales_order_number: null },
    });

    const result = await updateProjectDates({
      projectId: 'p1',
      startDate: null,
      endDate: null,
    });

    expect(result).toEqual({ success: true });
    expect(syncProjectAssignmentsToOutlook).not.toHaveBeenCalled();
  });
});

// ======================= bulkUpdateScheduleStatus ==========================
describe('bulkUpdateScheduleStatus', () => {
  it('returns error when not authenticated', async () => {
    mockSupabase = createMockSupabase(null);
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await bulkUpdateScheduleStatus({
      projectIds: ['p1'],
      scheduleStatus: 'confirmed',
    });

    expect(result).toEqual({ success: false, error: 'Authentication required' });
  });

  it('returns error when user is not admin/editor', async () => {
    mockSupabase._setTable('profiles', { data: { role: 'viewer' } });

    const result = await bulkUpdateScheduleStatus({
      projectIds: ['p1'],
      scheduleStatus: 'confirmed',
    });

    expect(result).toEqual({ success: false, error: 'Insufficient permissions' });
  });

  it('returns error for empty project list', async () => {
    mockSupabase._setTable('profiles', { data: { role: 'admin' } });

    const result = await bulkUpdateScheduleStatus({
      projectIds: [],
      scheduleStatus: 'confirmed',
    });

    expect(result).toEqual({ success: false, error: 'No projects selected' });
  });

  it('returns error for invalid schedule status', async () => {
    mockSupabase._setTable('profiles', { data: { role: 'admin' } });

    const result = await bulkUpdateScheduleStatus({
      projectIds: ['p1'],
      scheduleStatus: 'invalid-status',
    });

    expect(result).toEqual({ success: false, error: 'Invalid schedule status' });
  });

  it('succeeds with valid data and admin role', async () => {
    mockSupabase._setTable('profiles', { data: { role: 'admin' } });
    mockSupabase._setTable('projects', { data: null, count: 3 });

    const result = await bulkUpdateScheduleStatus({
      projectIds: ['p1', 'p2', 'p3'],
      scheduleStatus: 'confirmed',
    });

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(3);
    expect(revalidatePath).toHaveBeenCalledWith('/projects');
    expect(revalidatePath).toHaveBeenCalledWith('/project-calendar');
  });

  it('succeeds with editor role and draft status', async () => {
    mockSupabase._setTable('profiles', { data: { role: 'editor' } });
    mockSupabase._setTable('projects', { data: null });

    const result = await bulkUpdateScheduleStatus({
      projectIds: ['p1'],
      scheduleStatus: 'draft',
    });

    expect(result.success).toBe(true);
  });

  it('accepts pending status', async () => {
    mockSupabase._setTable('profiles', { data: { role: 'admin' } });
    mockSupabase._setTable('projects', { data: null });

    const result = await bulkUpdateScheduleStatus({
      projectIds: ['p1'],
      scheduleStatus: 'pending',
    });

    expect(result.success).toBe(true);
  });
});

// ======================= updateProjectScheduleStatus =======================
describe('updateProjectScheduleStatus', () => {
  it('returns error when not authenticated', async () => {
    mockSupabase = createMockSupabase(null);
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await updateProjectScheduleStatus({
      projectId: 'p1',
      scheduleStatus: 'confirmed',
    });

    expect(result).toEqual({ success: false, error: 'Authentication required' });
  });

  it('returns error when user lacks permissions', async () => {
    mockSupabase._setTable('profiles', { data: { role: 'viewer' } });

    const result = await updateProjectScheduleStatus({
      projectId: 'p1',
      scheduleStatus: 'confirmed',
    });

    expect(result).toEqual({ success: false, error: 'Insufficient permissions' });
  });

  it('returns error when project not found', async () => {
    mockSupabase._setTable('profiles', { data: { role: 'admin' } });
    mockSupabase._setTable('projects', { data: null });

    const result = await updateProjectScheduleStatus({
      projectId: 'p1',
      scheduleStatus: 'confirmed',
    });

    expect(result).toEqual({ success: false, error: 'Project not found' });
  });

  it('returns error when project has no dates', async () => {
    mockSupabase._setTable('profiles', { data: { role: 'admin' } });
    mockSupabase._setTable('projects', {
      data: { id: 'p1', start_date: null, end_date: null, sales_order_number: 'SO-1' },
    });

    const result = await updateProjectScheduleStatus({
      projectId: 'p1',
      scheduleStatus: 'confirmed',
    });

    expect(result).toEqual({
      success: false,
      error: 'Project must have start and end dates to set schedule status',
    });
  });

  it('succeeds when project has dates and user is admin', async () => {
    mockSupabase._setTable('profiles', { data: { role: 'admin' } });
    mockSupabase._setTable('projects', {
      data: { id: 'p1', start_date: '2026-01-01', end_date: '2026-01-31', sales_order_number: 'SO-1' },
    });

    const result = await updateProjectScheduleStatus({
      projectId: 'p1',
      scheduleStatus: 'confirmed',
    });

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith('/projects/SO-1');
    expect(revalidatePath).toHaveBeenCalledWith('/projects');
    expect(revalidatePath).toHaveBeenCalledWith('/project-calendar');
  });
});

// ======================= getProjectScheduledHours ==========================
describe('getProjectScheduledHours', () => {
  it('returns zeros when no assignments', async () => {
    mockSupabase._setTable('project_assignments', { data: [] });

    const result = await getProjectScheduledHours('p1');

    expect(result).toEqual({
      success: true,
      data: { totalHours: 0, totalDays: 0, byEngineer: [] },
    });
  });

  it('returns error on db failure', async () => {
    mockSupabase._setTable('project_assignments', { error: { message: 'db error' } });

    const result = await getProjectScheduledHours('p1');

    expect(result).toEqual({ success: false, error: 'db error' });
  });

  it('calculates hours from assignment days with default times (07:00-16:00 = 9h)', async () => {
    mockSupabase._setTable('project_assignments', {
      data: [
        {
          id: 'a1',
          user_id: 'u1',
          user: { id: 'u1', full_name: 'Alice', email: 'alice@test.com' },
          assignment_days: [
            { work_date: '2026-01-05', start_time: '07:00', end_time: '16:00' },
            { work_date: '2026-01-06', start_time: '07:00', end_time: '16:00' },
          ],
        },
      ],
    });

    const result = await getProjectScheduledHours('p1');

    expect(result.success).toBe(true);
    expect(result.data!.totalHours).toBe(18);
    expect(result.data!.totalDays).toBe(2);
    expect(result.data!.byEngineer).toEqual([
      { userId: 'u1', userName: 'Alice', hours: 18, days: 2 },
    ]);
  });

  it('handles partial day hours (08:00-12:30 = 4.5h)', async () => {
    mockSupabase._setTable('project_assignments', {
      data: [
        {
          id: 'a1',
          user_id: 'u1',
          user: { id: 'u1', full_name: 'Bob', email: 'bob@test.com' },
          assignment_days: [
            { work_date: '2026-01-05', start_time: '08:00', end_time: '12:30' },
          ],
        },
      ],
    });

    const result = await getProjectScheduledHours('p1');

    expect(result.data!.totalHours).toBe(4.5);
    expect(result.data!.byEngineer[0].hours).toBe(4.5);
  });

  it('aggregates multiple engineers', async () => {
    mockSupabase._setTable('project_assignments', {
      data: [
        {
          id: 'a1',
          user_id: 'u1',
          user: { id: 'u1', full_name: 'Alice', email: 'alice@test.com' },
          assignment_days: [
            { work_date: '2026-01-05', start_time: '07:00', end_time: '16:00' },
          ],
        },
        {
          id: 'a2',
          user_id: 'u2',
          user: { id: 'u2', full_name: null, email: 'unknown@test.com' },
          assignment_days: [
            { work_date: '2026-01-05', start_time: '08:00', end_time: '12:00' },
            { work_date: '2026-01-06', start_time: '08:00', end_time: '12:00' },
          ],
        },
      ],
    });

    const result = await getProjectScheduledHours('p1');

    expect(result.data!.totalHours).toBe(17); // 9 + 4 + 4
    expect(result.data!.totalDays).toBe(3);
    expect(result.data!.byEngineer).toHaveLength(2);
    // second engineer has no full_name, falls back to email
    expect(result.data!.byEngineer[1].userName).toBe('unknown@test.com');
  });

  it('handles null assignment_days gracefully', async () => {
    mockSupabase._setTable('project_assignments', {
      data: [
        {
          id: 'a1',
          user_id: 'u1',
          user: { id: 'u1', full_name: 'Alice', email: 'alice@test.com' },
          assignment_days: null,
        },
      ],
    });

    const result = await getProjectScheduledHours('p1');

    expect(result.data!.totalHours).toBe(0);
    expect(result.data!.totalDays).toBe(0);
    expect(result.data!.byEngineer[0].hours).toBe(0);
    expect(result.data!.byEngineer[0].days).toBe(0);
  });

  it('uses default times when start_time or end_time is empty', async () => {
    mockSupabase._setTable('project_assignments', {
      data: [
        {
          id: 'a1',
          user_id: 'u1',
          user: { id: 'u1', full_name: 'Alice', email: 'alice@test.com' },
          assignment_days: [
            { work_date: '2026-01-05', start_time: '', end_time: '' },
          ],
        },
      ],
    });

    const result = await getProjectScheduledHours('p1');

    // empty string is falsy, so defaults to 07:00 and 16:00 = 9 hours
    expect(result.data!.totalHours).toBe(9);
  });
});

// ======================= getProjectBasicInfo ===============================
describe('getProjectBasicInfo', () => {
  it('returns project data on success', async () => {
    mockSupabase._setTable('projects', {
      data: {
        id: 'p1',
        client_name: 'Acme',
        sales_order_number: 'SO-100',
        sales_order_url: null,
        sales_amount: 5000,
      },
    });

    const result = await getProjectBasicInfo('SO-100');

    expect(result.success).toBe(true);
    expect(result.data!.client_name).toBe('Acme');
  });

  it('returns error on failure', async () => {
    mockSupabase._setTable('projects', { error: { message: 'not found' } });

    const result = await getProjectBasicInfo('SO-999');

    expect(result).toEqual({ success: false, error: 'not found' });
  });
});

// ======================= inlineEditProjectField ============================
describe('inlineEditProjectField', () => {
  it('returns error when not authenticated', async () => {
    mockSupabase = createMockSupabase(null);
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await inlineEditProjectField({
      projectId: 'p1',
      field: 'sales_amount',
      value: '5000',
    });

    expect(result).toEqual({ success: false, error: 'Authentication required' });
  });

  it('returns error for invalid field name', async () => {
    const result = await inlineEditProjectField({
      projectId: 'p1',
      field: 'nonexistent_field',
      value: 'test',
    });

    expect(result).toEqual({ success: false, error: 'Invalid field' });
  });

  it('returns error when project not found', async () => {
    mockSupabase._setTable('projects', { data: null });

    const result = await inlineEditProjectField({
      projectId: 'p1',
      field: 'sales_amount',
      value: '5000',
    });

    expect(result).toEqual({ success: false, error: 'Project not found' });
  });

  it('succeeds for a simple field (goal_date)', async () => {
    mockSupabase._setTable('projects', {
      data: {
        sales_order_number: 'SO-100',
        goal_completion_date: '2026-01-01',
        sales_amount: null,
        salesperson_id: null,
        start_date: null,
        end_date: null,
        sales_order_url: null,
        created_at: null,
        created_date: null,
        invoiced_date: null,
        project_description: null,
        odoo_invoice_status: null,
        odoo_last_synced_at: null,
      },
    });

    const result = await inlineEditProjectField({
      projectId: 'p1',
      field: 'goal_date',
      value: '2026-06-01',
    });

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith('/projects/SO-100');
  });

  it('parses sales_amount as a float', async () => {
    mockSupabase._setTable('projects', {
      data: {
        sales_order_number: 'SO-100',
        goal_completion_date: null,
        sales_amount: 1000,
        salesperson_id: null,
        start_date: null,
        end_date: null,
        sales_order_url: null,
        created_at: null,
        created_date: null,
        invoiced_date: null,
        project_description: null,
        odoo_invoice_status: null,
        odoo_last_synced_at: null,
      },
    });

    const result = await inlineEditProjectField({
      projectId: 'p1',
      field: 'sales_amount',
      value: '2500.50',
    });

    expect(result).toEqual({ success: true });

    // Verify update was called with parsed float
    const projectsChain = mockSupabase._getChain('projects');
    expect(projectsChain!.update).toHaveBeenCalled();
  });

  it('delegates status_id changes to updateProjectStatus', async () => {
    // Need projects chain for the status lookup and statuses chain
    mockSupabase._setTable('projects', { data: { current_status: { name: 'Active' } } });
    mockSupabase._setTable('statuses', { data: { name: 'Complete' } });

    const result = await inlineEditProjectField({
      projectId: 'p1',
      field: 'status_id',
      value: 'new-status-id',
    });

    // This delegates to updateProjectStatus which will also call from('projects')
    expect(result.success).toBe(true);
  });

  it('syncs to Outlook when start_date changes', async () => {
    mockSupabase._setTable('projects', {
      data: {
        sales_order_number: 'SO-100',
        goal_completion_date: null,
        sales_amount: null,
        salesperson_id: null,
        start_date: '2026-01-01',
        end_date: '2026-01-31',
        sales_order_url: null,
        created_at: null,
        created_date: null,
        invoiced_date: null,
        project_description: null,
        odoo_invoice_status: null,
        odoo_last_synced_at: null,
      },
    });

    const result = await inlineEditProjectField({
      projectId: 'p1',
      field: 'start_date',
      value: '2026-02-01',
    });

    expect(result).toEqual({ success: true });
    expect(syncProjectAssignmentsToOutlook).toHaveBeenCalledWith('p1');
  });
});

// ======================= createProject (draft flow) ========================
describe('createProject', () => {
  const baseDraftData = {
    client_name: 'Acme Corp',
    sales_order_number: null,
    sales_order_url: null,
    po_number: null,
    sales_amount: null,
    contract_type: 'T&M',
    goal_completion_date: null,
    salesperson_id: 'sales-1',
    poc_name: null,
    poc_email: null,
    poc_phone: null,
    secondary_poc_email: null,
    scope_link: null,
    project_type_id: 'pt-1',
    tags: [],
    is_draft: true,
  };

  it('returns error when not authenticated', async () => {
    mockSupabase = createMockSupabase(null);
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await createProject(baseDraftData);
    expect(result).toEqual({ success: false, error: 'Authentication required' });
  });

  it('returns error when Draft status not found', async () => {
    mockSupabase._setTable('statuses', { data: null });

    const result = await createProject(baseDraftData);
    expect(result).toEqual({ success: false, error: 'Draft status not found' });
  });

  it('returns error on insert failure', async () => {
    mockSupabase._setTable('statuses', { data: { id: 'draft-status-id' } });
    mockSupabase._setTable('projects', { error: { message: 'insert error' } });

    const result = await createProject(baseDraftData);
    expect(result).toEqual({ success: false, error: 'Failed to create draft project' });
  });

  it('creates a draft project successfully', async () => {
    mockSupabase._setTable('statuses', { data: { id: 'draft-status-id' } });
    mockSupabase._setTable('projects', {
      data: { id: 'new-project-id', sales_order_number: null, client_token: null },
    });

    const result = await createProject(baseDraftData);

    expect(result.success).toBe(true);
    expect(result.projectId).toBe('new-project-id');
    expect(revalidatePath).toHaveBeenCalledWith('/projects');
  });

  it('creates draft with tags', async () => {
    mockSupabase._setTable('statuses', { data: { id: 'draft-status-id' } });
    mockSupabase._setTable('projects', {
      data: { id: 'new-project-id', sales_order_number: 'SO-1', client_token: null },
    });

    const result = await createProject({
      ...baseDraftData,
      tags: ['tag-1', 'tag-2'],
    });

    expect(result.success).toBe(true);
    // project_tags insert should have been called
    const fromCalls = mockSupabase.from.mock.calls.map((c: unknown[]) => c[0]);
    expect(fromCalls).toContain('project_tags');
  });

  it('non-draft returns error without delivery address', async () => {
    const result = await createProject({
      ...baseDraftData,
      is_draft: false,
      delivery_street: '',
      delivery_city: '',
      delivery_state: '',
      delivery_zip: '',
    });

    expect(result).toEqual({
      success: false,
      error: 'Delivery address is required to create a project',
    });
  });
});

// ======================= refreshOdooInvoiceStatus ==========================
describe('refreshOdooInvoiceStatus', () => {
  it('returns error when not authenticated', async () => {
    mockSupabase = createMockSupabase(null);
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await refreshOdooInvoiceStatus('p1');
    expect(result).toEqual({ success: false, error: 'Authentication required' });
  });

  it('returns error when project not found', async () => {
    mockSupabase._setTable('projects', { data: null });

    const result = await refreshOdooInvoiceStatus('p1');
    expect(result).toEqual({ success: false, error: 'Project not found' });
  });

  it('returns error when no Odoo order linked', async () => {
    mockSupabase._setTable('projects', {
      data: { odoo_order_id: null, odoo_invoice_status: null, sales_order_number: 'SO-1' },
    });

    const result = await refreshOdooInvoiceStatus('p1');
    expect(result).toEqual({ success: false, error: 'No Odoo order linked to this project' });
  });

  it('succeeds and returns updated invoice status', async () => {
    mockSupabase._setTable('projects', {
      data: { odoo_order_id: 123, odoo_invoice_status: 'to invoice', sales_order_number: 'SO-1' },
    });

    const result = await refreshOdooInvoiceStatus('p1');

    expect(result.success).toBe(true);
    expect(result.invoiceStatus).toBe('invoiced');
    expect(result.syncedAt).toBeDefined();

    // Should have created audit log since status changed
    const fromCalls = mockSupabase.from.mock.calls.map((c: unknown[]) => c[0]);
    expect(fromCalls).toContain('audit_logs');
    expect(revalidatePath).toHaveBeenCalledWith('/projects/SO-1');
  });
});
