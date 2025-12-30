# Claude Code Project Context

This file provides context for Claude Code when working on this project.

## Project Overview

AmiDash - A project management dashboard built with Next.js, TypeScript, and Supabase.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL)
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
- `src/app/(dashboard)/projects/[id]/calendar/` - Project-specific calendar
- `src/app/(dashboard)/project-calendar/` - Gantt-style project calendar view
- `src/components/calendar/` - Calendar components
- `src/lib/calendar/` - Calendar utilities and constants
- `src/types/calendar.ts` - Calendar TypeScript types

## Calendar System

### Booking Statuses (4 total, no 'complete')

1. **Draft** - PM planning, not visible to engineers
2. **Tentative** - Planned but not sent to customer
3. **Pending Confirmation** - Awaiting customer confirmation
4. **Confirmed** - Customer confirmed

### Key Features

- Weekdays only (Mon-Fri) - no weekends displayed
- Drag & drop assignments between days
- Cmd+drag to copy assignments
- Option+click to delete assignments
- Undo support (Cmd+Z)
- Status cascade when changing project schedule status
- Today indicator (vertical line)

## Database Migrations

Calendar-related migrations:
- `supabase/migrations/020_project_schedule_status.sql` - Project schedule status field

## Environment Variables

Required for Supabase connection:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
