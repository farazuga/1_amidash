import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../activities/route';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/odoo', () => ({
  getOdooClient: vi.fn(),
  isOdooConfigured: vi.fn(),
}));

vi.mock('@/lib/odoo/queries', () => ({
  findOdooUserByEmail: vi.fn(),
  getUserActivities: vi.fn(),
  getActivitiesAssignedByUser: vi.fn(),
  buildOdooRecordUrl: vi.fn(),
  odooMany2oneName: vi.fn((v: unknown) => (v === false ? null : (v as [number, string])[1])),
  odooFalseToNull: vi.fn((v: unknown) => (v === false ? null : v)),
}));

import { createClient } from '@/lib/supabase/server';
import { isOdooConfigured } from '@/lib/odoo';
import {
  findOdooUserByEmail,
  getUserActivities,
  getActivitiesAssignedByUser,
  buildOdooRecordUrl,
} from '@/lib/odoo/queries';

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockIsOdooConfigured = isOdooConfigured as ReturnType<typeof vi.fn>;
const mockFindOdooUserByEmail = findOdooUserByEmail as ReturnType<typeof vi.fn>;
const mockGetUserActivities = getUserActivities as ReturnType<typeof vi.fn>;
const mockGetActivitiesAssignedByUser = getActivitiesAssignedByUser as ReturnType<typeof vi.fn>;
const mockBuildOdooRecordUrl = buildOdooRecordUrl as ReturnType<typeof vi.fn>;

function mockAuthenticated(email?: string) {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1', email: email ?? 'test@example.com' } },
      }),
    },
  });
}

function mockUnauthenticated() {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
  });
}

describe('GET /api/odoo/activities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ODOO_URL = 'https://test.odoo.com';
  });

  it('returns 401 when user is not authenticated', async () => {
    mockUnauthenticated();

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns empty arrays with configured=false when Odoo is not configured', async () => {
    mockAuthenticated();
    mockIsOdooConfigured.mockReturnValue(false);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      myActivities: [],
      assignedByMe: [],
      configured: false,
    });
  });

  it('returns empty arrays when user has no email', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } }, // no email property
        }),
      },
    });
    mockIsOdooConfigured.mockReturnValue(true);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      myActivities: [],
      assignedByMe: [],
      configured: true,
    });
  });

  it('returns empty arrays when no matching Odoo user found', async () => {
    mockAuthenticated('nobody@example.com');
    mockIsOdooConfigured.mockReturnValue(true);
    mockFindOdooUserByEmail.mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      myActivities: [],
      assignedByMe: [],
      configured: true,
    });
  });

  it('returns transformed activities on success', async () => {
    mockAuthenticated('jane@example.com');
    mockIsOdooConfigured.mockReturnValue(true);
    mockFindOdooUserByEmail.mockResolvedValue({ id: 10, login: 'jane@example.com', name: 'Jane' });

    const myActivity = {
      id: 1,
      summary: 'Follow up call',
      note: false,
      date_deadline: '2026-04-01',
      activity_type_id: [1, 'To Do'],
      user_id: [10, 'Jane'],
      create_uid: [5, 'Boss'],
      res_model: 'sale.order',
      res_id: 42,
      res_name: 'S10001',
    };

    const assignedActivity = {
      id: 2,
      summary: false,
      note: false,
      date_deadline: false,
      activity_type_id: [2, 'Email'],
      user_id: [20, 'Bob'],
      create_uid: [10, 'Jane'],
      res_model: 'res.partner',
      res_id: 99,
      res_name: 'Acme Corp',
    };

    mockGetUserActivities.mockResolvedValue([myActivity]);
    mockGetActivitiesAssignedByUser.mockResolvedValue([assignedActivity]);
    mockBuildOdooRecordUrl.mockImplementation(
      (base: string, model: string, id: number) => `${base}/odoo/${model}/${id}`
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.configured).toBe(true);
    expect(data.myActivities).toHaveLength(1);
    expect(data.myActivities[0]).toEqual({
      id: 1,
      name: 'Follow up call',
      type: 'To Do',
      deadline: '2026-04-01',
      assignedBy: 'Boss',
      assignedTo: 'Jane',
      recordName: 'S10001',
      recordModel: 'sale.order',
      odooUrl: 'https://test.odoo.com/odoo/sale.order/42',
    });

    expect(data.assignedByMe).toHaveLength(1);
    expect(data.assignedByMe[0]).toEqual({
      id: 2,
      name: 'Acme Corp', // falls back to res_name since summary is false
      type: 'Email',
      deadline: null,
      assignedBy: 'Jane',
      assignedTo: 'Bob',
      recordName: 'Acme Corp',
      recordModel: 'res.partner',
      odooUrl: 'https://test.odoo.com/odoo/res.partner/99',
    });
  });

  it('uses "Untitled Activity" when summary and res_name are both false', async () => {
    mockAuthenticated('jane@example.com');
    mockIsOdooConfigured.mockReturnValue(true);
    mockFindOdooUserByEmail.mockResolvedValue({ id: 10, login: 'jane@example.com', name: 'Jane' });

    const activity = {
      id: 3,
      summary: false,
      note: false,
      date_deadline: false,
      activity_type_id: false,
      user_id: false,
      create_uid: false,
      res_model: 'sale.order',
      res_id: 1,
      res_name: false,
    };

    mockGetUserActivities.mockResolvedValue([activity]);
    mockGetActivitiesAssignedByUser.mockResolvedValue([]);
    mockBuildOdooRecordUrl.mockReturnValue('https://test.odoo.com/odoo/sale.order/1');

    const response = await GET();
    const data = await response.json();

    expect(data.myActivities[0].name).toBe('Untitled Activity');
    expect(data.myActivities[0].type).toBe('Activity'); // fallback when activity_type_id is false
  });

  it('returns 500 on unexpected errors', async () => {
    mockAuthenticated();
    mockIsOdooConfigured.mockReturnValue(true);
    mockFindOdooUserByEmail.mockRejectedValue(new Error('Odoo timeout'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('An internal error occurred. Please try again.');
  });
});
