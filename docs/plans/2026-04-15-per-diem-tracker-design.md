# Per Diem Tracker - Design Document

**Date:** 2026-04-15
**Status:** Approved

## Overview

A prepaid per diem system where admins deposit funds to employees at any time, and employees submit trip entries that deduct from their running balance. Rates are globally fixed by admin (in-state vs out-of-state). Georgia is the home state (hardcoded).

## Data Model

### `per_diem_rates` (single-row admin setting)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| in_state_rate | decimal(10,2) | e.g. 50.00 |
| out_of_state_rate | decimal(10,2) | e.g. 75.00 |
| updated_by | UUID FK profiles | |
| updated_at | timestamptz | |

### `per_diem_deposits`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID FK profiles | Employee receiving the deposit |
| amount | decimal(10,2) | Dollar amount deposited |
| note | text | Optional memo (e.g. "Q2 2026 per diem") |
| created_by | UUID FK profiles | Admin who made the deposit |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `per_diem_entries`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID FK profiles | Employee the entry is for |
| project_id | UUID FK projects | Nullable - null when "Other" is selected |
| project_other_note | text | Description when project_id is null |
| start_date | date | First day of trip |
| end_date | date | Last day (excluded from count) |
| nights | integer | Auto-calculated (end - start) but overridable |
| nights_overridden | boolean | True when manually changed from calculated value |
| location_type | text | 'in_state' or 'out_of_state' |
| rate | decimal(10,2) | Snapshot of global rate at time of creation |
| total | decimal(10,2) | nights x rate (always computed, not overridable) |
| status | text | 'pending' or 'approved' |
| created_by | UUID FK profiles | Supports admin submitting on behalf |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### Balance Calculation

```
Balance = SUM(deposits.amount) - SUM(approved entries.total)
Pending = SUM(pending entries.total)
```

## Views

### Employee View (`/per-diem`)

**Balance Card:**
- Current balance (deposits minus approved)
- Total deposited (all time or filtered year)
- Total spent (approved entries)
- Pending amount (not yet deducted)

**Tabs or sections:**
- **My Entries** - table of their per diem entries, filterable by year and status
- **Deposit History** - read-only list of deposits received
- **"New Entry" button** - opens the entry form

**Edit rules:**
- Can edit own pending entries
- Cannot edit approved entries
- Can delete own pending entries

### Admin View (`/per-diem` — admin sees extra controls)

**Everything employees see, plus:**
- Employee filter dropdown to view any employee's data
- Bulk deposit form: table of all staff, amount + note fields, submit all at once
- Bulk approve: checkbox select on pending entries, "Approve Selected" button
- CSV export button (exports current filtered view)
- Rate settings panel (in-state and out-of-state daily rates)
- Can edit any entry regardless of status
- Can delete any pending entry

### CSV Export (Admin Only)

Columns: Employee Name, Project (sales order + client or "Other"), Project Dates, # Nights, In/Out State, Daily Rate, Total Amount, Status, Date Submitted

Exports whatever is currently filtered (year, employee, status, project).

## New Entry Form

**Fields:**

1. **Project** - searchable dropdown of active projects (search by sales order # or client name). "Other" option at top. When "Other" selected, shows a text field for description.
2. **Project Dates** - date range picker (start date + end date). Nights auto-calculated as (end_date - start_date). Label: "Project Dates".
3. **Nights** - auto-filled from dates but overridable. When overridden, field highlighted in yellow. `nights_overridden` flag set to true.
4. **In/Out State** - auto-populated from project's `delivery_state`. Georgia (GA) = in-state, anything else = out-of-state, no address = in-state. Overridable by employee.
5. **Rate** - read-only, pulled from global setting based on location_type. Stored as snapshot on the entry.
6. **Total** - read-only, calculated as nights x rate. Not overridable.
7. **Submit on behalf of** (admin only) - employee dropdown.

**Auto-determination logic for location_type:**
- Project has `delivery_state` matching "GA" (case-insensitive, handles "GA", "Georgia", etc.) → in-state
- Project has `delivery_state` not matching GA → out-of-state
- Project has no `delivery_state` → in-state (default)
- "Other" project selected → in-state (default)

## Permissions

| Action | Employee | Admin |
|--------|----------|-------|
| View own entries/balance | Yes | Yes |
| View others' entries | No | Yes |
| Submit entry (self) | Yes | Yes |
| Submit entry (others) | No | Yes |
| Edit pending entry (own) | Yes | Yes |
| Edit approved entry | No | Yes |
| Delete pending entry (own) | Yes | Yes |
| Approve entries | No | Yes |
| Bulk deposit | No | Yes |
| Edit deposits | No | Yes |
| Set rates | No | Yes |
| CSV export | No | Yes |

## Navigation

- Sidebar: "Per Diem" with `DollarSign` icon from lucide-react
- Added to `mainNavItems` in sidebar.tsx

## Filters

**Admin view:** employee, year (default: current), status, project
**Employee view:** year (default: current), status

## Technical Notes

- Migration: `064_per_diem_tracker.sql`
- Rate snapshot: when entry is created, current global rate is stored on the entry so historical entries are unaffected by rate changes
- Georgia check: normalize `delivery_state` — check for "GA", "Georgia", "ga" etc.
- Night count: `end_date - start_date` in days (last date excluded)
- Yellow highlight on overridden nights: use a CSS class like `bg-yellow-100` on the nights cell/field when `nights_overridden = true`
- RLS policies: employees can only read/write their own rows; admins bypass via service role or admin-specific policies
