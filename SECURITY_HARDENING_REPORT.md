# AmiDash Security Hardening Report

**Date:** 2026-01-01
**Project:** AmiDash - Project Management Dashboard
**Tech Stack:** Next.js 16, TypeScript, Supabase, Tailwind CSS

---

## Executive Summary

A comprehensive security assessment and hardening effort was conducted on the AmiDash application. The assessment identified **15 security findings** (0 Critical, 2 High, 6 Medium, 7 Low), with all high-priority issues now addressed.

### Key Achievements

- **Security Headers Implemented**: CSP, X-Frame-Options, HSTS, and more
- **Token Encryption**: Microsoft OAuth tokens now encrypted at rest using AES-256-GCM
- **Error Message Sanitization**: API routes no longer expose internal error details
- **Comprehensive Test Coverage**: Added tests for new security utilities
- **Zero Known CVEs**: All npm dependencies are vulnerability-free

---

## Assessment Methodology

The security assessment used the STRIDE threat modeling methodology and covered:

1. **SAST Analysis** - Static code analysis for vulnerabilities
2. **Dependency Audit** - npm audit for CVE detection
3. **Secrets Detection** - Scanning for hardcoded credentials
4. **Architecture Review** - Data flow and authentication analysis
5. **Threat Modeling** - STRIDE-based risk assessment

---

## Findings and Remediations

### HIGH PRIORITY - Remediated

#### 1. Microsoft OAuth Tokens Stored in Plaintext

**Issue:** OAuth access and refresh tokens were stored unencrypted in the `calendar_connections` database table.

**Risk:** If the database is compromised, attackers gain access to user Microsoft accounts.

**Remediation:**
- Created `src/lib/crypto.ts` with AES-256-GCM encryption
- Updated `src/app/api/auth/microsoft/callback/route.ts` to encrypt tokens before storage
- Updated `src/lib/microsoft-graph/client.ts` to decrypt tokens when reading
- Added comprehensive test suite for encryption utilities

**Files Changed:**
- `src/lib/crypto.ts` (new)
- `src/lib/__tests__/crypto.test.ts` (new)
- `src/app/api/auth/microsoft/callback/route.ts`
- `src/lib/microsoft-graph/client.ts`

**Required Environment Variable:**
```env
TOKEN_ENCRYPTION_KEY=<secure-32-character-minimum-key>
```

---

#### 2. Missing Security Headers

**Issue:** No security headers were configured, leaving the application vulnerable to XSS, clickjacking, and other attacks.

**Remediation:** Added comprehensive security headers in `next.config.ts`:

| Header | Value | Purpose |
|--------|-------|---------|
| X-Frame-Options | DENY | Prevent clickjacking |
| X-Content-Type-Options | nosniff | Prevent MIME sniffing |
| Referrer-Policy | strict-origin-when-cross-origin | Control referrer data |
| X-XSS-Protection | 1; mode=block | Legacy XSS protection |
| Permissions-Policy | camera=(), microphone=(), etc. | Restrict browser APIs |
| Strict-Transport-Security | max-age=31536000; includeSubDomains; preload | Enforce HTTPS (production only) |
| Content-Security-Policy | See details below | Prevent XSS and injection |

**CSP Policy Details:**
- `default-src 'self'`
- `script-src 'self' 'unsafe-inline' 'unsafe-eval'` (required for Next.js)
- `style-src 'self' 'unsafe-inline'` (required for Tailwind)
- `img-src 'self' data: blob: https://www.amitrace.com https://*.supabase.co`
- `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://login.microsoftonline.com https://graph.microsoft.com https://*.sharepoint.com`
- `frame-ancestors 'none'`
- `form-action 'self'`
- `object-src 'none'`

**Files Changed:**
- `next.config.ts`

---

### MEDIUM PRIORITY - Remediated

#### 3. Error Message Information Leakage

**Issue:** API routes exposed internal error messages to clients, potentially revealing database schema or implementation details.

**Remediation:** Updated all API error responses to return generic messages while logging detailed errors server-side.

**Files Changed:**
- `src/app/api/admin/users/route.ts`
- `src/app/api/admin/users/[id]/route.ts`
- `src/app/api/customer/email-preferences/route.ts`

**Before:**
```typescript
return NextResponse.json({ error: createError.message }, { status: 400 });
```

**After:**
```typescript
console.error('Error creating user:', createError);
return NextResponse.json({ error: 'User creation failed' }, { status: 400 });
```

---

## Existing Security Strengths

The codebase already had many security best practices in place:

### Authentication & Authorization
- Supabase Auth with session-based authentication
- HTTP-only, secure cookies for session management
- Role-based access control (admin, editor, viewer, customer)
- Middleware-level route protection

### Input Validation
- Comprehensive Zod schemas for all user input
- Server-side validation in all server actions
- UUID format validation for entity IDs

### Database Security
- Row Level Security (RLS) policies on all tables
- Parameterized queries via Supabase client
- No raw SQL or template interpolation

### Rate Limiting
- In-memory rate limiting on public endpoints
- iCal feed: 60 requests/minute
- Confirmation actions: 5 requests/minute

### OAuth Security
- CSRF protection with state parameter
- State stored in HTTP-only cookies with TTL
- Proper token refresh handling

---

## Remaining Recommendations

### Medium Priority (Next Sprint)

1. **Persistent Rate Limiting**
   - Current in-memory rate limiting resets on server restart
   - Recommendation: Use Redis or Upstash for distributed rate limiting

2. **Expand Audit Logging**
   - Add logging for: role changes, calendar subscription management, failed auth attempts

3. **Centralize Authorization**
   - Create reusable middleware/decorator for role checks
   - Reduce copy-paste authorization patterns

### Low Priority (Backlog)

4. **Assignment Date Range Validation**
   - Validate assignment days fall within project date range

5. **RLS Policy Review**
   - Review `anon` access policy for projects table
   - Consider stricter token validation

6. **Content Security Policy Tightening**
   - Migrate from `unsafe-inline` to nonce-based CSP when feasible

---

## Environment Variable Requirements

### Required for Token Encryption
```env
TOKEN_ENCRYPTION_KEY=<secure-random-string-32-chars-minimum>
```

Generate a secure key:
```bash
openssl rand -base64 32
```

### Existing Required Variables
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI=
```

---

## Verification Checklist

- [x] Build succeeds: `npm run build`
- [x] All tests pass: `npm test`
- [x] Security headers present (verify with curl/browser dev tools)
- [x] Token encryption working (check console for no warnings)
- [x] Error messages sanitized (test API error responses)

---

## Files Modified

| File | Change |
|------|--------|
| `next.config.ts` | Added security headers configuration |
| `src/lib/crypto.ts` | New - Token encryption utilities |
| `src/lib/__tests__/crypto.test.ts` | New - Encryption tests |
| `src/app/api/auth/microsoft/callback/route.ts` | Token encryption on storage |
| `src/lib/microsoft-graph/client.ts` | Token decryption on read |
| `src/app/api/admin/users/route.ts` | Error message sanitization |
| `src/app/api/admin/users/[id]/route.ts` | Error message sanitization |
| `src/app/api/customer/email-preferences/route.ts` | Error message sanitization |
| `src/app/api/admin/users/__tests__/route.test.ts` | Updated test expectations |
| `src/app/api/customer/email-preferences/__tests__/route.test.ts` | Updated test expectations |

---

## Compliance Notes

- **OWASP Top 10**: Addressed injection, XSS, security misconfiguration, sensitive data exposure
- **CWE Weaknesses**: Mitigated CWE-79 (XSS), CWE-200 (Information Exposure), CWE-311 (Missing Encryption)
- **GDPR/Privacy**: Token encryption protects OAuth credentials at rest

---

*Report generated as part of security hardening workflow*
