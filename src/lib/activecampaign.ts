import type {
  ACAccount,
  ACContact,
  ACAccountSearchResponse,
  ACContactsResponse,
} from '@/types/activecampaign';

class ActiveCampaignClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(accountName: string, apiKey: string) {
    this.baseUrl = `https://${accountName}.api-us1.com/api/3`;
    this.apiKey = apiKey;
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Api-Token': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`ActiveCampaign API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  async searchAccounts(searchTerm: string, limit: number = 10): Promise<ACAccount[]> {
    const encoded = encodeURIComponent(searchTerm);
    const data = await this.fetch<ACAccountSearchResponse>(
      `/accounts?search=${encoded}&limit=${limit}`
    );
    return data.accounts || [];
  }

  async getAccount(accountId: string): Promise<ACAccount | null> {
    try {
      const data = await this.fetch<{ account: ACAccount }>(`/accounts/${accountId}`);
      return data.account || null;
    } catch {
      return null;
    }
  }

  async getContactsForAccount(accountId: string, limit: number = 50): Promise<ACContact[]> {
    // First get accountContacts associations
    const associationsData = await this.fetch<{
      accountContacts: Array<{ contact: string; account: string }>;
    }>(`/accountContacts?filters[account]=${accountId}&limit=${limit}`);

    if (!associationsData.accountContacts?.length) {
      return [];
    }

    // Get full contact details for each associated contact in parallel
    const contactIds = associationsData.accountContacts.map(ac => ac.contact);

    const contactPromises = contactIds.map(async (contactId) => {
      try {
        const contactData = await this.fetch<{ contact: ACContact }>(`/contacts/${contactId}`);
        return contactData.contact || null;
      } catch {
        // Skip contacts that fail to load
        return null;
      }
    });

    const results = await Promise.all(contactPromises);
    return results.filter((contact): contact is ACContact => contact !== null);
  }

  async searchContacts(searchTerm: string, limit: number = 20): Promise<ACContact[]> {
    const encoded = encodeURIComponent(searchTerm);
    const data = await this.fetch<{ contacts: ACContact[] }>(
      `/contacts?search=${encoded}&limit=${limit}`
    );
    return data.contacts || [];
  }

  getAccountUrl(accountId: string): string {
    // Extract account name from base URL
    const match = this.baseUrl.match(/https:\/\/([^.]+)\.api-us1\.com/);
    const accountName = match?.[1] || '';
    return `https://${accountName}.activehosted.com/app/accounts/${accountId}`;
  }
}

let clientInstance: ActiveCampaignClient | null = null;

export function getActiveCampaignClient(): ActiveCampaignClient {
  if (!clientInstance) {
    const accountName = process.env.ACTIVECAMPAIGN_ACCOUNT_NAME;
    const apiKey = process.env.ACTIVECAMPAIGN_API_KEY;

    if (!accountName) {
      throw new Error('ACTIVECAMPAIGN_ACCOUNT_NAME environment variable is not set');
    }
    if (!apiKey) {
      throw new Error('ACTIVECAMPAIGN_API_KEY environment variable is not set');
    }

    clientInstance = new ActiveCampaignClient(accountName, apiKey);
  }
  return clientInstance;
}

export function isActiveCampaignConfigured(): boolean {
  return !!(
    process.env.ACTIVECAMPAIGN_ACCOUNT_NAME &&
    process.env.ACTIVECAMPAIGN_API_KEY
  );
}

// Reset client instance (useful for testing)
export function resetActiveCampaignClient(): void {
  clientInstance = null;
}
