# Upcoming Deals Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an "Upcoming Deals" page that pulls deals from ActiveCampaign's Solution pipeline (Verbal Commit stage only), displays them in a date-filterable table.

**Architecture:** Extend existing AC client with deal/pipeline/stage methods. New API route fetches and resolves deals. Server component page passes data to a client component with date range filtering.

**Tech Stack:** Next.js App Router, ActiveCampaign API v3, TypeScript, shadcn/ui, Tailwind CSS, Vitest

---

### Task 1: Add Deal Types

**Files:**
- Modify: `src/types/activecampaign.ts`

**Step 1: Add types to activecampaign.ts**

Append after the existing `ACContactsResponse` interface:

```typescript
export interface ACDeal {
  id: string;
  title: string;
  value: string;
  currency: string;
  contact: string;
  account: string;
  stage: string;
  group: string;
  owner: string;
  status: string;
  cdate: string;
  mdate: string;
  nextdate?: string;
}

export interface ACDealStage {
  id: string;
  title: string;
  group: string;
  order: string;
}

export interface ACPipeline {
  id: string;
  title: string;
}

export interface ACDealsResponse {
  deals: ACDeal[];
  meta?: {
    total: string;
  };
}

export interface ACDealStagesResponse {
  dealStages: ACDealStage[];
}

export interface ACPipelinesResponse {
  dealGroups: ACPipeline[];
}

// Display type with resolved names
export interface ACDealDisplay extends ACDeal {
  contactName: string;
  accountName: string;
}
```

**Step 2: Commit**

```bash
git add src/types/activecampaign.ts
git commit -m "feat: add ActiveCampaign deal, stage, and pipeline types"
```

---

### Task 2: Add Deal Methods to AC Client

**Files:**
- Modify: `src/lib/activecampaign.ts`

**Step 1: Add imports for new types**

Update the import at top of `src/lib/activecampaign.ts`:

```typescript
import type {
  ACAccount,
  ACContact,
  ACAccountSearchResponse,
  ACContactsResponse,
  ACDeal,
  ACDealStage,
  ACPipeline,
  ACDealsResponse,
  ACDealStagesResponse,
  ACPipelinesResponse,
} from '@/types/activecampaign';
```

**Step 2: Add methods to ActiveCampaignClient class**

Add these methods inside the `ActiveCampaignClient` class, after `getAccountUrl()`:

```typescript
  async getPipelines(): Promise<ACPipeline[]> {
    const data = await this.fetch<ACPipelinesResponse>('/dealGroups');
    return data.dealGroups || [];
  }

  async getDealStages(pipelineId?: string): Promise<ACDealStage[]> {
    const query = pipelineId ? `?filters[d_groupid]=${pipelineId}` : '';
    const data = await this.fetch<ACDealStagesResponse>(`/dealStages${query}`);
    return data.dealStages || [];
  }

  async getDeals(params: {
    stageId?: string;
    status?: number;
    limit?: number;
  } = {}): Promise<ACDeal[]> {
    const searchParams = new URLSearchParams();
    if (params.stageId) searchParams.set('filters[stage]', params.stageId);
    if (params.status !== undefined) searchParams.set('filters[status]', String(params.status));
    searchParams.set('limit', String(params.limit || 100));
    const data = await this.fetch<ACDealsResponse>(`/deals?${searchParams.toString()}`);
    return data.deals || [];
  }

  getDealUrl(dealId: string): string {
    const match = this.baseUrl.match(/https:\/\/([^.]+)\.api-us1\.com/);
    const accountName = match?.[1] || '';
    return `https://${accountName}.activehosted.com/app/deals/${dealId}`;
  }
```

**Step 3: Commit**

```bash
git add src/lib/activecampaign.ts
git commit -m "feat: add deal, stage, and pipeline methods to AC client"
```

---

### Task 3: Add AC Client Tests for Deal Methods

**Files:**
- Modify: `src/lib/__tests__/activecampaign.test.ts`
- Modify: `src/test/mocks/activecampaign.ts`

**Step 1: Add mock data to `src/test/mocks/activecampaign.ts`**

Add after existing exports:

```typescript
import type { ACDeal, ACDealStage, ACPipeline } from '@/types/activecampaign';

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
```

Update `createMockActiveCampaignClient` to include deal methods:

```typescript
export function createMockActiveCampaignClient() {
  return {
    searchAccounts: vi.fn().mockResolvedValue(mockAccounts),
    getContactsForAccount: vi.fn().mockResolvedValue(mockContacts),
    getAccount: vi.fn().mockResolvedValue(mockAccounts[0]),
    getAccountUrl: vi.fn().mockReturnValue('https://test.activehosted.com/app/accounts/1'),
    getPipelines: vi.fn().mockResolvedValue(mockPipelines),
    getDealStages: vi.fn().mockResolvedValue(mockDealStages),
    getDeals: vi.fn().mockResolvedValue(mockDeals),
    getDealUrl: vi.fn().mockReturnValue('https://test.activehosted.com/app/deals/201'),
  };
}
```

**Step 2: Add tests to `src/lib/__tests__/activecampaign.test.ts`**

Add these describe blocks after the existing `getAccountUrl` describe:

```typescript
  describe('getPipelines', () => {
    it('fetches pipelines successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          dealGroups: [
            { id: '1', title: 'Solution' },
            { id: '2', title: 'VidPod' },
          ],
        }),
      });

      const client = getActiveCampaignClient();
      const pipelines = await client.getPipelines();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://testaccount.api-us1.com/api/3/dealGroups',
        expect.any(Object)
      );
      expect(pipelines).toHaveLength(2);
      expect(pipelines[0].title).toBe('Solution');
    });
  });

  describe('getDealStages', () => {
    it('fetches stages for a pipeline', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          dealStages: [
            { id: '10', title: 'Verbal Commit', group: '1', order: '3' },
          ],
        }),
      });

      const client = getActiveCampaignClient();
      const stages = await client.getDealStages('1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('filters[d_groupid]=1'),
        expect.any(Object)
      );
      expect(stages).toHaveLength(1);
      expect(stages[0].title).toBe('Verbal Commit');
    });

    it('fetches all stages when no pipeline specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ dealStages: [] }),
      });

      const client = getActiveCampaignClient();
      await client.getDealStages();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://testaccount.api-us1.com/api/3/dealStages',
        expect.any(Object)
      );
    });
  });

  describe('getDeals', () => {
    it('fetches deals with stage filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          deals: [
            { id: '201', title: 'Test Deal', value: '5000000', status: '0', stage: '10', group: '1', contact: '101', account: '1', owner: '1', currency: 'usd', cdate: '2026-02-15', mdate: '2026-03-01' },
          ],
        }),
      });

      const client = getActiveCampaignClient();
      const deals = await client.getDeals({ stageId: '10', status: 0 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('filters[stage]=10'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('filters[status]=0'),
        expect.any(Object)
      );
      expect(deals).toHaveLength(1);
      expect(deals[0].title).toBe('Test Deal');
    });

    it('returns empty array when no deals found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deals: [] }),
      });

      const client = getActiveCampaignClient();
      const deals = await client.getDeals({ stageId: '99' });
      expect(deals).toHaveLength(0);
    });
  });

  describe('getDealUrl', () => {
    it('generates correct deal URL', () => {
      const client = getActiveCampaignClient();
      const url = client.getDealUrl('201');
      expect(url).toBe('https://testaccount.activehosted.com/app/deals/201');
    });
  });
```

**Step 3: Run tests**

Run: `npm test -- src/lib/__tests__/activecampaign.test.ts`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/lib/__tests__/activecampaign.test.ts src/test/mocks/activecampaign.ts
git commit -m "test: add tests for AC deal, stage, and pipeline methods"
```

---

### Task 4: Create Deals API Route

**Files:**
- Create: `src/app/api/activecampaign/deals/route.ts`

**Step 1: Create the API route**

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveCampaignClient, isActiveCampaignConfigured } from '@/lib/activecampaign';
import type { ACDealDisplay } from '@/types/activecampaign';

const PIPELINE_NAME = 'Solution';
const STAGE_NAME = 'Verbal Commit';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isActiveCampaignConfigured()) {
      return NextResponse.json(
        { error: 'ActiveCampaign is not configured', deals: [] },
        { status: 200 }
      );
    }

    const client = getActiveCampaignClient();

    // Find Solution pipeline
    const pipelines = await client.getPipelines();
    const pipeline = pipelines.find(
      (p) => p.title.toLowerCase() === PIPELINE_NAME.toLowerCase()
    );

    if (!pipeline) {
      return NextResponse.json(
        { error: `Pipeline "${PIPELINE_NAME}" not found`, deals: [] },
        { status: 200 }
      );
    }

    // Find Verbal Commit stage
    const stages = await client.getDealStages(pipeline.id);
    const stage = stages.find(
      (s) => s.title.toLowerCase() === STAGE_NAME.toLowerCase()
    );

    if (!stage) {
      return NextResponse.json(
        { error: `Stage "${STAGE_NAME}" not found`, deals: [] },
        { status: 200 }
      );
    }

    // Fetch open deals in that stage
    const deals = await client.getDeals({ stageId: stage.id, status: 0 });

    // Resolve contact and account names in parallel
    const resolvedDeals: ACDealDisplay[] = await Promise.all(
      deals.map(async (deal) => {
        let contactName = '';
        let accountName = '';

        const [contact, account] = await Promise.all([
          deal.contact ? client.searchContacts('').then(() => null).catch(() => null) : Promise.resolve(null),
          deal.account ? client.getAccount(deal.account).catch(() => null) : Promise.resolve(null),
        ]);

        // For contact, fetch individually
        if (deal.contact) {
          try {
            const contactData = await fetch(
              `${(client as any).baseUrl}/contacts/${deal.contact}`,
              { headers: { 'Api-Token': (client as any).apiKey, 'Content-Type': 'application/json' } }
            );
            if (contactData.ok) {
              const { contact: c } = await contactData.json();
              contactName = `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || '';
            }
          } catch {
            // skip
          }
        }

        if (account) {
          accountName = account.name;
        }

        return { ...deal, contactName, accountName };
      })
    );

    // Sort by created date ascending
    resolvedDeals.sort((a, b) => new Date(a.cdate).getTime() - new Date(b.cdate).getTime());

    return NextResponse.json({ deals: resolvedDeals });
  } catch (error) {
    console.error('AC deals fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deals', deals: [] },
      { status: 500 }
    );
  }
}
```

**Wait — the contact resolution above is clunky because the client doesn't expose a `getContact(id)` method.** We need to add one.

**Step 1b: Add `getContact` method to `src/lib/activecampaign.ts`**

Add inside the class, after `searchContacts`:

```typescript
  async getContact(contactId: string): Promise<ACContact | null> {
    try {
      const data = await this.fetch<{ contact: ACContact }>(`/contacts/${contactId}`);
      return data.contact || null;
    } catch {
      return null;
    }
  }
```

**Step 1c: Rewrite the API route cleanly using `getContact`**

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveCampaignClient, isActiveCampaignConfigured } from '@/lib/activecampaign';
import type { ACDealDisplay } from '@/types/activecampaign';

const PIPELINE_NAME = 'Solution';
const STAGE_NAME = 'Verbal Commit';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isActiveCampaignConfigured()) {
      return NextResponse.json(
        { error: 'ActiveCampaign is not configured', deals: [] },
        { status: 200 }
      );
    }

    const client = getActiveCampaignClient();

    // Find Solution pipeline
    const pipelines = await client.getPipelines();
    const pipeline = pipelines.find(
      (p) => p.title.toLowerCase() === PIPELINE_NAME.toLowerCase()
    );

    if (!pipeline) {
      return NextResponse.json(
        { error: `Pipeline "${PIPELINE_NAME}" not found`, deals: [] },
        { status: 200 }
      );
    }

    // Find Verbal Commit stage
    const stages = await client.getDealStages(pipeline.id);
    const stage = stages.find(
      (s) => s.title.toLowerCase() === STAGE_NAME.toLowerCase()
    );

    if (!stage) {
      return NextResponse.json(
        { error: `Stage "${STAGE_NAME}" not found`, deals: [] },
        { status: 200 }
      );
    }

    // Fetch open deals in that stage
    const deals = await client.getDeals({ stageId: stage.id, status: 0 });

    // Resolve contact and account names in parallel
    const resolvedDeals: ACDealDisplay[] = await Promise.all(
      deals.map(async (deal) => {
        const [contact, account] = await Promise.all([
          deal.contact ? client.getContact(deal.contact) : Promise.resolve(null),
          deal.account ? client.getAccount(deal.account) : Promise.resolve(null),
        ]);

        const contactName = contact
          ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email
          : '';
        const accountName = account?.name || '';

        return { ...deal, contactName, accountName };
      })
    );

    // Sort by created date ascending
    resolvedDeals.sort((a, b) => new Date(a.cdate).getTime() - new Date(b.cdate).getTime());

    return NextResponse.json({ deals: resolvedDeals });
  } catch (error) {
    console.error('AC deals fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deals', deals: [] },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/activecampaign.ts src/app/api/activecampaign/deals/route.ts
git commit -m "feat: add deals API route with contact/account resolution"
```

---

### Task 5: Create the Upcoming Deals Page

**Files:**
- Create: `src/app/(dashboard)/upcoming-deals/page.tsx`

**Step 1: Create the server component page**

```typescript
import { UpcomingDealsContent } from '@/components/deals/upcoming-deals-content';

export default function UpcomingDealsPage() {
  return <UpcomingDealsContent />;
}
```

**Step 2: Commit**

```bash
git add src/app/\(dashboard\)/upcoming-deals/page.tsx
git commit -m "feat: add upcoming deals page route"
```

---

### Task 6: Create the Upcoming Deals Client Component

**Files:**
- Create: `src/components/deals/upcoming-deals-content.tsx`

**Step 1: Create the client component**

This component fetches deals from the API route, provides a date range filter, and displays deals in a table sorted by date.

```typescript
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DollarSign, CalendarIcon, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { ACDealDisplay } from '@/types/activecampaign';

function formatDealValue(cents: string): string {
  const dollars = parseInt(cents, 10) / 100;
  if (dollars >= 1000000) return `$${(dollars / 1000000).toFixed(1)}M`;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(0)}K`;
  return `$${dollars.toLocaleString()}`;
}

export function UpcomingDealsContent() {
  const [deals, setDeals] = useState<ACDealDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    async function fetchDeals() {
      try {
        setLoading(true);
        const res = await fetch('/api/activecampaign/deals');
        const data = await res.json();
        if (data.error && !data.deals?.length) {
          setError(data.error);
        }
        setDeals(data.deals || []);
      } catch {
        setError('Failed to load deals');
      } finally {
        setLoading(false);
      }
    }
    fetchDeals();
  }, []);

  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      const dealDate = parseISO(deal.cdate);
      if (startDate && dealDate < startDate) return false;
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        if (dealDate > endOfDay) return false;
      }
      return true;
    });
  }, [deals, startDate, endDate]);

  const totalValue = useMemo(() => {
    return filteredDeals.reduce((sum, deal) => sum + parseInt(deal.value, 10) / 100, 0);
  }, [filteredDeals]);

  const clearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const hasFilters = startDate || endDate;

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Upcoming Deals</h1>
        <div className="text-muted-foreground">Loading deals...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Upcoming Deals</h1>
        <p className="text-sm text-muted-foreground">
          Solution Pipeline &middot; Verbal Commit
        </p>
      </div>

      {error && (
        <div className="text-sm text-amber-600 bg-amber-50 rounded-md p-3">
          {error}
        </div>
      )}

      {/* Summary + Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <Card className="flex-shrink-0">
          <CardContent className="flex items-center gap-2 py-3 px-4">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Total Pipeline Value</p>
              <p className="text-lg font-semibold">
                {formatDealValue(String(totalValue * 100))}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {startDate ? format(startDate, 'MMM d, yyyy') : 'Start date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
              />
            </PopoverContent>
          </Popover>

          <span className="text-muted-foreground">to</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {endDate ? format(endDate, 'MMM d, yyyy') : 'End date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
              />
            </PopoverContent>
          </Popover>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
              <X className="h-3 w-3" />
              Clear
            </Button>
          )}
        </div>

        <span className="text-sm text-muted-foreground">
          {filteredDeals.length} deal{filteredDeals.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Deals Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Value</th>
                  <th className="px-4 py-3 font-medium">Account</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      {deals.length === 0
                        ? 'No deals found in Verbal Commit stage'
                        : 'No deals match the selected date range'}
                    </td>
                  </tr>
                ) : (
                  filteredDeals.map((deal) => (
                    <tr key={deal.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{deal.title}</td>
                      <td className="px-4 py-3">{formatDealValue(deal.value)}</td>
                      <td className="px-4 py-3">{deal.accountName || '—'}</td>
                      <td className="px-4 py-3">{deal.contactName || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {format(parseISO(deal.cdate), 'MMM d, yyyy')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/deals/upcoming-deals-content.tsx
git commit -m "feat: add upcoming deals client component with date filter"
```

---

### Task 7: Add Sidebar Navigation Item

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

**Step 1: Add `Handshake` to lucide imports**

Add `Handshake` to the import from `lucide-react`:

```typescript
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  ListChecks,
  FileText,
  Plus,
  Target,
  Settings,
  Settings2,
  Tv,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarRange,
  Presentation,
  LayoutTemplate,
  Handshake,
} from 'lucide-react';
```

**Step 2: Add nav item to `mainNavItems` array**

Add before the `Settings` entry:

```typescript
  {
    title: 'Upcoming Deals',
    href: '/upcoming-deals',
    icon: Handshake,
  },
```

**Step 3: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat: add Upcoming Deals to sidebar navigation"
```

---

### Task 8: Run All Tests and Verify

**Step 1: Run existing AC tests**

Run: `npm test -- src/lib/__tests__/activecampaign.test.ts`
Expected: All tests PASS

**Step 2: Run full test suite**

Run: `npm test`
Expected: No regressions

**Step 3: Commit any fixes if needed**

---

### Task 9: Final Verification

**Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 2: Build check**

Run: `npm run build`
Expected: Builds successfully

**Step 3: Final commit if any fixes were needed**
