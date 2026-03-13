# Integrations

## Odoo 18 (Sales Orders)

### Purpose
Read-only integration with Odoo 18 SH (on-premise hosted) to pull sales order data for auto-populating project creation forms.

### Architecture
```
src/lib/odoo/
├── client.ts   # OdooReadOnlyClient (singleton, JSON-RPC)
├── queries.ts  # Domain queries (sales orders, partners, products)
└── index.ts    # Public exports
```

### API Endpoints
- `POST /api/odoo/pull` - Pull sales order by number (S1XXXX)
- `POST /api/odoo/invoice-status` - Refresh invoice status
- `POST /api/odoo/summarize` - AI description from line items
- `GET /api/odoo/activities` - Get related activities

### Data Flow
1. User enters sales order number (S1XXXX format)
2. System fetches: client info, POC, sales amount, PO number, salesperson, line items
3. Line items sent to Claude API for 3-4 bullet project description
4. Project type auto-detected from line items:
   - Contains "install" → Solution
   - Contains "ami_vidpod" (no install) → VidPod
   - Neither → Box Sale
5. Salesperson fuzzy-matched to existing profiles by name

### Safety
- TypeScript: Only `searchRead()`, `read()` public
- Runtime: Method allowlist (`search_read`, `read`, `fields_get`)
- Config: API user with read-only Odoo permissions

### Environment Variables
```env
ODOO_URL=https://company.odoo.com
ODOO_DB=database-name
ODOO_USER_LOGIN=api@company.com
ODOO_API_KEY=your-api-key
```

### Database Columns (projects table)
- `odoo_order_id` (integer) - Odoo sales order ID
- `odoo_invoice_status` (text) - "no", "to invoice", "invoiced"
- `odoo_last_synced_at` (timestamptz)
- `project_description` (text) - Generated or manual

---

## Microsoft (OAuth, Outlook, SharePoint)

### Purpose
OAuth2 integration for Outlook calendar sync and SharePoint file management.

### Architecture
```
src/lib/microsoft-graph/
├── auth.ts    # MSAL authentication
├── client.ts  # Graph API client
├── sync.ts    # Calendar sync logic
└── types.ts   # Type definitions

src/lib/sharepoint/
├── client.ts           # SharePoint API
├── folder-operations.ts # Folder management
└── types.ts
```

### OAuth Flow
1. User clicks "Connect Microsoft" → `GET /api/auth/microsoft`
2. CSRF state generated (64-char hex), stored in httpOnly cookie
3. Redirect to Microsoft login with scopes
4. Callback → `GET /api/auth/microsoft/callback`
5. State validated, code exchanged for tokens
6. Tokens encrypted (AES-256-GCM) and stored in `calendar_connections`

### Scopes
- `openid`, `profile`, `email`, `offline_access`
- `User.Read`
- `Calendars.ReadWrite`
- `Sites.Read.All`
- `Files.ReadWrite.All`

### Token Management
- Stored encrypted in `calendar_connections` table
- Refreshed every 4 hours via cron job (`src/lib/cron/token-refresh.ts`)
- CAE (Continuous Access Evaluation) for 28-hour token lifetime
- Encryption mandatory in production

### SharePoint Features
- Browse sites and drives
- Upload files to project folders
- Admin-configurable default SharePoint site
- Per-project folder connections

### Environment Variables
```env
MICROSOFT_CLIENT_ID=uuid
MICROSOFT_CLIENT_SECRET=secret
MICROSOFT_REDIRECT_URI=https://app.com/api/auth/microsoft/callback
MICROSOFT_TENANT_ID=uuid
TOKEN_ENCRYPTION_KEY=hex-key  # Required in production
```

---

## Claude API (Anthropic)

### Purpose
AI-generated project descriptions from Odoo sales order line items.

### Implementation
- Endpoint: `POST /api/odoo/summarize`
- Model: `claude-sonnet-4-20250514`
- Generates 3-4 bullet internal summary
- Groups similar items, skips minor items (shipping, labor)
- Includes product codes like `[ami_VIDPOD]`

### Also used by
- `POST /api/ai/scope` - Scope of work generation

### Environment Variables
```env
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Resend (Email)

### Purpose
Transactional emails for customer notifications.

### Email Types
- **Welcome email** - Sent when customer is onboarded
- **Status change** - Sent when project status changes

### Features
- Custom branding (logo, colors, support contact)
- Portal link with token embedded
- Per-recipient opt-out support
- Global/per-project enable/disable
- CSRF protection (origin validation)

### Implementation
```
src/lib/email/
├── send.ts      # sendEmail() via Resend SDK
├── templates.ts # HTML email generation
└── settings.ts  # checkEmailEnabled()
```

### Environment Variables
```env
RESEND_API_KEY=re_...
```

---

## ActiveCampaign (CRM)

### Purpose
Contact and account lookup for project creation. Pulls POC information from CRM.

### API Endpoints
- `POST /api/activecampaign/accounts` - Search accounts
- `GET /api/activecampaign/accounts` - List accounts
- `GET /api/activecampaign/accounts/[id]/contacts` - Account contacts
- `GET /api/activecampaign/contacts` - Search contacts

### Implementation
- Client: `src/lib/activecampaign.ts`
- Hook: `src/hooks/use-activecampaign.ts`
- Used in project form for contact auto-complete

### Environment Variables
```env
ACTIVECAMPAIGN_ACCOUNT_NAME=account-name
ACTIVECAMPAIGN_API_KEY=key
```

---

## Supabase

### Purpose
Primary database, authentication, file storage, and realtime subscriptions.

### Features Used
- **PostgreSQL** - Main database with 51 migrations
- **Auth** - Email/password authentication, session management
- **Storage** - Project files, thumbnails
- **Realtime** - L10 meeting collaboration (6 tables subscribed)
- **RLS** - Row Level Security on all tables
- **Edge Functions** - Not used (server actions preferred)

### Client Setup
- Server: `src/lib/supabase/server.ts` (cookie-based)
- Browser: `src/lib/supabase/client.ts` (singleton)
- Middleware: `src/lib/supabase/middleware.ts` (session refresh)

### Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```
