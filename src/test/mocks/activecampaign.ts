import { vi } from 'vitest';
import type { ACAccount, ACContact, ACDeal, ACDealStage, ACPipeline } from '@/types/activecampaign';

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

export const mockPipelines: ACPipeline[] = [
  { id: '1', title: 'Solution' },
  { id: '2', title: 'VidPod' },
];

export const mockDealStages: ACDealStage[] = [
  { id: '10', title: 'Verbal Commit', group: '1', order: '3' },
  { id: '11', title: 'Proposal Sent', group: '1', order: '2' },
];

export const mockDeals: ACDeal[] = [
  {
    id: '201',
    title: 'Acme Corp - Video Wall',
    value: '5000000',
    currency: 'usd',
    contact: '101',
    account: '1',
    stage: '10',
    group: '1',
    owner: '1',
    status: '0',
    cdate: '2026-02-15T10:00:00-06:00',
    mdate: '2026-03-01T14:00:00-06:00',
  },
  {
    id: '202',
    title: 'Beta Industries - Display',
    value: '12000000',
    currency: 'usd',
    contact: '102',
    account: '2',
    stage: '10',
    group: '1',
    owner: '1',
    status: '0',
    cdate: '2026-03-05T09:00:00-06:00',
    mdate: '2026-03-10T11:00:00-06:00',
  },
];

export function createMockActiveCampaignClient() {
  return {
    searchAccounts: vi.fn().mockResolvedValue(mockAccounts),
    getContactsForAccount: vi.fn().mockResolvedValue(mockContacts),
    getAccount: vi.fn().mockResolvedValue(mockAccounts[0]),
    getAccountUrl: vi.fn().mockReturnValue('https://test.activehosted.com/app/accounts/1'),
    getContact: vi.fn().mockResolvedValue(mockContacts[0]),
    getPipelines: vi.fn().mockResolvedValue(mockPipelines),
    getDealStages: vi.fn().mockResolvedValue(mockDealStages),
    getDeals: vi.fn().mockResolvedValue(mockDeals),
    getDealUrl: vi.fn().mockReturnValue('https://test.activehosted.com/app/deals/201'),
  };
}

export function mockActiveCampaignModule() {
  return {
    getActiveCampaignClient: vi.fn().mockReturnValue(createMockActiveCampaignClient()),
    isActiveCampaignConfigured: vi.fn().mockReturnValue(true),
    resetActiveCampaignClient: vi.fn(),
  };
}
