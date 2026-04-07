# Customer Portal Two-Column Layout Design

**Date:** 2026-03-13
**Branch:** customer-portal-ui

## Goal

Restructure the customer-facing portal page (`/status/[token]`) from a single-column stack to a two-column layout with a full-width bottom row.

## Layout

### Desktop (md+)

```
+------------------------+---------------------------+
|  LEFT COLUMN (fixed)   |  RIGHT COLUMN (builder)   |
|                        |                           |
|  Current Status        |  Schedule                 |
|  - Client name         |  File Upload              |
|  - Status badge/anim   |  Address Confirmation     |
|  - Progress bar        |  Custom HTML              |
|                        |  (any non-fixed blocks)   |
|  Contact Info          |                           |
|  - POC info            |                           |
|  - Project Manager     |                           |
+------------------------+---------------------------+
|  BOTTOM ROW (full-width)                           |
|                                                    |
|  Status History timeline                           |
+----------------------------------------------------+
```

### Mobile (< md)

Single column: Status -> Contact -> Right blocks stacked -> History

## Zone Assignment Rules

Blocks are auto-assigned to zones by type:

| Block Type                      | Zone   |
|---------------------------------|--------|
| `current_status`                | left   |
| `poc_info`                      | left   |
| `status_history`                | bottom |
| `customer_schedule`             | right  |
| `file_upload`                   | right  |
| `delivery_address_confirmation` | right  |
| `custom_html`                   | right  |

- Left column blocks are **always rendered** regardless of template config
- Bottom block (`status_history`) is **always rendered** regardless of template config
- Right column blocks come from the template and maintain their builder-defined order
- If no right-column blocks exist, left column stays at half width (clean empty right side)

## Approach: Renderer-Only (Approach A)

All changes are in the status page renderer. No changes to:
- Portal builder admin UI
- Database schema or migrations
- PortalBlock types
- Block renderer component

## File Changed

`src/app/status/[token]/page.tsx` — render section only

## Implementation

1. Partition `templateBlocks` into `leftBlocks`, `rightBlocks`, `bottomBlocks` by type
2. Always include `current_status` and `poc_info` in left (even if missing from template)
3. Always include `status_history` in bottom (even if missing from template)
4. Render with `md:grid md:grid-cols-2 md:gap-6` for the top row
5. Render bottom row full-width below

## Customer Portal Detail Page

The authenticated customer page (`/customer/projects/[id]/page.tsx`) should also get the same two-column treatment for consistency.
