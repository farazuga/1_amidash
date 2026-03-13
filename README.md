# AmiDash

## Overview

AmiDash is a project management dashboard built for Amitrace, an AV integration company. It manages project lifecycle from sales order through installation, including scheduling, file management, customer communication, and team meetings.

## Tech Stack

- **Framework:** Next.js 16 (App Router) with TypeScript strict mode
- **Database:** Supabase (PostgreSQL with Row Level Security)
- **Hosting:** Railway
- **Styling:** Tailwind CSS 4 + shadcn/ui + Radix UI
- **State:** Zustand (client) + TanStack Query (server)
- **Testing:** Vitest (unit) + Playwright (E2E)
- **Drag & Drop:** @dnd-kit
- **PWA:** next-pwa with offline support

## Key Features

1. **Project Management** - Full CRUD with status workflow, filtering, sales order tracking
2. **Calendar Scheduling** - Weekday-only resource calendar with drag-drop, copy (Cmd+drag), delete (Option+click), undo (Cmd+Z), conflict detection, Gantt view
3. **L10 Meetings (EOS)** - Complete Level 10 meeting system: rocks, scorecards, issues (IDS), todos, headlines, timed segments, realtime collaboration
4. **Customer Portal** - Token-based public portal with customizable blocks (status timeline, file uploads, delivery address confirmation, schedule view)
5. **Odoo 18 Integration** - Read-only JSON-RPC integration pulling sales orders, auto-populating projects, generating AI descriptions
6. **Microsoft Integration** - OAuth2 for Outlook calendar sync, SharePoint file management
7. **Email Notifications** - Status change and welcome emails via Resend with opt-out controls
8. **File Management** - Project files with SharePoint sync, camera capture, offline support
9. **Digital Signage** - Separate signage-engine app for lobby displays
10. **Approvals Workflow** - Customer approval tasks for deliverables

## Quick Start

```bash
npm install
cp .env.local.example .env.local  # Configure environment variables
npm run dev                        # Start development server on :3000
```

## Scripts

- `npm run dev` - Development server
- `npm run build` - Production build
- `npm test` - Run unit/integration tests (Vitest)
- `npm run test:watch` - Tests in watch mode
- `npm run test:coverage` - Coverage report (target: 85%)
- `npm run test:e2e` - Playwright E2E tests
- `npm run test:e2e:ui` - Playwright UI mode
- `npm run test:e2e:puppeteer` - Jest Puppeteer E2E tests

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login page
│   ├── (dashboard)/     # Protected staff routes
│   │   ├── calendar/    # Master calendar
│   │   ├── projects/    # Project management
│   │   ├── l10/         # L10 meetings
│   │   ├── admin/       # Admin settings
│   │   ├── approvals/   # Approval queue
│   │   └── my-schedule/ # Personal schedule
│   ├── (customer)/      # Customer portal routes
│   ├── api/             # API routes (37 endpoints)
│   ├── confirm/[token]/ # Public confirmation page
│   └── status/[token]/  # Public portal page
├── components/
│   ├── calendar/        # 39 calendar components
│   ├── projects/        # 26 project components
│   ├── l10/             # 36 L10 meeting components
│   ├── portal/          # 13 portal components
│   ├── files/           # 7 file management components
│   ├── dashboard/       # 6 dashboard components
│   └── ui/              # 32 shadcn/ui components
├── hooks/
│   ├── queries/         # 18 TanStack Query hooks
│   └── ...              # 9 utility hooks
├── lib/
│   ├── calendar/        # Calendar utilities
│   ├── supabase/        # Auth client + middleware
│   ├── odoo/            # Odoo JSON-RPC client
│   ├── microsoft-graph/ # Microsoft OAuth + Graph
│   ├── email/           # Email templates + sending
│   ├── sharepoint/      # SharePoint API
│   ├── stores/          # Zustand stores
│   └── ...              # Utilities, validation, crypto
├── types/               # TypeScript type definitions
└── test/                # Test utilities, factories, mocks
```

## User Roles

| Role | Access |
|------|--------|
| Admin | Full system access, user management, settings |
| Editor | Project CRUD, calendar management, L10 |
| Viewer | Read-only dashboard access |
| Customer | Portal-only access (own projects) |

## Documentation

See `docs/` for detailed documentation:

- [Architecture](docs/ARCHITECTURE.md)
- [API Reference](docs/API_REFERENCE.md)
- [Features](docs/FEATURES.md)
- [Environment Setup](docs/ENVIRONMENT_SETUP.md)
- [Database Schema](docs/DATABASE_SCHEMA.md)
- [Testing](docs/TESTING.md)
- [Security](docs/SECURITY.md)
- [Integrations](docs/INTEGRATIONS.md)
- [Recommendations](docs/RECOMMENDATIONS.md)

## License

Private - Amitrace internal use only.
