# Environment Setup

## Prerequisites
- Node.js 18+
- npm 9+
- Supabase account (for database)
- Railway account (for deployment)

## Local Development

### 1. Clone and Install
```bash
git clone <repo-url>
cd amidash
npm install
```

### 2. Environment Variables

Create `.env.local` with the following variables:

#### Required - Supabase
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

#### Required - Application
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### Optional - Microsoft OAuth
Required for Outlook calendar sync and SharePoint file management.
```env
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/auth/microsoft/callback
MICROSOFT_TENANT_ID=your-tenant-id
TOKEN_ENCRYPTION_KEY=your-256-bit-hex-key
```
Note: `TOKEN_ENCRYPTION_KEY` is **mandatory in production** (AES-256-GCM encryption). In development, tokens are stored unencrypted with a warning.

#### Optional - Odoo 18
Required for sales order integration.
```env
ODOO_URL=https://your-company.odoo.com
ODOO_DB=your-database
ODOO_USER_LOGIN=api@your-company.com
ODOO_API_KEY=your-api-key
```

#### Optional - Claude API
Required for AI-generated project descriptions.
```env
ANTHROPIC_API_KEY=sk-ant-...
```

#### Optional - Email (Resend)
Required for sending status change and welcome emails.
```env
RESEND_API_KEY=re_...
```

#### Optional - ActiveCampaign
Required for CRM contact lookup.
```env
ACTIVECAMPAIGN_ACCOUNT_NAME=your-account
ACTIVECAMPAIGN_API_KEY=your-key
```

#### Optional - Signage
```env
SIGNAGE_API_URL=http://localhost:3001
```

#### Auto-set by Railway
```env
RAILWAY_ENVIRONMENT_NAME=production
NODE_ENV=production
```

### 3. Database Setup
```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase db push   # Apply all migrations
```

### 4. Start Development
```bash
npm run dev    # Starts on http://localhost:3000
```

### 5. Generate Types (after migration changes)
```bash
npx supabase gen types typescript --project-id your-project-ref > src/types/database.ts
```

## Production Deployment (Railway)

Railway auto-deploys from the main branch. Required environment variables must be set in Railway dashboard.

### Critical Production Requirements
- `TOKEN_ENCRYPTION_KEY` must be set (mandatory for OAuth token encryption)
- `NODE_ENV=production` (auto-set by Railway)
- Cron job for token refresh runs automatically in production only

## Development Tools

### Database GUI
- Supabase Dashboard: https://supabase.com/dashboard
- Direct PostgreSQL connection available in Supabase settings

### Email Testing
- Resend dashboard for delivery logs
- Set `canSendEmail: false` in `checkEmailEnabled` mock for test environments

### Microsoft OAuth Testing
- Register app in Azure Portal (portal.azure.com)
- Redirect URI must match `MICROSOFT_REDIRECT_URI` exactly
- Required API permissions: User.Read, Calendars.ReadWrite, Sites.Read.All, Files.ReadWrite.All
