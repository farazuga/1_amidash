# Per Diem Tracker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a prepaid per diem tracking system where admins deposit funds to employees and employees submit trip entries that deduct from their balance.

**Architecture:** Three new database tables (rates, deposits, entries) with server actions + TanStack Query hooks. Single `/per-diem` route that renders differently for admins vs employees. Project search autocomplete for linking entries to projects.

**Tech Stack:** Next.js App Router, Supabase (server actions), TanStack Query, Zod, shadcn/ui, date-fns, Tailwind CSS

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/064_per_diem_tracker.sql`

**Step 1: Write the migration**

```sql
-- Migration 064: Per Diem Tracker
-- Tables: per_diem_rates, per_diem_deposits, per_diem_entries

-- ============================================
-- 1. Per Diem Rates (single-row admin setting)
-- ============================================
CREATE TABLE per_diem_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  in_state_rate DECIMAL(10, 2) NOT NULL DEFAULT 0,
  out_of_state_rate DECIMAL(10, 2) NOT NULL DEFAULT 0,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed with default row
INSERT INTO per_diem_rates (in_state_rate, out_of_state_rate) VALUES (0, 0);

-- RLS
ALTER TABLE per_diem_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read rates"
  ON per_diem_rates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can update rates"
  ON per_diem_rates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 2. Per Diem Deposits
-- ============================================
CREATE TABLE per_diem_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  note TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE per_diem_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own deposits"
  ON per_diem_deposits FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert deposits"
  ON per_diem_deposits FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update deposits"
  ON per_diem_deposits FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete deposits"
  ON per_diem_deposits FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX idx_per_diem_deposits_user_id ON per_diem_deposits(user_id);

-- ============================================
-- 3. Per Diem Entries
-- ============================================
CREATE TABLE per_diem_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  project_other_note TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  nights INTEGER NOT NULL,
  nights_overridden BOOLEAN NOT NULL DEFAULT false,
  location_type TEXT NOT NULL CHECK (location_type IN ('in_state', 'out_of_state')),
  rate DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE per_diem_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own entries"
  ON per_diem_entries FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Staff can insert entries"
  ON per_diem_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Users can insert for themselves, admins can insert for anyone
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can update own pending, admins can update any"
  ON per_diem_entries FOR UPDATE
  TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'pending')
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can delete own pending, admins can delete any pending"
  ON per_diem_entries FOR DELETE
  TO authenticated
  USING (
    status = 'pending'
    AND (
      user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

CREATE INDEX idx_per_diem_entries_user_id ON per_diem_entries(user_id);
CREATE INDEX idx_per_diem_entries_project_id ON per_diem_entries(project_id);
CREATE INDEX idx_per_diem_entries_status ON per_diem_entries(status);
CREATE INDEX idx_per_diem_entries_start_date ON per_diem_entries(start_date);
```

**Step 2: Apply the migration**

Run via Supabase MCP tool: `apply_migration` with name `064_per_diem_tracker` and the SQL above.

**Step 3: Commit**

```bash
git add supabase/migrations/064_per_diem_tracker.sql
git commit -m "feat(per-diem): add database migration for rates, deposits, entries tables"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `src/types/per-diem.ts`

**Step 1: Write the types**

```typescript
export interface PerDiemRates {
  id: string;
  in_state_rate: number;
  out_of_state_rate: number;
  updated_by: string | null;
  updated_at: string;
}

export interface PerDiemDeposit {
  id: string;
  user_id: string;
  amount: number;
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  user?: { id: string; full_name: string | null; email: string };
}

export type PerDiemLocationType = 'in_state' | 'out_of_state';
export type PerDiemStatus = 'pending' | 'approved';

export interface PerDiemEntry {
  id: string;
  user_id: string;
  project_id: string | null;
  project_other_note: string | null;
  start_date: string;
  end_date: string;
  nights: number;
  nights_overridden: boolean;
  location_type: PerDiemLocationType;
  rate: number;
  total: number;
  status: PerDiemStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  user?: { id: string; full_name: string | null; email: string };
  project?: { id: string; client_name: string; sales_order_number: string | null; delivery_state: string | null } | null;
}

export interface PerDiemBalance {
  total_deposited: number;
  total_spent: number;     // approved entries only
  total_pending: number;   // pending entries only
  balance: number;         // deposited - spent
}
```

**Step 2: Commit**

```bash
git add src/types/per-diem.ts
git commit -m "feat(per-diem): add TypeScript types for per diem tracker"
```

---

## Task 3: Zod Validation Schemas

**Files:**
- Create: `src/lib/per-diem/validation.ts`

**Step 1: Write the validation schemas**

```typescript
import { z } from 'zod';

const uuidSchema = z.string().uuid('Invalid ID format');
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)');

// ============================================
// Rate Schemas
// ============================================

export const updateRatesSchema = z.object({
  in_state_rate: z.number().min(0, 'Rate must be non-negative'),
  out_of_state_rate: z.number().min(0, 'Rate must be non-negative'),
});

// ============================================
// Deposit Schemas
// ============================================

export const createDepositsSchema = z.object({
  deposits: z.array(z.object({
    user_id: uuidSchema,
    amount: z.number().positive('Amount must be positive'),
    note: z.string().max(500, 'Note too long').optional(),
  })).min(1, 'At least one deposit required'),
});

export const updateDepositSchema = z.object({
  id: uuidSchema,
  amount: z.number().positive('Amount must be positive').optional(),
  note: z.string().max(500, 'Note too long').nullable().optional(),
});

// ============================================
// Entry Schemas
// ============================================

export const createEntrySchema = z.object({
  user_id: uuidSchema,
  project_id: uuidSchema.nullable(),
  project_other_note: z.string().max(500).nullable().optional(),
  start_date: dateSchema,
  end_date: dateSchema,
  nights: z.number().int().positive('Nights must be at least 1'),
  nights_overridden: z.boolean(),
  location_type: z.enum(['in_state', 'out_of_state']),
  rate: z.number().min(0),
  total: z.number().min(0),
}).refine(data => data.project_id !== null || (data.project_other_note && data.project_other_note.trim().length > 0), {
  message: 'Either a project or a description is required',
  path: ['project_other_note'],
});

export const updateEntrySchema = z.object({
  id: uuidSchema,
  project_id: uuidSchema.nullable().optional(),
  project_other_note: z.string().max(500).nullable().optional(),
  start_date: dateSchema.optional(),
  end_date: dateSchema.optional(),
  nights: z.number().int().positive().optional(),
  nights_overridden: z.boolean().optional(),
  location_type: z.enum(['in_state', 'out_of_state']).optional(),
  rate: z.number().min(0).optional(),
  total: z.number().min(0).optional(),
});

export const approveEntriesSchema = z.object({
  entry_ids: z.array(uuidSchema).min(1, 'At least one entry required'),
});

// ============================================
// Validation Helper (same pattern as L10)
// ============================================

export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return {
      success: false,
      error: firstIssue?.message || 'Validation failed',
    };
  }
  return { success: true, data: result.data };
}
```

**Step 2: Commit**

```bash
git add src/lib/per-diem/validation.ts
git commit -m "feat(per-diem): add Zod validation schemas"
```

---

## Task 4: Server Actions

**Files:**
- Create: `src/app/(dashboard)/per-diem/actions.ts`

**Step 1: Write server actions**

This file uses the same pattern as `src/app/(dashboard)/l10/actions.ts`. Key actions:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  validateInput,
  updateRatesSchema,
  createDepositsSchema,
  updateDepositSchema,
  createEntrySchema,
  updateEntrySchema,
  approveEntriesSchema,
} from '@/lib/per-diem/validation';
import type { PerDiemRates, PerDiemDeposit, PerDiemEntry, PerDiemBalance } from '@/types/per-diem';

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}
```

Implement these server actions (each follows the try/catch + validateInput pattern from L10):

1. **`getRates()`** → `ActionResult<PerDiemRates>` — Fetch the single rates row from `per_diem_rates`. Select `.single()`.

2. **`updateRates(input)`** → `ActionResult<PerDiemRates>` — Validate with `updateRatesSchema`. Check caller is admin (query `profiles` for `auth.uid()`). Update the single row. `revalidatePath('/per-diem')`.

3. **`getDeposits(userId?: string)`** → `ActionResult<PerDiemDeposit[]>` — If `userId` provided, filter by it. Otherwise if caller is admin, return all; if not admin, filter to own `user_id`. Join `user:profiles!per_diem_deposits_user_id_fkey(id, full_name, email)`. Order by `created_at desc`.

4. **`createDeposits(input)`** → `ActionResult<PerDiemDeposit[]>` — Validate with `createDepositsSchema`. Check admin. Insert all deposits with `created_by = auth.uid()`. `revalidatePath('/per-diem')`.

5. **`updateDeposit(input)`** → `ActionResult` — Validate with `updateDepositSchema`. Check admin. Update row. `revalidatePath('/per-diem')`.

6. **`getEntries(filters)`** → `ActionResult<PerDiemEntry[]>` — Accept filters: `{ userId?: string, year?: number, status?: string }`. Non-admins can only see their own (force `userId = auth.uid()`). Join `user:profiles!per_diem_entries_user_id_fkey(id, full_name, email)` and `project:projects!per_diem_entries_project_id_fkey(id, client_name, sales_order_number, delivery_state)`. Filter by year using `start_date >= YYYY-01-01` and `start_date <= YYYY-12-31`. Order by `start_date desc`.

7. **`createEntry(input)`** → `ActionResult<PerDiemEntry>` — Validate with `createEntrySchema`. Non-admins: force `user_id = auth.uid()`. Set `created_by = auth.uid()`. Insert. `revalidatePath('/per-diem')`.

8. **`updateEntry(input)`** → `ActionResult` — Validate with `updateEntrySchema`. Fetch existing entry first. Non-admins: can only update own pending entries. Update row, set `updated_at = now()`. `revalidatePath('/per-diem')`.

9. **`deleteEntry(id: string)`** → `ActionResult` — Fetch entry, verify it's pending. Non-admins: verify it's their own. Delete. `revalidatePath('/per-diem')`.

10. **`approveEntries(input)`** → `ActionResult` — Validate with `approveEntriesSchema`. Check admin. Update all matching entries to `status = 'approved'`. `revalidatePath('/per-diem')`.

11. **`getBalance(userId: string)`** → `ActionResult<PerDiemBalance>` — Non-admins: force to own `auth.uid()`. Query sum of deposits for user. Query sum of approved entry totals. Query sum of pending entry totals. Return computed balance object.

12. **`getStaffUsers()`** → `ActionResult<{id: string, full_name: string | null, email: string}[]>` — Query `profiles` where `role != 'customer'`. Order by `full_name`. Used for admin employee dropdown and bulk deposit form.

13. **`searchProjects(query: string)`** → `ActionResult<{id: string, client_name: string, sales_order_number: string | null, delivery_state: string | null}[]>` — Search `projects` by `client_name` or `sales_order_number` ilike. Exclude archived statuses (Invoiced, Cancelled). Limit 20. Return id, client_name, sales_order_number, delivery_state.

**Step 2: Commit**

```bash
git add src/app/(dashboard)/per-diem/actions.ts
git commit -m "feat(per-diem): add server actions for rates, deposits, entries"
```

---

## Task 5: TanStack Query Hooks

**Files:**
- Create: `src/hooks/queries/use-per-diems.ts`

**Step 1: Write the hooks**

Follow the pattern from `src/hooks/queries/use-l10-todos.ts`. Key hooks:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getRates, updateRates,
  getDeposits, createDeposits, updateDeposit,
  getEntries, createEntry, updateEntry, deleteEntry, approveEntries,
  getBalance, getStaffUsers, searchProjects,
} from '@/app/(dashboard)/per-diem/actions';

export const PER_DIEM_KEYS = {
  rates: ['per-diem', 'rates'] as const,
  deposits: (userId?: string) => ['per-diem', 'deposits', userId] as const,
  entries: (filters?: Record<string, unknown>) => ['per-diem', 'entries', filters] as const,
  balance: (userId?: string) => ['per-diem', 'balance', userId] as const,
  staff: ['per-diem', 'staff'] as const,
  projects: (query: string) => ['per-diem', 'projects', query] as const,
};

const THIRTY_SECONDS = 30 * 1000;
```

Implement these hooks:

1. **`usePerDiemRates()`** — `useQuery` on `PER_DIEM_KEYS.rates`, calls `getRates()`, `staleTime: THIRTY_SECONDS`.

2. **`useUpdateRates()`** — `useMutation` calling `updateRates()`, invalidates `PER_DIEM_KEYS.rates` on success.

3. **`useDeposits(userId?)`** — `useQuery` on `PER_DIEM_KEYS.deposits(userId)`, calls `getDeposits(userId)`.

4. **`useCreateDeposits()`** — `useMutation` calling `createDeposits()`, invalidates deposits + balance keys.

5. **`useUpdateDeposit()`** — `useMutation` calling `updateDeposit()`, invalidates deposits + balance keys.

6. **`useEntries(filters)`** — `useQuery` on `PER_DIEM_KEYS.entries(filters)`, calls `getEntries(filters)`.

7. **`useCreateEntry()`** — `useMutation` calling `createEntry()`, invalidates entries + balance keys.

8. **`useUpdateEntry()`** — `useMutation` calling `updateEntry()`, invalidates entries + balance keys.

9. **`useDeleteEntry()`** — `useMutation` calling `deleteEntry()`, invalidates entries + balance keys.

10. **`useApproveEntries()`** — `useMutation` calling `approveEntries()`, invalidates entries + balance keys.

11. **`usePerDiemBalance(userId?)`** — `useQuery` on `PER_DIEM_KEYS.balance(userId)`, calls `getBalance(userId)`.

12. **`useStaffUsers()`** — `useQuery` on `PER_DIEM_KEYS.staff`, calls `getStaffUsers()`, `staleTime: 5 * 60 * 1000` (5 min, rarely changes).

13. **`useProjectSearch(query)`** — `useQuery` on `PER_DIEM_KEYS.projects(query)`, calls `searchProjects(query)`, `enabled: query.length >= 2`, `staleTime: THIRTY_SECONDS`. Debounce the query string in the component, not here.

**Step 2: Commit**

```bash
git add src/hooks/queries/use-per-diems.ts
git commit -m "feat(per-diem): add TanStack Query hooks"
```

---

## Task 6: Georgia Detection Utility

**Files:**
- Create: `src/lib/per-diem/utils.ts`

**Step 1: Write utility functions**

```typescript
import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { PerDiemLocationType } from '@/types/per-diem';

/**
 * Determine location type from a project's delivery_state.
 * Georgia (any form: "GA", "Georgia", "ga") = in_state.
 * No state = defaults to in_state.
 * Anything else = out_of_state.
 */
export function getLocationType(deliveryState: string | null | undefined): PerDiemLocationType {
  if (!deliveryState) return 'in_state';
  const normalized = deliveryState.trim().toLowerCase();
  if (normalized === 'ga' || normalized === 'georgia') return 'in_state';
  return 'out_of_state';
}

/**
 * Calculate nights from start and end dates.
 * End date is excluded (e.g., Apr 1 to Apr 4 = 3 nights).
 */
export function calculateNights(startDate: string, endDate: string): number {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const diff = differenceInCalendarDays(end, start);
  return Math.max(0, diff);
}

/**
 * Calculate total from nights and rate.
 */
export function calculateTotal(nights: number, rate: number): number {
  return Number((nights * rate).toFixed(2));
}

/**
 * Format currency for display.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}
```

**Step 2: Write tests**

Create `src/lib/per-diem/__tests__/utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getLocationType, calculateNights, calculateTotal, formatCurrency } from '../utils';

describe('getLocationType', () => {
  it('returns in_state for GA', () => expect(getLocationType('GA')).toBe('in_state'));
  it('returns in_state for Georgia', () => expect(getLocationType('Georgia')).toBe('in_state'));
  it('returns in_state for ga (lowercase)', () => expect(getLocationType('ga')).toBe('in_state'));
  it('returns in_state for null', () => expect(getLocationType(null)).toBe('in_state'));
  it('returns in_state for undefined', () => expect(getLocationType(undefined)).toBe('in_state'));
  it('returns in_state for empty string', () => expect(getLocationType('')).toBe('in_state'));
  it('returns out_of_state for FL', () => expect(getLocationType('FL')).toBe('out_of_state'));
  it('returns out_of_state for California', () => expect(getLocationType('California')).toBe('out_of_state'));
  it('handles whitespace', () => expect(getLocationType(' GA ')).toBe('in_state'));
});

describe('calculateNights', () => {
  it('calculates 3 nights for Apr 1-4', () => expect(calculateNights('2026-04-01', '2026-04-04')).toBe(3));
  it('calculates 1 night for same consecutive days', () => expect(calculateNights('2026-04-01', '2026-04-02')).toBe(1));
  it('returns 0 for same day', () => expect(calculateNights('2026-04-01', '2026-04-01')).toBe(0));
  it('returns 0 if end before start', () => expect(calculateNights('2026-04-05', '2026-04-01')).toBe(0));
  it('handles month boundary', () => expect(calculateNights('2026-03-30', '2026-04-02')).toBe(3));
});

describe('calculateTotal', () => {
  it('multiplies nights by rate', () => expect(calculateTotal(3, 50)).toBe(150));
  it('handles decimal rates', () => expect(calculateTotal(2, 75.50)).toBe(151));
  it('returns 0 for 0 nights', () => expect(calculateTotal(0, 50)).toBe(0));
});

describe('formatCurrency', () => {
  it('formats as USD', () => expect(formatCurrency(1500)).toBe('$1,500.00'));
  it('formats decimals', () => expect(formatCurrency(75.5)).toBe('$75.50'));
  it('formats zero', () => expect(formatCurrency(0)).toBe('$0.00'));
});
```

**Step 3: Run tests**

```bash
npm test -- src/lib/per-diem/__tests__/utils.test.ts
```

Expected: All tests pass.

**Step 4: Commit**

```bash
git add src/lib/per-diem/utils.ts src/lib/per-diem/__tests__/utils.test.ts
git commit -m "feat(per-diem): add Georgia detection, night calculation, and formatting utilities"
```

---

## Task 7: Per Diem Page (Route + Layout)

**Files:**
- Create: `src/app/(dashboard)/per-diem/page.tsx`
- Create: `src/app/(dashboard)/per-diem/per-diem-page.tsx` (client component)

**Step 1: Write the server page**

`src/app/(dashboard)/per-diem/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { PerDiemPage } from './per-diem-page';

export default async function PerDiemRoute() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role === 'customer') redirect('/');

  return <PerDiemPage isAdmin={profile.role === 'admin'} currentUserId={user.id} />;
}
```

**Step 2: Write the client component shell**

`src/app/(dashboard)/per-diem/per-diem-page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useUser } from '@/contexts/user-context';
// Components will be added in subsequent tasks
// import { BalanceCard } from '@/components/per-diem/balance-card';
// import { EntriesTable } from '@/components/per-diem/entries-table';
// import { DepositHistory } from '@/components/per-diem/deposit-history';
// etc.

interface PerDiemPageProps {
  isAdmin: boolean;
  currentUserId: string;
}

export function PerDiemPage({ isAdmin, currentUserId }: PerDiemPageProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(
    isAdmin ? undefined : currentUserId
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Per Diem Tracker</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {isAdmin ? 'Manage per diem deposits and entries for all employees' : 'Track your per diem balance and entries'}
          </p>
        </div>
      </div>

      {/* Filters, balance card, entries table, deposit history will be added in subsequent tasks */}
      <p className="text-muted-foreground">Coming soon...</p>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/(dashboard)/per-diem/
git commit -m "feat(per-diem): add page route with admin/employee detection"
```

---

## Task 8: Sidebar Navigation Entry

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

**Step 1: Add DollarSign import**

In the lucide-react import block (line ~9-30), add `DollarSign` to the import.

**Step 2: Add nav item**

In the `mainNavItems` array (line ~49-59), add after 'Quick Links':

```typescript
{ title: 'Per Diem', href: '/per-diem', icon: DollarSign },
```

**Step 3: Verify navigation works**

Start dev server, confirm "Per Diem" appears in sidebar, links to `/per-diem`, shows the placeholder page.

**Step 4: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(per-diem): add Per Diem to sidebar navigation"
```

---

## Task 9: Balance Card Component

**Files:**
- Create: `src/components/per-diem/balance-card.tsx`

**Step 1: Write the balance card**

Displays 4 metrics in a card grid: Current Balance, Total Deposited, Total Spent (approved), Pending Amount. Use `formatCurrency()` from `src/lib/per-diem/utils.ts`. Use `Card`, `CardContent`, `CardHeader`, `CardTitle` from `src/components/ui/card`. Use `usePerDiemBalance()` hook.

Props: `{ userId?: string }` — pass current user for employees, selected user for admin view.

Layout: 4-column grid on desktop (`grid grid-cols-2 md:grid-cols-4 gap-4`), each a small card with label + value. Color-code: balance green if positive / red if negative. Pending amount in amber/yellow.

**Step 2: Commit**

```bash
git add src/components/per-diem/balance-card.tsx
git commit -m "feat(per-diem): add balance card component"
```

---

## Task 10: Filters Bar Component

**Files:**
- Create: `src/components/per-diem/per-diem-filters.tsx`

**Step 1: Write the filters bar**

Props:
```typescript
interface PerDiemFiltersProps {
  isAdmin: boolean;
  selectedYear: number;
  onYearChange: (year: number) => void;
  selectedStatus: string | undefined;
  onStatusChange: (status: string | undefined) => void;
  selectedUserId: string | undefined;
  onUserChange: (userId: string | undefined) => void;
}
```

Components used:
- `Select` from `src/components/ui/select` for year dropdown (generate years from 2024 to current year + 1)
- `Select` for status (All / Pending / Approved)
- `Select` for employee (admin only) — use `useStaffUsers()` hook to populate
- Layout: horizontal flex with gap, wraps on mobile

**Step 2: Commit**

```bash
git add src/components/per-diem/per-diem-filters.tsx
git commit -m "feat(per-diem): add filters bar component"
```

---

## Task 11: Project Search Autocomplete

**Files:**
- Create: `src/components/per-diem/project-search.tsx`

**Step 1: Write the project search component**

Follow the pattern from `src/components/projects/client-name-autocomplete.tsx`. Use `Popover` + `Command` + `CommandInput` + `CommandList` + `CommandItem`.

Props:
```typescript
interface ProjectSearchProps {
  value: { id: string | null; label: string };
  onChange: (project: { id: string | null; client_name: string; sales_order_number: string | null; delivery_state: string | null } | null) => void;
}
```

Behavior:
- Input with search, debounced at 300ms
- Uses `useProjectSearch(debouncedQuery)` hook
- First item in list: **"Other (not tied to a project)"** — selecting this sets `project_id = null` and shows a text input for `project_other_note`
- Results show: `[S1XXXX] Client Name` format
- On select: call `onChange` with project data (including `delivery_state` for auto location type)

**Step 2: Commit**

```bash
git add src/components/per-diem/project-search.tsx
git commit -m "feat(per-diem): add project search autocomplete component"
```

---

## Task 12: New Entry Dialog

**Files:**
- Create: `src/components/per-diem/new-entry-dialog.tsx`

**Step 1: Write the new entry dialog**

Use `Dialog` from `src/components/ui/dialog`. This is the main form for creating/editing per diem entries.

Props:
```typescript
interface NewEntryDialogProps {
  isAdmin: boolean;
  currentUserId: string;
  editEntry?: PerDiemEntry | null;  // If set, editing mode
  onClose: () => void;
}
```

Form fields (all controlled state):
1. **Submit on behalf of** (admin only): `Select` dropdown of staff users via `useStaffUsers()`. Default to current user.
2. **Project**: `ProjectSearch` component from Task 11. When "Other" selected, show text input for description.
3. **Project Dates**: Two date pickers (start date, end date) using `Calendar` in `Popover`. On change, auto-calculate nights = `calculateNights(start, end)`.
4. **Nights**: `Input` type number. Auto-filled from dates. When manually changed to differ from calculated value, add `bg-yellow-100` class and set `nights_overridden = true`. When dates change and nights matches calculated value again, remove yellow highlight.
5. **In/Out State**: `Select` with "In State" / "Out of State". Auto-populated from project's `delivery_state` via `getLocationType()`. Changeable by employee.
6. **Rate**: Read-only `Input`, shows the applicable rate from `usePerDiemRates()` based on selected location type. Display with `formatCurrency()`.
7. **Total**: Read-only `Input`, calculated as `nights * rate`. Display with `formatCurrency()`.

On submit:
- Call `useCreateEntry()` or `useUpdateEntry()` mutation
- Compute `total = nights * rate` (always server of truth even though displayed)
- Snapshot `rate` value from current global rates
- Toast success/error via `toast` from `sonner`
- Close dialog

**Step 2: Commit**

```bash
git add src/components/per-diem/new-entry-dialog.tsx
git commit -m "feat(per-diem): add new entry dialog with project search and auto-calculation"
```

---

## Task 13: Entries Table Component

**Files:**
- Create: `src/components/per-diem/entries-table.tsx`

**Step 1: Write the entries table**

Uses `Table` components from `src/components/ui/table.tsx`.

Props:
```typescript
interface EntriesTableProps {
  isAdmin: boolean;
  currentUserId: string;
  filters: { userId?: string; year?: number; status?: string };
}
```

Columns:
- Checkbox (admin only, for bulk approve — only shown on pending rows)
- Employee (admin only) — `entry.user?.full_name`
- Project — `[S1XXXX] Client Name` or "Other: {note}"
- Project Dates — `Apr 1 - Apr 4, 2026`
- Nights — number, with `bg-yellow-100` class if `nights_overridden`
- In/Out State — badge: "In State" (green) / "Out of State" (blue)
- Rate — formatted currency
- Total — formatted currency
- Status — badge: "Pending" (amber) / "Approved" (green)
- Actions — Edit button (opens NewEntryDialog in edit mode), Delete button (pending only)

Use `useEntries(filters)` hook for data.

Admin controls at top of table:
- "Approve Selected" button — calls `useApproveEntries()` with checked entry IDs
- "New Entry" button — opens NewEntryDialog

Employee controls:
- "New Entry" button only

Edit rules enforced in UI:
- Employees: Edit/Delete visible only on own pending entries
- Admins: Edit visible on all, Delete visible on pending only

**Step 2: Commit**

```bash
git add src/components/per-diem/entries-table.tsx
git commit -m "feat(per-diem): add entries table with bulk approve and edit/delete"
```

---

## Task 14: Deposit History Component

**Files:**
- Create: `src/components/per-diem/deposit-history.tsx`

**Step 1: Write the deposit history**

Simple table showing deposits for the viewed user.

Props:
```typescript
interface DepositHistoryProps {
  isAdmin: boolean;
  userId?: string;
}
```

Uses `useDeposits(userId)` hook. Columns:
- Date — formatted `created_at`
- Amount — formatted currency
- Note — deposit memo
- Actions (admin only) — Edit button (inline edit or small dialog)

For admin edit: use an inline edit pattern — click edit, fields become inputs, save/cancel buttons appear. Call `useUpdateDeposit()` on save.

**Step 2: Commit**

```bash
git add src/components/per-diem/deposit-history.tsx
git commit -m "feat(per-diem): add deposit history component"
```

---

## Task 15: Bulk Deposit Dialog (Admin)

**Files:**
- Create: `src/components/per-diem/bulk-deposit-dialog.tsx`

**Step 1: Write the bulk deposit dialog**

Admin-only dialog. Use `Dialog` from shadcn/ui.

Shows a table of all staff users (from `useStaffUsers()`):

| Employee | Amount | Note |
|----------|--------|------|
| John Smith | [input] | [input] |
| Jane Doe | [input] | [input] |

- Amount inputs default to empty (0 = skip)
- Note input shared OR per-employee (use a shared "Note for all" field at the top + optional per-employee override)
- Submit button: filters out rows with 0/empty amounts, calls `useCreateDeposits()` with the non-zero entries
- Toast success with count of deposits created

**Step 2: Commit**

```bash
git add src/components/per-diem/bulk-deposit-dialog.tsx
git commit -m "feat(per-diem): add bulk deposit dialog for admins"
```

---

## Task 16: Rate Settings Component (Admin)

**Files:**
- Create: `src/components/per-diem/rate-settings.tsx`

**Step 1: Write the rate settings component**

Small card/section, admin-only. Shows current in-state and out-of-state rates with edit capability.

Uses `usePerDiemRates()` for data, `useUpdateRates()` for saving.

UI: Two number inputs (In-State Daily Rate, Out-of-State Daily Rate) with a Save button. Show "Last updated by {name} on {date}" below. Disable Save until values change.

**Step 2: Commit**

```bash
git add src/components/per-diem/rate-settings.tsx
git commit -m "feat(per-diem): add rate settings component for admins"
```

---

## Task 17: CSV Export

**Files:**
- Create: `src/components/per-diem/csv-export-button.tsx`

**Step 1: Write the CSV export button**

Admin-only button. Follow the pattern from `src/app/(dashboard)/project-calendar/project-calendar-view.tsx` (lines 431-458).

Props: `{ entries: PerDiemEntry[] }` — receives the currently filtered entries.

Columns in CSV: Employee Name, Project, Sales Order #, Project Dates, Nights, In/Out State, Daily Rate, Total, Status, Date Submitted.

Filename: `per-diem-export-YYYY-MM-DD.csv`

**Step 2: Commit**

```bash
git add src/components/per-diem/csv-export-button.tsx
git commit -m "feat(per-diem): add CSV export button for admins"
```

---

## Task 18: Wire Everything Into the Page

**Files:**
- Modify: `src/app/(dashboard)/per-diem/per-diem-page.tsx`

**Step 1: Integrate all components**

Update the client page component to wire together all the components built in Tasks 9-17:

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Upload } from 'lucide-react';
import { BalanceCard } from '@/components/per-diem/balance-card';
import { PerDiemFilters } from '@/components/per-diem/per-diem-filters';
import { EntriesTable } from '@/components/per-diem/entries-table';
import { DepositHistory } from '@/components/per-diem/deposit-history';
import { NewEntryDialog } from '@/components/per-diem/new-entry-dialog';
import { BulkDepositDialog } from '@/components/per-diem/bulk-deposit-dialog';
import { RateSettings } from '@/components/per-diem/rate-settings';
import { CsvExportButton } from '@/components/per-diem/csv-export-button';
import { useEntries } from '@/hooks/queries/use-per-diems';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
```

Layout:
1. Header with title + action buttons (New Entry, Bulk Deposit (admin), CSV Export (admin))
2. Filters bar
3. Balance card for selected user
4. Tabs: "Entries" | "Deposits" | "Settings" (admin only for Settings tab)
   - Entries tab: EntriesTable
   - Deposits tab: DepositHistory
   - Settings tab: RateSettings

State management: all filter state lives in this component, passed down as props.

**Step 2: Verify in browser**

Start dev server, navigate to `/per-diem`. Verify:
- Employee view: sees own balance, entries, deposits. Can create/edit/delete pending entries.
- Admin view: sees employee filter, all entries, bulk deposit, bulk approve, CSV export, rate settings.

**Step 3: Commit**

```bash
git add src/app/(dashboard)/per-diem/per-diem-page.tsx
git commit -m "feat(per-diem): wire all components into the per diem page"
```

---

## Task 19: End-to-End Testing

**Step 1: Test the full flow manually in browser**

1. As admin: Set rates (e.g., $50 in-state, $75 out-of-state)
2. As admin: Bulk deposit to 2 employees ($2000, $1500)
3. As employee: Create a new entry linked to a project. Verify nights auto-calculate, location auto-detects, rate/total auto-fill.
4. As employee: Create an "Other" entry. Verify description field appears.
5. As employee: Override nights on an entry. Verify yellow highlight.
6. As admin: Approve entries. Verify balance updates.
7. As admin: Export CSV. Verify file downloads with correct data.
8. As employee: Verify cannot see other employees' data.
9. As employee: Verify cannot edit approved entries.
10. As admin: Verify can edit approved entries.

**Step 2: Fix any issues found**

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(per-diem): finalize per diem tracker feature"
```
