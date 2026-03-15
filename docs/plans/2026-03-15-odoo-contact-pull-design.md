# Odoo Contact Pull — Design

## Overview

Replace Active Campaign as the contact/address autocomplete source with Odoo. The Odoo pull (from sales order) will auto-fill POC info and delivery address. A new Odoo partner search replaces the AC client name autocomplete. AC deals integration remains untouched.

## Odoo Data Changes

### New fields pulled from sales order

- `partner_shipping_id` → delivery address
  - `street` + `street2` concatenated into `delivery_street`
  - `city` → `delivery_city`
  - `state_id` (Many2one → `res.country.state`) resolved to state code → `delivery_state`
  - `zip` → `delivery_zip`
  - `country_id` (Many2one → `res.country`) resolved to country code → `delivery_country`

### POC (unchanged)

- Pulled from main `partner_id`'s child contacts (first contact)
- Name, email, phone auto-filled

### New Odoo type

```typescript
interface OdooShippingPartner {
  id: number;
  name: string;
  street: string | false;
  street2: string | false;
  city: string | false;
  state_id: [number, string] | false;  // [id, "Texas"]
  zip: string | false;
  country_id: [number, string] | false; // [id, "United States"]
}
```

## Client Name Autocomplete from Odoo

- Replace `ClientNameAutocomplete` AC account search with Odoo `res.partner` search
- New API route: `GET /api/odoo/partners?q=acme` → searches `res.partner` where `is_company=true`
- Debounced search as user types
- When partner selected → store partner info, can pre-load contacts
- Works alongside "Pull from Odoo" button (SO number auto-fills everything)

## Updated Pull Flow

When user clicks "Pull from Odoo":

1. Fetch sales order → client name, sales amount, PO, salesperson, line items (existing)
2. Fetch `partner_id` contacts → POC name, email, phone (existing)
3. **NEW:** Fetch `partner_shipping_id` → delivery address fields
4. **NEW:** Auto-fill delivery address in form state
5. Summarize line items via Claude API (existing)

All fields remain editable after auto-fill.

## What Gets Removed

### Removed from project form autocomplete flow
- `ClientNameAutocomplete` AC account search → replaced with Odoo partner search
- `ContactSelector` AC contact navigation → POC auto-fills from Odoo, manual edit allowed
- `SecondaryContactSelector` AC dropdown mode → stays manual-only

### AC API routes removed
- `/api/activecampaign/accounts` (search)
- `/api/activecampaign/accounts/[accountId]/contacts`
- `/api/activecampaign/contacts` (global search)

### Kept intact
- AC deals integration (`/api/activecampaign/deals`, pipeline/stage logic)
- AC client library, types, deal-related hooks
- `activecampaign_account_id`, `activecampaign_contact_id` DB columns (existing data preserved)

## OdooPullResult Changes

```typescript
interface OdooPullResult {
  // ... existing fields ...
  deliveryAddress: {
    street: string | null;   // street + street2 concatenated
    city: string | null;
    state: string | null;    // state code e.g. "TX"
    zip: string | null;
    country: string | null;  // country code e.g. "US"
  } | null;
}
```
