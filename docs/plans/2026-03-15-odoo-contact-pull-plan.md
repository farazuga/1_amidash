# Odoo Contact Pull Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Active Campaign as the contact/address autocomplete source with Odoo. Auto-fill POC and delivery address from sales order data.

**Architecture:** Extend the existing Odoo pull API to fetch `partner_shipping_id` for delivery address. Add a new `/api/odoo/partners` search endpoint for client name autocomplete. Remove AC account/contact search from the project form while keeping AC deals integration intact.

**Tech Stack:** Next.js API routes, Odoo JSON-RPC (existing client), React hooks, shadcn/ui components

---

### Task 1: Add OdooShippingPartner type and update OdooPullResult

**Files:**
- Modify: `src/types/odoo.ts:68-76` (add shipping partner type near OdooPartner)
- Modify: `src/types/odoo.ts:116-140` (extend OdooPullResult)

**Step 1: Add OdooShippingPartner type**

In `src/types/odoo.ts`, after the existing `OdooPartner` interface (line 76), add:

```typescript
/** res.partner model - shipping/delivery address fields */
export interface OdooShippingPartner {
  id: number;
  name: string;
  street: string | false;
  street2: string | false;
  city: string | false;
  state_id: [number, string] | false; // Many2one: [id, "Texas"]
  zip: string | false;
  country_id: [number, string] | false; // Many2one: [id, "United States"]
}
```

**Step 2: Extend OdooPullResult with deliveryAddress**

In `src/types/odoo.ts`, add `deliveryAddress` to the `OdooPullResult` interface after `lineItems`:

```typescript
  deliveryAddress: {
    street: string | null;  // street + street2 concatenated
    city: string | null;
    state: string | null;   // state code from state_id display name
    zip: string | null;
    country: string | null; // country code from country_id display name
  } | null;
```

**Step 3: Commit**

```bash
git add src/types/odoo.ts
git commit -m "feat: add OdooShippingPartner type and deliveryAddress to OdooPullResult"
```

---

### Task 2: Add Odoo query functions for shipping address and partner search

**Files:**
- Modify: `src/lib/odoo/queries.ts:104-141` (partners section)
- Modify: `src/types/odoo.ts` (import new type)

**Step 1: Add `getShippingAddress` query function**

In `src/lib/odoo/queries.ts`, after `getPartnerContacts` (line 141), add:

```typescript
/**
 * Get the shipping/delivery address partner for a sales order.
 * Sales orders have a `partner_shipping_id` field pointing to the delivery address.
 */
export async function getShippingAddress(
  client: OdooReadOnlyClient,
  orderId: number
): Promise<OdooShippingPartner | null> {
  // First, read the partner_shipping_id from the sales order
  const orders = await client.read<{ id: number; partner_shipping_id: [number, string] | false }>(
    'sale.order',
    [orderId],
    ['partner_shipping_id']
  );

  if (orders.length === 0 || !orders[0].partner_shipping_id) return null;

  const shippingPartnerId = orders[0].partner_shipping_id[0];

  const results = await client.read<OdooShippingPartner>(
    'res.partner',
    [shippingPartnerId],
    ['id', 'name', 'street', 'street2', 'city', 'state_id', 'zip', 'country_id']
  );

  return results.length > 0 ? results[0] : null;
}
```

**Step 2: Add `searchPartners` query function for autocomplete**

In `src/lib/odoo/queries.ts`, after the new `getShippingAddress` function, add:

```typescript
/**
 * Search for company partners by name (for client name autocomplete).
 * Only returns companies (is_company = true), not individual contacts.
 */
export async function searchPartners(
  client: OdooReadOnlyClient,
  searchTerm: string,
  limit: number = 10
): Promise<Array<{ id: number; name: string; email: string | false; phone: string | false }>> {
  return client.searchRead<{ id: number; name: string; email: string | false; phone: string | false }>(
    'res.partner',
    [
      ['is_company', '=', true],
      ['name', 'ilike', searchTerm],
    ],
    ['id', 'name', 'email', 'phone'],
    { limit }
  );
}
```

**Step 3: Add `parseStateCode` helper function**

In `src/lib/odoo/queries.ts`, in the Helpers section (after `formatOdooPhone`), add:

```typescript
/**
 * Extract the state abbreviation from an Odoo state_id display name.
 * Odoo state_id returns [id, "State Name"]. We need the 2-letter code.
 * Common patterns: "Texas" → "TX", "California" → "CA"
 * Falls back to the full name if no abbreviation mapping found.
 */
const US_STATE_ABBREVS: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'District of Columbia': 'DC', 'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI',
  'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME',
  'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN',
  'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE',
  'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM',
  'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI',
  'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX',
  'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA',
  'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
};

export function parseStateCode(stateId: [number, string] | false): string | null {
  if (!stateId) return null;
  const stateName = stateId[1];
  // Check if it's already a 2-letter abbreviation
  if (/^[A-Z]{2}$/.test(stateName)) return stateName;
  return US_STATE_ABBREVS[stateName] || stateName;
}

/**
 * Extract country code from an Odoo country_id display name.
 * Odoo country_id returns [id, "United States"]. We want "US".
 */
const COUNTRY_CODES: Record<string, string> = {
  'United States': 'US', 'Canada': 'CA', 'Mexico': 'MX',
  'United Kingdom': 'GB',
};

export function parseCountryCode(countryId: [number, string] | false): string | null {
  if (!countryId) return null;
  const countryName = countryId[1];
  if (/^[A-Z]{2}$/.test(countryName)) return countryName;
  return COUNTRY_CODES[countryName] || countryName;
}
```

**Step 4: Update imports at top of queries.ts**

Add `OdooShippingPartner` to the import from `@/types/odoo`.

**Step 5: Commit**

```bash
git add src/lib/odoo/queries.ts src/types/odoo.ts
git commit -m "feat: add shipping address and partner search query functions"
```

---

### Task 3: Update Odoo pull API route to include delivery address

**Files:**
- Modify: `src/app/api/odoo/pull/route.ts`

**Step 1: Add imports**

Add `getShippingAddress`, `parseStateCode`, `parseCountryCode` to the imports from `@/lib/odoo/queries`.

**Step 2: Fetch shipping address in parallel**

In the `POST` handler, modify the parallel fetch (around line 69) to also fetch the shipping address:

```typescript
const [partner, lines, shippingPartner] = await Promise.all([
  getPartnerDetails(client, partnerId),
  getSalesOrderLines(client, order.order_line),
  getShippingAddress(client, order.id),
]);
```

**Step 3: Build delivery address from shipping partner**

After the salesperson matching section (around line 131), add:

```typescript
// Build delivery address from shipping partner
let deliveryAddress: OdooPullResult['deliveryAddress'] = null;
if (shippingPartner) {
  const street1 = odooFalseToNull(shippingPartner.street) || '';
  const street2 = odooFalseToNull(shippingPartner.street2) || '';
  const combinedStreet = [street1, street2].filter(Boolean).join(', ') || null;

  deliveryAddress = {
    street: combinedStreet,
    city: odooFalseToNull(shippingPartner.city),
    state: parseStateCode(shippingPartner.state_id),
    zip: odooFalseToNull(shippingPartner.zip),
    country: parseCountryCode(shippingPartner.country_id),
  };
}
```

**Step 4: Add deliveryAddress to result object**

In the result object construction (around line 134), add after `lineItems`:

```typescript
deliveryAddress,
```

**Step 5: Commit**

```bash
git add src/app/api/odoo/pull/route.ts
git commit -m "feat: include delivery address from partner_shipping_id in Odoo pull"
```

---

### Task 4: Create Odoo partner search API route

**Files:**
- Create: `src/app/api/odoo/partners/route.ts`

**Step 1: Create the partner search route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOdooClient, isOdooConfigured } from '@/lib/odoo';
import { searchPartners } from '@/lib/odoo/queries';

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isOdooConfigured()) {
      return NextResponse.json({ partners: [] });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json({ partners: [] });
    }

    const client = getOdooClient();
    const results = await searchPartners(client, query);

    const partners = results.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email || null,
      phone: p.phone || null,
    }));

    return NextResponse.json({ partners });
  } catch (error) {
    console.error('Odoo partner search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search partners' },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/odoo/partners/route.ts
git commit -m "feat: add Odoo partner search API route for client name autocomplete"
```

---

### Task 5: Create Odoo partner search hook

**Files:**
- Create: `src/hooks/use-odoo-partners.ts`

**Step 1: Create the hook**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useDebounce } from './use-debounce';

export interface OdooPartnerResult {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
}

interface UseOdooPartnerSearchResult {
  partners: OdooPartnerResult[];
  isLoading: boolean;
  error: string | null;
}

export function useOdooPartnerSearch(searchTerm: string): UseOdooPartnerSearchResult {
  const [partners, setPartners] = useState<OdooPartnerResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) {
      setPartners([]);
      setError(null);
      return;
    }

    const controller = new AbortController();

    const search = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/odoo/partners?q=${encodeURIComponent(debouncedSearch)}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error('Search failed');
        }

        const data = await response.json();
        setPartners(data.partners || []);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError('Failed to search partners');
        setPartners([]);
      } finally {
        setIsLoading(false);
      }
    };

    search();

    return () => { controller.abort(); };
  }, [debouncedSearch]);

  return { partners, isLoading, error };
}
```

**Step 2: Commit**

```bash
git add src/hooks/use-odoo-partners.ts
git commit -m "feat: add useOdooPartnerSearch hook for client name autocomplete"
```

---

### Task 6: Rewrite ClientNameAutocomplete to use Odoo

**Files:**
- Modify: `src/components/projects/client-name-autocomplete.tsx` (full rewrite)

**Step 1: Rewrite the component**

Replace the entire file with a version that searches Odoo partners instead of AC accounts. The component interface changes:

Old props:
- `onAccountSelect: (account: ACAccount | null) => void`
- `onContactFromEmail?: (contact: ACContact) => void`
- `selectedAccount: ACAccount | null`

New props:
- `onPartnerSelect: (partner: OdooPartnerResult | null) => void`
- `selectedPartner: OdooPartnerResult | null`

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Loader2, Building2 } from 'lucide-react';
import { useOdooPartnerSearch } from '@/hooks/use-odoo-partners';
import type { OdooPartnerResult } from '@/hooks/use-odoo-partners';

interface ClientNameAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPartnerSelect: (partner: OdooPartnerResult | null) => void;
  selectedPartner: OdooPartnerResult | null;
  defaultValue?: string;
}

export function ClientNameAutocomplete({
  value,
  onChange,
  onPartnerSelect,
  selectedPartner,
  defaultValue,
}: ClientNameAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || defaultValue || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const { partners, isLoading, error } = useOdooPartnerSearch(inputValue);

  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value);
    }
  }, [value]);

  useEffect(() => {
    if (partners.length > 0 && inputValue.length >= 2 && !selectedPartner) {
      setOpen(true);
    }
  }, [partners, inputValue, selectedPartner]);

  const handleSelect = (partner: OdooPartnerResult) => {
    setInputValue(partner.name);
    onChange(partner.name);
    onPartnerSelect(partner);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    if (selectedPartner && newValue !== selectedPartner.name) {
      onPartnerSelect(null);
    }
  };

  const handleInputFocus = () => {
    if (partners.length > 0 && !selectedPartner) {
      setOpen(true);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="client_name">Client Name *</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              ref={inputRef}
              id="client_name"
              name="client_name"
              value={inputValue}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              placeholder="Start typing to search Odoo..."
              required
              autoComplete="off"
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandList>
              {error ? (
                <div className="py-6 text-center text-sm text-red-500">{error}</div>
              ) : (
                <>
                  {partners.length > 0 && (
                    <CommandGroup heading="Odoo Partners">
                      {partners.map((partner) => (
                        <CommandItem
                          key={partner.id}
                          value={String(partner.id)}
                          onSelect={() => handleSelect(partner)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{partner.name}</div>
                            {partner.email && (
                              <div className="text-xs text-muted-foreground truncate">
                                {partner.email}
                              </div>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  {partners.length === 0 && inputValue.length >= 2 && !isLoading && (
                    <CommandEmpty>No partners found in Odoo</CommandEmpty>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/projects/client-name-autocomplete.tsx
git commit -m "feat: rewrite ClientNameAutocomplete to use Odoo partner search"
```

---

### Task 7: Simplify ContactSelector — remove AC navigation

**Files:**
- Modify: `src/components/projects/contact-selector.tsx` (simplify)

**Step 1: Rewrite ContactSelector to be a simple POC form**

Remove all Active Campaign contact navigation (prev/next, contact loading, AC hooks). Keep it as a simple form with name/email/phone fields that can be auto-filled from Odoo pull and manually edited.

New simplified props (remove `accountId`, `accountName`, `onContactSelect`):

```typescript
interface ContactSelectorProps {
  pocName: string;
  pocEmail: string;
  pocPhone: string;
  onPocNameChange: (value: string) => void;
  onPocEmailChange: (value: string) => void;
  onPocPhoneChange: (value: string) => void;
  defaultPocName?: string;
  defaultPocEmail?: string;
  defaultPocPhone?: string;
}
```

The component becomes a simple wrapper around three inputs with phone formatting on blur. Remove the AC imports, `useActiveCampaignContacts` hook usage, prev/next buttons, and contact counter.

**Step 2: Commit**

```bash
git add src/components/projects/contact-selector.tsx
git commit -m "feat: simplify ContactSelector — remove AC contact navigation"
```

---

### Task 8: Simplify SecondaryContactSelector — remove AC dropdown

**Files:**
- Modify: `src/components/projects/secondary-contact-selector.tsx`

**Step 1: Simplify to manual-only input**

Remove `contacts`, `isLoading`, `onContactSelect` props. Remove AC dropdown mode. Keep just the email input.

New simplified props:

```typescript
interface SecondaryContactSelectorProps {
  email: string;
  onEmailChange: (value: string) => void;
  defaultEmail?: string;
}
```

**Step 2: Commit**

```bash
git add src/components/projects/secondary-contact-selector.tsx
git commit -m "feat: simplify SecondaryContactSelector — remove AC dropdown"
```

---

### Task 9: Update ProjectForm — wire Odoo autocomplete and delivery address auto-fill

**Files:**
- Modify: `src/components/projects/project-form.tsx`

**Step 1: Update imports**

- Remove: `import type { ACAccount, ACContact } from '@/types/activecampaign'`
- Remove: `import { useActiveCampaignContacts } from '@/hooks/use-activecampaign'`
- Add: `import type { OdooPartnerResult } from '@/hooks/use-odoo-partners'`

**Step 2: Update state variables**

Replace:
```typescript
const [selectedAccount, setSelectedAccount] = useState<ACAccount | null>(null);
const [selectedPrimaryContact, setSelectedPrimaryContact] = useState<ACContact | null>(null);
const [selectedSecondaryContact, setSelectedSecondaryContact] = useState<ACContact | null>(null);
```

With:
```typescript
const [selectedPartner, setSelectedPartner] = useState<OdooPartnerResult | null>(null);
```

**Step 3: Remove AC contacts hook call**

Remove this block (lines 136-138):
```typescript
const { contacts: acContacts, isLoading: acContactsLoading } = useActiveCampaignContacts(
  selectedAccount?.id || null
);
```

**Step 4: Update handleOdooPullSuccess to auto-fill delivery address**

After the existing client/sales/salesperson auto-fill logic, add:

```typescript
// Delivery address from shipping partner
if (data.deliveryAddress) {
  setDeliveryAddress({
    street: data.deliveryAddress.street || '',
    city: data.deliveryAddress.city || '',
    state: data.deliveryAddress.state || '',
    zip: data.deliveryAddress.zip || '',
    country: data.deliveryAddress.country || 'US',
  });
}
```

**Step 5: Update ClientNameAutocomplete usage in JSX**

Replace:
```tsx
<ClientNameAutocomplete
  value={clientName}
  onChange={setClientName}
  onAccountSelect={setSelectedAccount}
  onContactFromEmail={(contact) => { ... }}
  selectedAccount={selectedAccount}
  defaultValue={project?.client_name}
/>
```

With:
```tsx
<ClientNameAutocomplete
  value={clientName}
  onChange={setClientName}
  onPartnerSelect={setSelectedPartner}
  selectedPartner={selectedPartner}
  defaultValue={project?.client_name}
/>
```

**Step 6: Update ContactSelector usage in JSX**

Replace:
```tsx
<ContactSelector
  accountId={selectedAccount?.id || null}
  accountName={selectedAccount?.name || clientName}
  pocName={pocName}
  pocEmail={pocEmail}
  pocPhone={pocPhone}
  onPocNameChange={setPocName}
  onPocEmailChange={setPocEmail}
  onPocPhoneChange={setPocPhone}
  onContactSelect={setSelectedPrimaryContact}
  defaultPocName={project?.poc_name || ''}
  defaultPocEmail={project?.poc_email || ''}
  defaultPocPhone={project?.poc_phone || ''}
/>
```

With:
```tsx
<ContactSelector
  pocName={pocName}
  pocEmail={pocEmail}
  pocPhone={pocPhone}
  onPocNameChange={setPocName}
  onPocEmailChange={setPocEmail}
  onPocPhoneChange={setPocPhone}
  defaultPocName={project?.poc_name || ''}
  defaultPocEmail={project?.poc_email || ''}
  defaultPocPhone={project?.poc_phone || ''}
/>
```

**Step 7: Update SecondaryContactSelector usage**

Replace:
```tsx
<SecondaryContactSelector
  contacts={acContacts}
  isLoading={acContactsLoading}
  email={secondaryPocEmail}
  onEmailChange={setSecondaryPocEmail}
  onContactSelect={setSelectedSecondaryContact}
  defaultEmail={project?.secondary_poc_email || ''}
/>
```

With:
```tsx
<SecondaryContactSelector
  email={secondaryPocEmail}
  onEmailChange={setSecondaryPocEmail}
  defaultEmail={project?.secondary_poc_email || ''}
/>
```

**Step 8: Update form submission data**

In the `data` object for form submission (around line 337), remove:
```typescript
activecampaign_account_id: selectedAccount?.id || null,
activecampaign_contact_id: selectedPrimaryContact?.id || null,
secondary_activecampaign_contact_id: selectedSecondaryContact?.id || null,
```

Replace with:
```typescript
activecampaign_account_id: null,
activecampaign_contact_id: null,
secondary_activecampaign_contact_id: null,
```

Do the same for the draft save handler (around line 954).

**Step 9: Commit**

```bash
git add src/components/projects/project-form.tsx
git commit -m "feat: wire Odoo autocomplete and delivery address auto-fill in ProjectForm"
```

---

### Task 10: Delete AC account/contact API routes (keep deals)

**Files:**
- Delete: `src/app/api/activecampaign/accounts/route.ts`
- Delete: `src/app/api/activecampaign/accounts/[accountId]/contacts/route.ts`
- Delete: `src/app/api/activecampaign/contacts/route.ts`
- Delete: `src/app/api/activecampaign/__tests__/accounts.test.ts`

**Step 1: Delete the files**

```bash
rm src/app/api/activecampaign/accounts/route.ts
rm -r src/app/api/activecampaign/accounts/\[accountId\]
rm src/app/api/activecampaign/contacts/route.ts
rm src/app/api/activecampaign/__tests__/accounts.test.ts
```

Keep: `src/app/api/activecampaign/deals/route.ts` (still used)

**Step 2: Remove unused AC hooks**

From `src/hooks/use-activecampaign.ts`, remove `useActiveCampaignSearch`, `useActiveCampaignContacts`, and `useContactSearch` functions. If only these functions exist in the file and no other code references it from the deals integration, delete the entire file.

Check if deals route or any other code imports from `use-activecampaign.ts` first. If nothing imports it, delete it.

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove AC account/contact API routes and hooks (keep deals)"
```

---

### Task 11: Build verification and type check

**Step 1: Run TypeScript type check**

```bash
npx tsc --noEmit
```

Fix any type errors. Common issues:
- Old ACAccount/ACContact references lingering somewhere
- OdooPullResult missing deliveryAddress in test mocks

**Step 2: Run existing tests**

```bash
npm test
```

Fix any failing tests. The Odoo pull tests may need `deliveryAddress` added to mocked responses.

**Step 3: Run build**

```bash
npm run build
```

Fix any build errors.

**Step 4: Commit fixes if any**

```bash
git add -A
git commit -m "fix: resolve type errors and test failures from Odoo contact pull changes"
```

---

### Task 12: Test end-to-end manually

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Manual verification checklist**

- [ ] Client name field searches Odoo partners as you type
- [ ] Selecting a partner fills in client name
- [ ] Entering sales order number and clicking "Pull from Odoo" fills: client name, POC name/email/phone, delivery address, sales amount, PO number, salesperson, project description
- [ ] Delivery address section shows the auto-filled address
- [ ] Clicking "Edit Address" opens dialog pre-populated with Odoo data
- [ ] Secondary contact is manual-only (no AC dropdown)
- [ ] POC fields are editable after auto-fill
- [ ] Draft save works
- [ ] Full project creation works
- [ ] AC deals page still works (`/api/activecampaign/deals` unaffected)
