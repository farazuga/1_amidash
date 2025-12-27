import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../accounts/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/activecampaign', () => ({
  getActiveCampaignClient: vi.fn(),
  isActiveCampaignConfigured: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { getActiveCampaignClient, isActiveCampaignConfigured } from '@/lib/activecampaign';

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockGetActiveCampaignClient = getActiveCampaignClient as ReturnType<typeof vi.fn>;
const mockIsActiveCampaignConfigured = isActiveCampaignConfigured as ReturnType<typeof vi.fn>;

describe('GET /api/activecampaign/accounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });

    const request = new NextRequest('http://localhost/api/activecampaign/accounts?search=test');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns empty accounts when AC is not configured', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
    });
    mockIsActiveCampaignConfigured.mockReturnValue(false);

    const request = new NextRequest('http://localhost/api/activecampaign/accounts?search=test');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.accounts).toEqual([]);
  });

  it('returns empty accounts when search term is less than 2 characters', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
    });
    mockIsActiveCampaignConfigured.mockReturnValue(true);

    const request = new NextRequest('http://localhost/api/activecampaign/accounts?search=a');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.accounts).toEqual([]);
  });

  it('returns accounts when search is successful', async () => {
    const mockAccounts = [
      { id: '1', name: 'Acme Corp', contactCount: '5', dealCount: '2', accountUrl: null },
    ];

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
    });
    mockIsActiveCampaignConfigured.mockReturnValue(true);
    mockGetActiveCampaignClient.mockReturnValue({
      searchAccounts: vi.fn().mockResolvedValue(mockAccounts),
      getAccountUrl: vi.fn().mockReturnValue('https://test.activehosted.com/app/accounts/1'),
    });

    const request = new NextRequest('http://localhost/api/activecampaign/accounts?search=Acme');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.accounts).toHaveLength(1);
    expect(data.accounts[0].name).toBe('Acme Corp');
    expect(data.accounts[0].accountUrl).toBe('https://test.activehosted.com/app/accounts/1');
  });

  it('handles API errors gracefully', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
    });
    mockIsActiveCampaignConfigured.mockReturnValue(true);
    mockGetActiveCampaignClient.mockReturnValue({
      searchAccounts: vi.fn().mockRejectedValue(new Error('API Error')),
    });

    const request = new NextRequest('http://localhost/api/activecampaign/accounts?search=test');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to search accounts');
  });
});
