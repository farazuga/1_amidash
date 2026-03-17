import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../account-lookup/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/odoo', () => ({
  getOdooClient: vi.fn(),
  isOdooConfigured: vi.fn(),
}));

vi.mock('@/lib/odoo/queries', () => ({
  findAccountByCode: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { getOdooClient, isOdooConfigured } from '@/lib/odoo';
import { findAccountByCode } from '@/lib/odoo/queries';

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockIsOdooConfigured = isOdooConfigured as ReturnType<typeof vi.fn>;
const mockGetOdooClient = getOdooClient as ReturnType<typeof vi.fn>;
const mockFindAccountByCode = findAccountByCode as ReturnType<typeof vi.fn>;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/odoo/account-lookup', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockAuthenticated() {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
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

describe('POST /api/odoo/account-lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOdooClient.mockReturnValue({});
  });

  it('returns 401 when user is not authenticated', async () => {
    mockUnauthenticated();

    const response = await POST(makeRequest({ accountCode: 'ACC001' }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 200 with error when Odoo is not configured', async () => {
    mockAuthenticated();
    mockIsOdooConfigured.mockReturnValue(false);

    const response = await POST(makeRequest({ accountCode: 'ACC001' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.error).toBe('Odoo is not configured');
  });

  it('returns 400 when accountCode is missing', async () => {
    mockAuthenticated();
    mockIsOdooConfigured.mockReturnValue(true);

    const response = await POST(makeRequest({}));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('accountCode is required');
  });

  it('returns 400 when accountCode is not a string', async () => {
    mockAuthenticated();
    mockIsOdooConfigured.mockReturnValue(true);

    const response = await POST(makeRequest({ accountCode: 123 }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('accountCode is required');
  });

  it('returns 400 when accountCode is empty after trimming', async () => {
    mockAuthenticated();
    mockIsOdooConfigured.mockReturnValue(true);

    const response = await POST(makeRequest({ accountCode: '   ' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid account code');
  });

  it('returns 400 when accountCode exceeds 20 characters', async () => {
    mockAuthenticated();
    mockIsOdooConfigured.mockReturnValue(true);

    const response = await POST(makeRequest({ accountCode: 'A'.repeat(21) }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid account code');
  });

  it('returns 404 when account is not found', async () => {
    mockAuthenticated();
    mockIsOdooConfigured.mockReturnValue(true);
    mockFindAccountByCode.mockResolvedValue(null);

    const response = await POST(makeRequest({ accountCode: 'NOPE' }));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('NOPE');
    expect(data.error).toContain('not found');
  });

  it('returns account data on success', async () => {
    mockAuthenticated();
    mockIsOdooConfigured.mockReturnValue(true);
    mockFindAccountByCode.mockResolvedValue({ code: 'ACC001', name: 'Sales Revenue' });

    const response = await POST(makeRequest({ accountCode: 'ACC001' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.accountCode).toBe('ACC001');
    expect(data.accountName).toBe('Sales Revenue');
  });

  it('trims the accountCode before lookup', async () => {
    mockAuthenticated();
    mockIsOdooConfigured.mockReturnValue(true);
    mockFindAccountByCode.mockResolvedValue({ code: 'ACC001', name: 'Sales Revenue' });

    await POST(makeRequest({ accountCode: '  ACC001  ' }));

    expect(mockFindAccountByCode).toHaveBeenCalledWith(expect.anything(), 'ACC001');
  });

  it('returns 500 on unexpected errors', async () => {
    mockAuthenticated();
    mockIsOdooConfigured.mockReturnValue(true);
    mockFindAccountByCode.mockRejectedValue(new Error('Connection failed'));

    const response = await POST(makeRequest({ accountCode: 'ACC001' }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Connection failed');
  });
});
