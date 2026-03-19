import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../partners/route';
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
  searchPartners: vi.fn(),
  parseStateCode: vi.fn((v: unknown) => (v === false ? null : (v as [number, string])?.[1] ?? null)),
  parseCountryCode: vi.fn((v: unknown) => (v === false ? null : (v as [number, string])?.[1] ?? null)),
}));

import { createClient } from '@/lib/supabase/server';
import { isOdooConfigured } from '@/lib/odoo';
import { searchPartners } from '@/lib/odoo/queries';

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockIsOdooConfigured = isOdooConfigured as ReturnType<typeof vi.fn>;
const mockSearchPartners = searchPartners as ReturnType<typeof vi.fn>;

function makeGetRequest(query?: string) {
  const url = query
    ? `http://localhost/api/odoo/partners?q=${encodeURIComponent(query)}`
    : 'http://localhost/api/odoo/partners';
  return new NextRequest(url, { method: 'GET' });
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

describe('GET /api/odoo/partners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    mockUnauthenticated();

    const response = await GET(makeGetRequest('acme'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns empty partners when Odoo is not configured', async () => {
    mockAuthenticated();
    mockIsOdooConfigured.mockReturnValue(false);

    const response = await GET(makeGetRequest('acme'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ partners: [] });
  });

  it('returns empty partners when query is missing', async () => {
    mockAuthenticated();
    mockIsOdooConfigured.mockReturnValue(true);

    const response = await GET(makeGetRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ partners: [] });
  });

  it('returns empty partners when query is shorter than 2 characters', async () => {
    mockAuthenticated();
    mockIsOdooConfigured.mockReturnValue(true);

    const response = await GET(makeGetRequest('a'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ partners: [] });
  });

  it('returns mapped partner data on success', async () => {
    mockAuthenticated();
    mockIsOdooConfigured.mockReturnValue(true);
    mockSearchPartners.mockResolvedValue([
      {
        id: 1,
        name: 'Acme Corp',
        email: 'info@acme.com',
        phone: '555-1234',
        is_company: true,
        street: '123 Main St',
        city: 'Springfield',
        state_id: [1, 'IL'],
        zip: '62701',
        country_id: [2, 'US'],
      },
    ]);

    const response = await GET(makeGetRequest('acme'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.partners).toHaveLength(1);
    expect(data.partners[0]).toEqual({
      id: 1,
      name: 'Acme Corp',
      email: 'info@acme.com',
      phone: '555-1234',
      isCompany: true,
      address: {
        street: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
        country: 'US',
      },
    });
  });

  it('returns null address when partner has no street', async () => {
    mockAuthenticated();
    mockIsOdooConfigured.mockReturnValue(true);
    mockSearchPartners.mockResolvedValue([
      {
        id: 2,
        name: 'No Address Co',
        email: false,
        phone: false,
        is_company: true,
        street: '',
        city: '',
        state_id: false,
        zip: '',
        country_id: false,
      },
    ]);

    const response = await GET(makeGetRequest('no address'));
    const data = await response.json();

    expect(data.partners[0].address).toBeNull();
    expect(data.partners[0].email).toBeNull();
    expect(data.partners[0].phone).toBeNull();
  });

  it('handles partner with partial address (no state/country)', async () => {
    mockAuthenticated();
    mockIsOdooConfigured.mockReturnValue(true);
    mockSearchPartners.mockResolvedValue([
      {
        id: 3,
        name: 'Partial Co',
        email: 'partial@co.com',
        phone: '',
        is_company: false,
        street: '456 Oak Ave',
        city: '',
        state_id: false,
        zip: '',
        country_id: false,
      },
    ]);

    const response = await GET(makeGetRequest('partial'));
    const data = await response.json();

    expect(data.partners[0].address).toEqual({
      street: '456 Oak Ave',
      city: null,
      state: null,
      zip: null,
      country: null,
    });
    expect(data.partners[0].phone).toBeNull();
  });

  it('returns 500 on unexpected errors', async () => {
    mockAuthenticated();
    mockIsOdooConfigured.mockReturnValue(true);
    mockSearchPartners.mockRejectedValue(new Error('Search failed'));

    const response = await GET(makeGetRequest('acme'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('An internal error occurred. Please try again.');
  });
});
