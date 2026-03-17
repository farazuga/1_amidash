# Claude Code Project Context

This file provides context for Claude Code when working on this project.

## Project Overview

AmiDash - A project management dashboard built with Next.js, TypeScript, and Supabase.

### iOS Companion App

**AmiDash Field** is a native iOS companion app for field technicians. Full reference: [docs/AMIDASH_FIELD_IOS_REFERENCE.md](docs/AMIDASH_FIELD_IOS_REFERENCE.md). Repo at `/Users/faraz/Desktop/AmiDashField-iOS/`.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL)
- **Hosting:** Railway
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui, Radix UI
- **State Management:** Zustand, TanStack Query
- **Testing:** Vitest (unit/integration), Playwright (E2E)
- **Drag & Drop:** @dnd-kit

## Testing Workflow

### Run All Tests

```bash
npm test
```

### Run Calendar Tests

Tests for calendar utilities, constants, and server actions:

```bash
npm test -- src/lib/calendar src/app/\(dashboard\)/calendar
```

This runs:
- `src/lib/calendar/__tests__/utils.test.ts` - Calendar utility functions (93 tests)
- `src/lib/calendar/__tests__/constants.test.ts` - Calendar constants (32 tests)
- `src/app/(dashboard)/calendar/__tests__/actions.test.ts` - Server actions (16 tests)

### Run E2E Tests

```bash
npm run test:e2e
```

Calendar-specific E2E tests:
- `e2e/calendar.spec.ts` - General calendar functionality
- `e2e/calendar-interactions.spec.ts` - Drag/drop, keyboard shortcuts
- `e2e/manage-schedule.spec.ts` - Schedule dialog interactions
- `e2e/project-calendar.spec.ts` - Gantt view, navigation, filters

Odoo integration E2E tests:
- `e2e/odoo-contact-pull.spec.ts` - Client name autocomplete, delivery address auto-fill, POC auto-fill

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

## Key Directories

- `src/app/(dashboard)/` - Dashboard pages (protected routes)
- `src/app/(dashboard)/calendar/` - Master calendar page
- `src/app/(dashboard)/project-calendar/` - Project timeline (Gantt-style) view
- `src/components/calendar/` - Calendar components
- `src/lib/calendar/` - Calendar utilities and constants
- `src/types/calendar.ts` - Calendar TypeScript types

## Calendar System

### Booking Statuses (3 total)

1. **Draft** - PM planning, not visible to engineers
2. **Pending** - Awaiting customer confirmation
3. **Confirmed** - Customer confirmed, syncs to engineer Outlook calendars

### Calendar Views

- **Master Calendar** (`/calendar`) - Full scheduling grid with drag & drop
- **Project Timeline** (`/project-calendar`) - Gantt-style view across projects
- **My Schedule** - Simple confirmed-only list for individual engineers

### Key Features

- Weekdays only (Mon-Fri) - no weekends displayed
- Drag & drop assignments between days
- Cmd+drag to copy assignments
- Option+click to delete assignments
- Undo support (Cmd+Z)
- Status cascade when changing project schedule status
- Today indicator (vertical line)
- App-level Microsoft Graph integration (client credentials, not per-user OAuth)
- Dedicated "AmiDash" calendar created on each engineer's Outlook
- Read-only Outlook event display for conflict detection

## Odoo 18 Integration

Read-only integration with Odoo 18 (SH) via JSON-RPC. Pulls sales order data to auto-populate project creation forms.

### Architecture

- **Client:** `src/lib/odoo/client.ts` - `OdooReadOnlyClient` class, singleton pattern
- **Queries:** `src/lib/odoo/queries.ts` - Domain-specific query functions (sales orders, partners, products)
- **Types:** `src/types/odoo.ts` - All Odoo TypeScript interfaces
- **API Routes:**
  - `POST /api/odoo/pull` - Pull sales order data by S1XXXX number (includes delivery address from `partner_shipping_id`)
  - `GET /api/odoo/partners?q=` - Search Odoo contacts (companies + individuals) for client name autocomplete
  - `POST /api/odoo/invoice-status` - Refresh invoice status for existing project
  - `POST /api/odoo/summarize` - Generate project description from line items (uses Claude API)

### Safety

Triple-layer read-only enforcement:
1. TypeScript - only `searchRead`, `read`, `fields_get` methods allowed
2. Runtime - method allowlist check before every API call
3. Odoo - API user should have read-only permissions

### Data Flow

1. User enters sales order number (S1XXXX) in project creation form
2. "Pull from Odoo" button fetches: client info, POC, sales amount, PO number, salesperson, line items, invoice status, **delivery address** (from `partner_shipping_id`)
3. Line items are sent to Claude API for project description generation (3-4 bullet summary)
4. Project type auto-selected from line items:
   - Contains "install" → **Solution**
   - Contains "ami_vidpod" (no install) → **VidPod** (count auto-filled from quantity)
   - Neither → **Box Sale**

### Client Name Autocomplete (Odoo)

- Searches all `res.partner` records (companies + individual contacts) via `GET /api/odoo/partners?q=`
- Shows Building2 icon for companies, User icon for contacts
- Displays email and city/state in dropdown for identification
- On partner select: auto-fills delivery address from partner's address fields
- On contact (non-company) select: also auto-fills POC name, email, phone
- **Note:** Active Campaign is no longer used for contact autocomplete (AC deals route kept for deal tracking)

### Key Files

- `src/components/projects/odoo-pull-button.tsx` - Pull button component
- `src/components/projects/client-name-autocomplete.tsx` - Odoo partner search autocomplete
- `src/components/projects/project-form.tsx` - Form integration, auto-select, and auto-fill logic
- `src/components/projects/quick-info.tsx` - Invoice status display with refresh
- `src/hooks/use-odoo-partners.ts` - Debounced Odoo partner search hook
- `src/lib/odoo/queries.ts` - `searchPartners()`, `getShippingAddress()`, state/country code helpers
- `supabase/migrations/047_odoo_integration.sql` - Database migration (4 columns)

### Database Columns (projects table)

- `odoo_order_id` (integer) - Odoo sales order ID
- `odoo_invoice_status` (text) - "no", "to invoice", or "invoiced"
- `odoo_last_synced_at` (timestamptz) - Last sync timestamp
- `project_description` (text) - Generated/manual project description

### Run Odoo Tests

```bash
npm test -- src/lib/odoo
```

## Claude API (Anthropic) Integration

Used for generating project descriptions from Odoo sales order line items.

- **Endpoint:** `POST /api/odoo/summarize`
- **Model:** `claude-sonnet-4-20250514`
- **Purpose:** Takes line items from a sales order and generates a 3-4 bullet internal summary
- **Behavior:** Groups similar items, skips minor items (shipping, labor), includes product codes like `[ami_VIDPOD]`

## Database Migrations

Calendar-related migrations:
- `supabase/migrations/020_project_schedule_status.sql` - Project schedule status field

Odoo-related migrations:
- `supabase/migrations/047_odoo_integration.sql` - Odoo fields on projects table

## Environment Variables

Required for Supabase connection:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Required for Microsoft Graph (app-level client credentials with application permissions):
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_TENANT_ID`

Required for Odoo 18:
- `ODOO_URL` - Odoo instance URL (e.g. `https://mycompany.odoo.com`)
- `ODOO_DB` - Database name
- `ODOO_USER_LOGIN` - API user email
- `ODOO_API_KEY` - API key (not password)

Required for Claude API:
- `ANTHROPIC_API_KEY` - Anthropic API key for project description generation

## Background Jobs

No background jobs currently. Microsoft Graph tokens are managed via client credentials flow with in-memory caching (no refresh cron needed).
