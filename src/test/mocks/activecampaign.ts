import { vi } from 'vitest';
import type { ACAccount, ACContact } from '@/types/activecampaign';

export const mockAccounts: ACAccount[] = [
  {
    id: '1',
    name: 'Acme Corporation',
    accountUrl: 'https://test.activehosted.com/app/accounts/1',
    contactCount: '3',
    dealCount: '2',
  },
  {
    id: '2',
    name: 'Beta Industries',
    accountUrl: 'https://test.activehosted.com/app/accounts/2',
    contactCount: '5',
    dealCount: '1',
  },
];

export const mockContacts: ACContact[] = [
  {
    id: '101',
    email: 'john@acme.com',
    phone: '555-123-4567',
    firstName: 'John',
    lastName: 'Doe',
  },
  {
    id: '102',
    email: 'jane@acme.com',
    phone: '555-987-6543',
    firstName: 'Jane',
    lastName: 'Smith',
  },
  {
    id: '103',
    email: 'bob@acme.com',
    phone: '',
    firstName: 'Bob',
    lastName: '',
  },
];

export function createMockActiveCampaignClient() {
  return {
    searchAccounts: vi.fn().mockResolvedValue(mockAccounts),
    getContactsForAccount: vi.fn().mockResolvedValue(mockContacts),
    getAccount: vi.fn().mockResolvedValue(mockAccounts[0]),
    getAccountUrl: vi.fn().mockReturnValue('https://test.activehosted.com/app/accounts/1'),
  };
}

export function mockActiveCampaignModule() {
  return {
    getActiveCampaignClient: vi.fn().mockReturnValue(createMockActiveCampaignClient()),
    isActiveCampaignConfigured: vi.fn().mockReturnValue(true),
    resetActiveCampaignClient: vi.fn(),
  };
}
