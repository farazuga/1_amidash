# Security

## Authentication

### Supabase Auth
- Email/password authentication for all users
- Session managed via httpOnly cookies (Supabase SSR)
- Middleware refreshes session on every request
- No social login for staff (Microsoft OAuth is for integrations only)

### Customer Authentication
- Separate customer role with email/password
- Customers can only access `/customer/*` routes
- RLS enforces project access by POC email match

### Portal Access
- Public pages (`/status/[token]`, `/confirm/[token]`) use opaque UUID tokens
- No authentication required - token acts as capability
- Service role client used to bypass RLS for portal queries

## Authorization

### Role-Based Access
| Role | Dashboard | Projects | Calendar | L10 | Admin | Portal |
|------|-----------|----------|----------|-----|-------|--------|
| Admin | Full | Full | Full | Full | Full | - |
| Editor | Full | Full | Full | Full | - | - |
| Viewer | Read | Read | Read | Read | - | - |
| Customer | - | Own only | - | - | - | Own only |

### Middleware Route Protection
```
Staff routes:   /projects, /admin, /calendar, /l10, /approvals
Customer routes: /customer/*
Public routes:   /status/[token], /confirm/[token]
API routes:      Individual auth checks per endpoint
```

### Row Level Security (RLS)
All Supabase tables have RLS enabled. Key policies:
- `projects`: Staff see all, customers see only where `poc_email` matches their email (case-insensitive)
- `app_settings`: Admin-only read/write
- `l10_*`: Team membership based access
- `project_files`: All authenticated can view, owner or admin can edit/delete

## CSRF Protection

### Email Routes
Origin header validated against `NEXT_PUBLIC_APP_URL`:
```typescript
const origin = request.headers.get('origin');
if (origin && !origin.startsWith(process.env.NEXT_PUBLIC_APP_URL!)) {
  return Response.json({ error: 'Invalid origin' }, { status: 403 });
}
```

### Microsoft OAuth
- 64-character cryptographic state parameter
- Stored in httpOnly, secure, sameSite=lax cookie (10-min expiry)
- Validated in callback before token exchange

## Input Validation

### Zod Schemas
All inputs validated server-side with Zod `.safeParse()`:
- `src/lib/validation.ts` - Global schemas (email, role, booking status)
- `src/lib/calendar/validation.ts` - Calendar entities
- `src/lib/l10/validation.ts` - L10 entities

### API Route Pattern
```typescript
const parsed = schema.safeParse(body);
if (!parsed.success) {
  return Response.json({ error: 'Invalid request', details: parsed.error.flatten().fieldErrors }, { status: 400 });
}
```

## Token Encryption

### Algorithm
AES-256-GCM with scrypt key derivation.

### Implementation (`src/lib/crypto.ts`)
- Key: Derived from `TOKEN_ENCRYPTION_KEY` via `scryptSync` (memory-hard KDF)
- IV: 16 random bytes per encryption
- Salt: 32 random bytes per encryption
- Auth tag: 16 bytes (GCM built-in)

### Ciphertext Format
```
Base64([salt 32B][iv 16B][authTag 16B][ciphertext])
```

### Production Requirement
`TOKEN_ENCRYPTION_KEY` is mandatory in production. The app refuses to store tokens without encryption in production environments.

## Rate Limiting

### Portal Uploads
- **Limit**: 10 uploads per hour per portal token
- **Storage**: In-memory Map
- **Response**: 429 Too Many Requests

### Microsoft OAuth Retry
- **Cooldown**: 10 seconds per user+assignment
- **Cleanup**: Every 5 minutes (prevents memory leaks)
- **Response**: 429 with remaining wait time

## Security Headers

Applied to all routes in `next.config.ts`:

| Header | Value |
|--------|-------|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-XSS-Protection` | `1; mode=block` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` (prod only) |
| `Permissions-Policy` | camera=(self), microphone=(self), geolocation=() |

### Content Security Policy
```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https: http:;
connect-src 'self' https://*.supabase.co wss://*.supabase.co
            https://login.microsoftonline.com https://graph.microsoft.com
            https://*.sharepoint.com;
frame-ancestors 'none';
form-action 'self';
object-src 'none';
upgrade-insecure-requests;
block-all-mixed-content;
```

## Odoo Integration Security

Triple-layer read-only enforcement:
1. **TypeScript**: Only `searchRead()` and `read()` methods exposed
2. **Runtime**: Method allowlist check (`search_read`, `read`, `fields_get` only)
3. **Odoo config**: API user should have read-only permissions in Odoo

## File Upload Security

### Portal Uploads
- EXIF metadata stripped from images
- File type validation
- Size limits enforced
- Rate limiting (10/hour per token)

### Project Files
- Server actions body size limit: 100MB (for video)
- File type detection via `file-type` library
- Stored in Supabase storage with RLS

## Background Token Refresh

- `node-cron` job runs every 4 hours (production only)
- Decrypts stored tokens, calls Microsoft Graph `/me` to keep sessions alive
- Initialized in `src/instrumentation.ts` on server startup
- Logs success/failure counts
