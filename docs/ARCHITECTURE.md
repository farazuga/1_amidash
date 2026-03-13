# Architecture

## System Overview
AmiDash is a Next.js 16 App Router application with Supabase PostgreSQL backend, deployed on Railway.

## Architecture Diagram
```
┌─────────────────────────────────────────────────────┐
│                    Client (Browser)                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐ │
│  │ React UI │  │ Zustand   │  │ TanStack Query    │ │
│  │ (shadcn) │  │ (stores)  │  │ (server state)    │ │
│  └──────────┘  └──────────┘  └───────────────────┘ │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│              Next.js App Router                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐ │
│  │ Pages    │  │ Server   │  │ API Routes        │ │
│  │ (RSC)    │  │ Actions  │  │ (37 endpoints)    │ │
│  └──────────┘  └──────────┘  └───────────────────┘ │
│  ┌──────────────────────────────────────────────┐   │
│  │ Middleware (auth, routing, session refresh)    │   │
│  └──────────────────────────────────────────────┘   │
└────────────┬──────────┬──────────┬──────────────────┘
             │          │          │
    ┌────────▼──┐  ┌────▼────┐  ┌─▼──────────────┐
    │ Supabase  │  │ Odoo 18 │  │ Microsoft Graph │
    │ (Postgres │  │ (JSON-  │  │ (OAuth2, Share- │
    │  + Auth)  │  │  RPC)   │  │  Point, Outlook)│
    └───────────┘  └─────────┘  └─────────────────┘
```

## Data Flow Patterns

### Server Actions Pattern
All mutations go through server actions in colocated `actions.ts` files:
1. Validate input with Zod
2. Check authentication via `createClient()` → `auth.getUser()`
3. Execute Supabase query
4. `revalidatePath()` to refresh cache
5. Return `ActionResult<T>` (success/error shape)

### Query Pattern
All reads use TanStack Query hooks in `src/hooks/queries/`:
1. Hook calls Supabase client directly (browser-side)
2. Uses `THIRTY_SECONDS` stale time
3. Query keys as arrays for granular invalidation
4. Mutations call `invalidateQueries` on success

### State Management
- **Server state**: TanStack Query (projects, assignments, L10 data)
- **Client state**: Zustand stores (sidebar, L10 team selection, undo stack)
- **Form state**: react-hook-form with Zod resolvers
- **URL state**: Next.js searchParams for filters

## Key Architectural Decisions

### Authentication
- Supabase Auth with email/password (no social login for staff)
- Microsoft OAuth for calendar/file integrations only
- Customer portal uses token-based access (no auth required for public pages)
- Middleware refreshes session on every request

### Database
- PostgreSQL via Supabase with 51 migrations
- Row Level Security on all tables
- Realtime subscriptions for L10 meeting collaboration
- Service role client for admin operations and portal access

### File Architecture
```
Route Groups:
  (auth)      → /login
  (dashboard) → Protected staff routes
  (customer)  → Protected customer routes

Public Routes:
  /status/[token]  → Customer portal (token-based)
  /confirm/[token] → Address confirmation
  /api/*           → API endpoints
```

### Component Organization
Components are organized by feature domain, not by type:
- `components/calendar/` - All calendar UI (39 files)
- `components/projects/` - All project UI (26 files)
- `components/l10/` - All L10 meeting UI (36 files)
- `components/ui/` - Shared shadcn/ui primitives (32 files)

### External Integrations
All integrations are isolated in `src/lib/`:
- `lib/odoo/` - Read-only Odoo 18 client (triple-layer safety)
- `lib/microsoft-graph/` - OAuth + Graph API
- `lib/sharepoint/` - SharePoint file operations
- `lib/email/` - Resend email service

### Background Jobs
- `node-cron` for Microsoft token refresh (every 4 hours)
- Initialized in `src/instrumentation.ts` on server startup
- Production-only (skipped in development)
