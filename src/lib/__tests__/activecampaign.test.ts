import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getActiveCampaignClient, isActiveCampaignConfigured, resetActiveCampaignClient } from '../activecampaign';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ActiveCampaign Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    resetActiveCampaignClient();
    process.env = {
      ...originalEnv,
      ACTIVECAMPAIGN_ACCOUNT_NAME: 'testaccount',
      ACTIVECAMPAIGN_API_KEY: 'test-api-key',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isActiveCampaignConfigured', () => {
    it('returns true when both env vars are set', () => {
      expect(isActiveCampaignConfigured()).toBe(true);
    });

    it('returns false when account name is missing', () => {
      delete process.env.ACTIVECAMPAIGN_ACCOUNT_NAME;
      expect(isActiveCampaignConfigured()).toBe(false);
    });

    it('returns false when API key is missing', () => {
      delete process.env.ACTIVECAMPAIGN_API_KEY;
      expect(isActiveCampaignConfigured()).toBe(false);
    });
  });

  describe('getActiveCampaignClient', () => {
    it('throws error when account name is not configured', () => {
      delete process.env.ACTIVECAMPAIGN_ACCOUNT_NAME;
      expect(() => getActiveCampaignClient()).toThrow(
        'ACTIVECAMPAIGN_ACCOUNT_NAME environment variable is not set'
      );
    });

    it('throws error when API key is not configured', () => {
      delete process.env.ACTIVECAMPAIGN_API_KEY;
      expect(() => getActiveCampaignClient()).toThrow(
        'ACTIVECAMPAIGN_API_KEY environment variable is not set'
      );
    });

    it('returns singleton instance', () => {
      const client1 = getActiveCampaignClient();
      const client2 = getActiveCampaignClient();
      expect(client1).toBe(client2);
    });
  });

  describe('searchAccounts', () => {
    it('searches accounts successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accounts: [
            { id: '1', name: 'Acme Corp', contactCount: '5', dealCount: '2', accountUrl: null },
          ],
        }),
      });

      const client = getActiveCampaignClient();
      const accounts = await client.searchAccounts('Acme');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://testaccount.api-us1.com/api/3/accounts?filters[name]=Acme&limit=10',
        expect.objectContaining({
          headers: {
            'Api-Token': 'test-api-key',
            'Content-Type': 'application/json',
          },
        })
      );
      expect(accounts).toHaveLength(1);
      expect(accounts[0].name).toBe('Acme Corp');
    });

    it('returns empty array on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const client = getActiveCampaignClient();
      await expect(client.searchAccounts('test')).rejects.toThrow('ActiveCampaign API error');
    });

    it('encodes search term properly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accounts: [] }),
      });

      const client = getActiveCampaignClient();
      await client.searchAccounts('Test & Company');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('filters[name]=Test%20%26%20Company'),
        expect.any(Object)
      );
    });
  });

  describe('getContactsForAccount', () => {
    it('fetches contacts for account successfully', async () => {
      // First call for account contacts associations
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accountContacts: [
            { contact: '101', account: '1' },
            { contact: '102', account: '1' },
          ],
        }),
      });

      // Contact detail calls
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contact: { id: '101', email: 'john@test.com', firstName: 'John', lastName: 'Doe', phone: '555-1234' },
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contact: { id: '102', email: 'jane@test.com', firstName: 'Jane', lastName: 'Smith', phone: '555-5678' },
        }),
      });

      const client = getActiveCampaignClient();
      const contacts = await client.getContactsForAccount('1');

      expect(contacts).toHaveLength(2);
      expect(contacts[0].email).toBe('john@test.com');
      expect(contacts[1].email).toBe('jane@test.com');
    });

    it('returns empty array when account has no contacts', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accountContacts: [] }),
      });

      const client = getActiveCampaignClient();
      const contacts = await client.getContactsForAccount('1');

      expect(contacts).toHaveLength(0);
    });
  });

  describe('getAccountUrl', () => {
    it('generates correct account URL', () => {
      const client = getActiveCampaignClient();
      const url = client.getAccountUrl('123');

      expect(url).toBe('https://testaccount.activehosted.com/app/accounts/123');
    });
  });
});
