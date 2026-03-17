# AmiDash Security Review

**Date:** 2026-03-17
**Branch:** `feature/security`
**Methodology:** STRIDE Threat Model, OWASP Top 10 (2021), Attack Tree Analysis, Threat-Mitigation Mapping, Security Requirement Extraction

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Defense-in-Depth Coverage](#defense-in-depth-coverage)
3. [STRIDE Threat Analysis](#stride-threat-analysis)
4. [OWASP Top 10 Assessment](#owasp-top-10-assessment)
5. [Attack Trees](#attack-trees)
6. [Threat-Mitigation Mapping](#threat-mitigation-mapping)
7. [Master Finding List](#master-finding-list)
8. [Security Requirements](#security-requirements)
9. [Implementation Plan](#implementation-plan)

---

## Executive Summary

A comprehensive security audit of the AmiDash codebase was performed using 5 parallel analysis methodologies. The audit identified **20 unique findings** across 6 STRIDE categories and 10 OWASP categories.

### Risk Summary

| Severity | Count | Examples |
|----------|-------|---------|
| **Critical** | 3 | Debug endpoint exposed, mobile API no role checks, mobile uploads skip file validation |
| **High** | 10 | Error message leakage, no rate limiting, 100MB body limit, AI prompt override, vulnerable deps |
| **Medium** | 7 | Excessive logging, missing audit logs, API fan-out, PWA cache, filter injection |

### What's Working Well

- No hardcoded secrets — all credentials via `process.env`
- Proper auth checks on most dashboard routes
- DOMPurify for HTML rendering with restricted allowlist
- Supabase parameterized queries throughout (no raw SQL)
- Token storage in HTTP-only cookies (Supabase SSR)
- Role-based admin authorization on admin routes
- Odoo client triple-layer read-only enforcement
- Portal file validation (magic bytes, size limits, EXIF stripping, filename sanitization)
- HSTS, X-Frame-Options, X-Content-Type-Options headers configured
- `.gitignore` properly excludes `.env*` and `.mcp.json`

---

## Defense-in-Depth Coverage

| Layer | Spoofing | Tampering | Repudiation | Info Disclosure | DoS | Privilege Escalation |
|-------|----------|-----------|-------------|-----------------|-----|---------------------|
| **Network** | HSTS, TLS | CSP (weak) | -- | Referrer-Policy | -- | -- |
| **Application** | Middleware auth | Zod (partial) | audit_logs | Generic errors (inconsistent) | Rate limit (portal only) | Role checks (most routes) |
| **Data** | Supabase JWT | File validation (portal only) | DB audit table | -- | File size (portal only) | RLS on all tables |
| **Endpoint** | Bearer token | File sanitization (portal only) | -- | Permissions-Policy | -- | Admin-only UI |
| **Process** | Odoo read-only | Input schemas | Admin audit viewer | Dev-only debug | -- | Self-deletion prevention |

**Key gaps:** DoS has almost no coverage. Mobile routes skip all file/auth controls that portal has. Info disclosure controls are inconsistent.

---

## STRIDE Threat Analysis

### S — Spoofing (Identity)

#### S1. [CRITICAL] Debug Endpoint Exposes Microsoft Graph Token Without Authentication

- **File:** `src/app/api/auth/microsoft/debug/route.ts`
- **Detail:** The `/api/auth/microsoft/debug` GET endpoint has zero authentication. It fetches a fresh app-level Microsoft Graph access token, decodes it, and returns the roles, scopes, appId, and tenantId to any caller. The comment says "TEMPORARY: Remove after confirming permissions work" — it was never removed.
- **Impact:** Reconnaissance asset for attacking the Azure AD application.
- **Fix:** Delete the file immediately.

#### S2. [HIGH] Portal Token-Based Authentication is Brute-Forceable

- **Files:** `src/app/status/[token]/page.tsx`, `src/app/api/portal/upload/route.ts`, `src/app/api/portal/confirm-address/route.ts`
- **Detail:** Portal `client_token` is a UUID v4 (128 bits entropy, not brute-forceable), but tokens have no expiration, no scope limitation, and no revocation mechanism. The confirm-address endpoint has no rate limiting at all.
- **Impact:** Permanent access if token is leaked via email forwarding, browser history, etc.
- **Fix:** Add `client_token_expires_at` column, 90-day default TTL, admin UI for rotation.

#### S3. [MEDIUM] Mobile API Bearer Token Extraction is Weak

- **Files:** All `/api/mobile/*` routes
- **Detail:** Pattern `authHeader?.replace('Bearer ', '')` is a simple string replace, not a proper header parse. Functionally safe (Supabase rejects invalid tokens) but not defense-in-depth.
- **Fix:** Use regex: `authHeader?.match(/^Bearer\s+(.+)$/)?.[1]`

### T — Tampering (Data Integrity)

#### T1. [CRITICAL] Mobile Upload Routes Accept Arbitrary Files Without Validation

- **Files:** `src/app/api/mobile/sharepoint/upload/route.ts`, `src/app/api/mobile/presales/upload/route.ts`
- **Detail:** These upload endpoints accept any file type, any file size, with no validation. Compare to portal upload which properly uses `validateFileType()`, `validateFileSize()`, `sanitizeFilename()`, and `stripExifData()`. Mobile endpoints have no file size limit (100MB server action limit applies), no file type validation, no filename sanitization, no EXIF stripping.
- **Impact:** Authenticated users can upload executables to corporate SharePoint.
- **Fix:** Port `file-security.ts` validation pipeline to mobile upload routes.

#### T2. [HIGH] AI Scope Builder Accepts User-Controlled System Prompt

- **File:** `src/app/api/ai/scope/route.ts` (line 74)
- **Detail:** The endpoint accepts a `system_prompt_override` field in the request body. Any authenticated user can override the system prompt sent to the Claude API, enabling prompt injection.
- **Fix:** Remove `system_prompt_override` from the API or restrict to admin role.

#### T3. [MEDIUM] PostgREST Filter Injection via Search

- **File:** `src/app/(dashboard)/projects/page.tsx` (lines 146-149)
- **Detail:** `searchParams.search` is interpolated directly into the PostgREST `.or()` filter string without escaping `,` or `.` characters. A crafted search like `foo%,id.eq.` could inject additional filter clauses. Runs under RLS so impact is limited.
- **Fix:** Escape `.`, `,`, and `%` characters before interpolation.

#### T4. [MEDIUM] No CSRF Protection on Most POST Routes

- **Detail:** Only `src/app/api/email/status-change/route.ts` checks `Origin` header. All other POST API routes lack CSRF protection. Next.js server actions have built-in CSRF, but API routes do not.
- **Fix:** Add Origin/Referer check to all POST API routes, or migrate to server actions.

### R — Repudiation (Non-Repudiation)

#### R1. [MEDIUM] Limited Audit Trail for Sensitive Operations

- **Detail:** Admin user creation, password resets, calendar operations, L10 meeting operations, portal actions, and SharePoint operations are not audit-logged. Only project CRUD and user deletion are logged.
- **Fix:** Extend audit logging to cover admin ops, calendar assignments, and portal actions.

#### R2. [LOW] Console-Only Logging with No Retention

- **Detail:** 365 `console.log/error/warn` calls across 55 source files. Mobile upload routes have 29 console.log statements with user IDs, file names, project details. No structured logging or retention policy.
- **Fix:** Adopt structured logging (pino), suppress debug in production, redact PII.

### I — Information Disclosure

#### I1. [HIGH] Error Messages Leak Internal Details in 21+ Routes

- **Files:** Multiple API routes
- **Detail:** Pattern `error instanceof Error ? error.message : 'fallback'` appears across the codebase. Supabase errors, Odoo errors, SharePoint errors, Claude API errors are forwarded to the client. These can reveal database schema, API endpoint URLs, file system paths.
- **Key locations:**
  - `src/app/api/mobile/sharepoint/upload/route.ts:317,333`
  - `src/app/api/mobile/presales/upload/route.ts:272,288`
  - `src/app/api/mobile/projects/route.ts:54`
  - `src/app/api/odoo/pull/route.ts:202`
  - `src/app/api/odoo/summarize/route.ts:91`
  - `src/app/api/admin/users/[id]/reset-password/route.ts:50`
  - `src/app/api/portal/confirm-address/route.ts:65`
  - `src/app/api/auth/microsoft/sync/route.ts:44`
  - `src/app/api/ai/scope/route.ts:185`
- **Fix:** Return generic error messages to clients. Log detailed errors server-side only. Include a correlation ID for debugging.

#### I2. [HIGH] Mobile Projects Endpoint Bypasses RLS

- **File:** `src/app/api/mobile/projects/route.ts` (line 35)
- **Detail:** After authenticating the user, the endpoint uses `createServiceClient()` to query ALL projects, bypassing Row Level Security. Any authenticated user (including customers) sees all projects.
- **Fix:** Use the authenticated user's Supabase client (respecting RLS) or add explicit role/ownership checks.

#### I3. [MEDIUM] Portal Status Page Exposes Full Project Object

- **File:** `src/app/status/[token]/page.tsx` (line 56)
- **Detail:** Query uses `select('*')` on the projects table. Likely includes internal fields like `client_token`, internal notes, financial data.
- **Fix:** Select only the specific columns needed for portal display.

#### I4. [MEDIUM] SOW Config Error Path Returns Data Without Auth

- **File:** `src/app/api/sow/config/route.ts` (line 271)
- **Detail:** On error, returns all default template data including the full system prompt, bypassing authentication.
- **Fix:** Ensure catch block re-checks auth before returning data.

### D — Denial of Service

#### D1. [HIGH] No Rate Limiting on Most API Endpoints

- **Detail:** Only portal uploads (10/hr/token) and retry endpoints (10s cooldown) have rate limiting. All other endpoints — admin, mobile, Odoo, AI, email, SharePoint, ActiveCampaign — have zero rate limiting. AI endpoints incur per-call API costs.
- **Fix:** Implement persistent rate limiting (Upstash Redis). Per-route limits: auth (10/min), AI (20/hr/user), admin (60/min), general (120/min/user).

#### D2. [HIGH] 100MB Server Action Body Size Limit

- **File:** `next.config.ts` (line 102)
- **Detail:** `serverActions.bodySizeLimit: '100MB'` applies to ALL server actions, not just video uploads. Multiple concurrent 100MB requests exhaust server memory.
- **Fix:** Reduce global limit to 4MB. Use dedicated upload routes for large files.

#### D3. [MEDIUM] Unbounded API Fan-Out in ActiveCampaign Route

- **Files:** `src/app/api/activecampaign/deals/route.ts`, `src/app/api/mobile/activecampaign/deals/route.ts`
- **Detail:** `Promise.all(deals.map(...))` fires 3 parallel API calls per deal. With 50 deals: 1 request → 150+ external API calls. No caching, no pagination limits.
- **Fix:** Add concurrency limiting (p-limit), caching, and pagination.

#### D4. [MEDIUM] In-Memory Rate Limiting Resets on Deploy

- **File:** `src/lib/portal/rate-limit.ts`
- **Detail:** Rate limiting uses in-memory Maps that reset on every deployment or server restart. Map entries are never pruned — memory leak risk.
- **Fix:** Use Redis-based rate limiting. Add periodic cleanup.

### E — Elevation of Privilege

#### E1. [CRITICAL] Mobile API Routes Have No Role-Based Access Control

- **Files:** All `/api/mobile/*` routes
- **Detail:** Mobile endpoints authenticate the user via Supabase JWT but never check the user's role. A customer-role user can: list all projects (`GET /api/mobile/projects`), upload files to any project's SharePoint folder, upload presales files, fetch ActiveCampaign deals.
- **Fix:** Add role checks to all mobile endpoints. Reject customer role. Add project-level authorization for uploads.

#### E2. [HIGH] Upload Routes Accept Any projectId Without Ownership Check

- **Files:** `src/app/api/mobile/sharepoint/upload/route.ts`, `src/app/api/files/upload/route.ts`
- **Detail:** Both accept a `projectId` parameter and use the service client to look up and modify the project. No verification that the authenticated user has access to that project.
- **Fix:** Verify project access using user's Supabase client (with RLS) or implement explicit ownership checks.

#### E3. [HIGH] CSP Allows unsafe-eval

- **File:** `next.config.ts` (line 58)
- **Detail:** `script-src 'self' 'unsafe-inline' 'unsafe-eval'` weakens XSS protections significantly. If any injection point exists, XSS is not blocked by CSP.
- **Fix:** Migrate to nonce-based CSP using Next.js middleware. Remove `unsafe-eval`.

#### E4. [MEDIUM] Middleware Does Not Protect API Routes

- **File:** `src/lib/supabase/middleware.ts`
- **Detail:** Middleware only enforces auth for staff/customer page routes. API routes under `/api/*` pass through without auth enforcement. Each handler must self-enforce. If a developer forgets auth in a new route, it's publicly accessible.
- **Fix:** Add middleware-level auth enforcement for all `/api/*` routes except explicitly whitelisted public endpoints.

---

## OWASP Top 10 Assessment

| Category | Risk Level | Key Finding |
|----------|-----------|-------------|
| **A01 Broken Access Control** | Medium | Debug endpoint no auth; mobile routes lack role checks |
| **A02 Cryptographic Failures** | Low | Strong crypto (AES-256-GCM); minor password policy gap (8 char min, no complexity) |
| **A03 Injection** | Medium | PostgREST filter injection via `.or()` search interpolation |
| **A04 Insecure Design** | Medium | Non-expiring portal tokens; email-only address verification |
| **A05 Security Misconfiguration** | Low | CSP undermined by unsafe-inline/unsafe-eval; PWA caches API responses 24h |
| **A06 Vulnerable Components** | **High** | Next.js CVEs (DoS via Image Optimizer, RSC DoS, PPR memory), undici, file-type, next-pwa unmaintained |
| **A07 Auth Failures** | Low | Adequate overall; no MFA option, weak password policy |
| **A08 Data Integrity** | Low | AI prompt override from client; JSON parse of AI response (handled gracefully) |
| **A09 Logging Failures** | Medium | Most security events not audit-logged; no auth failure logging |
| **A10 SSRF** | Low | All external URLs hardcoded from env vars; no user-supplied URL fetching |

### A06 Vulnerable Dependencies Detail

| Package | Severity | Issue |
|---------|----------|-------|
| `next` (16.1.1) | HIGH | 3 CVEs: DoS Image Optimizer, RSC DoS, PPR memory |
| `undici` (transitive) | HIGH | 6 advisories: WebSocket overflow, HTTP smuggling, CRLF injection |
| `serialize-javascript` (transitive) | HIGH | RCE via RegExp.flags |
| `next-pwa` (>=2.1.0) | HIGH | Unmaintained, pulls vulnerable workbox-build and rollup-plugin-terser |
| `file-type` (16.5.4) | MODERATE | Infinite loop on malformed ASF input (directly exploitable via portal upload) |
| `tar` (transitive) | HIGH | 6 path traversal and symlink poisoning CVEs |
| `flatted` | HIGH | Unbounded recursion DoS |

---

## Attack Trees

### Tree 1: Unauthorized Data Access

```
ROOT: Attacker gains access to project data / customer info
|
+-- [OR] Exploit Portal Token Weakness
|   +-- Brute-force client_token (HIGH difficulty - UUID v4 entropy)
|   +-- Obtain token from leaked portal URL (LOW difficulty)
|   +-- Use valid token to enumerate via confirm-address (LOW difficulty)
|
+-- [OR] Exploit API Route Authorization Gaps
|   +-- Access debug endpoint (TRIVIAL) *** EASIEST PATH ***
|   +-- IDOR: mobile /api/mobile/projects lists ALL projects (LOW)
|   +-- IDOR: mobile SharePoint upload accesses any project folder (LOW)
|   +-- ActiveCampaign deals exposes CRM data (LOW)
|
+-- [OR] Exploit Middleware Auth Bypass
    +-- Access API routes not covered by middleware matcher (MEDIUM)
    +-- Access public routes to extract data (LOW)
```

**Easiest path:** Debug endpoint → zero auth, zero cost, get Azure AD app/tenant IDs.
**Highest impact:** Mobile IDOR → list all projects → upload to any project → read SharePoint folder structures.

### Tree 2: Account/Session Takeover

```
ROOT: Attacker impersonates a legitimate user
|
+-- [OR] Exploit Microsoft OAuth/Graph Token Exposure
|   +-- Harvest Azure AD credentials from debug endpoint (TRIVIAL) *** EASIEST ***
|   +-- [AND] Use appId/tenantId to attack Azure AD app (HIGH)
|
+-- [OR] Steal Supabase Session
|   +-- XSS to steal session cookies (MEDIUM - CSP doesn't block due to unsafe-eval)
|   +-- Session fixation (HIGH - Supabase handles securely)
|   +-- Steal mobile Bearer token from device (MEDIUM)
|
+-- [OR] Admin Account Compromise
    +-- Password reset abuse (HIGH - requires admin session)
    +-- Create new admin via user creation (HIGH - requires admin session)
```

**Highest impact:** XSS (CSP doesn't block) → steal admin session → reset any password → persistent access.

### Tree 3: Service Disruption (DoS)

```
ROOT: Attacker makes AmiDash unavailable
|
+-- [OR] Exploit Large Body Limit
|   +-- 100MB payloads to server actions (TRIVIAL) *** EASIEST ***
|   +-- Large files to portal (LOW - body parsed before size validation)
|
+-- [OR] Exploit Missing Rate Limits
|   +-- Flood unprotected API routes (TRIVIAL)
|   +-- Portal rate limit bypass via restart (LOW)
|
+-- [OR] Trigger External API Fan-Out
|   +-- ActiveCampaign 1:150 amplification (LOW) *** HIGHEST AMPLIFICATION ***
|   +-- Odoo API amplification (LOW)
|   +-- SharePoint API fan-out (LOW)
|
+-- [OR] Memory Exhaustion
    +-- Grow in-memory rate limit map indefinitely (TRIVIAL)
```

**Highest amplification:** 1 ActiveCampaign request → 150+ external API calls.

### Tree 4: Malicious File Upload

```
ROOT: Attacker uploads harmful content
|
+-- [OR] Bypass Portal File Validation
|   +-- Exploit EPS file format trust (LOW - only 4-byte magic check)
|   +-- Polyglot PDF attack (MEDIUM)
|   +-- EXIF stripping bypass for non-JPEG/PNG (LOW)
|
+-- [OR] Exploit Mobile Upload (NO validation)
|   +-- Upload arbitrary files via presales endpoint (TRIVIAL) *** EASIEST ***
|   +-- Upload arbitrary files via SharePoint endpoint (TRIVIAL)
|   +-- Upload malware to shared SharePoint drives (LOW) *** HIGHEST IMPACT ***
|
+-- [OR] Path Traversal
|   +-- Inject path traversal in folder names (MEDIUM)
|   +-- Inject special chars in filename — mobile (LOW)
|
+-- [OR] Storage Exhaustion
    +-- Repeated uploads — no size limit on mobile (TRIVIAL)
    +-- Portal upload spam — limited by rate limiter (LOW)
```

**Highest impact:** Upload malware to SharePoint → employees auto-sync → enterprise compromise.

---

## Threat-Mitigation Mapping

### Control Effectiveness by STRIDE Category

| Category | Overall Effectiveness | Critical Gaps |
|----------|----------------------|---------------|
| Spoofing | **Medium** | Debug endpoint exposed, no MFA, in-memory rate limits |
| Tampering | **Medium** | Inconsistent Zod validation, no CSRF on most routes, CSP unsafe-eval |
| Repudiation | **Medium-High** | Good audit on projects, absent on L10/calendar/portal/admin |
| Info Disclosure | **Medium** | Error messages leak internals, debug endpoint |
| DoS | **Low-Medium** | Rate limiting only on portal/retry, 100MB body limit |
| Privilege Escalation | **Medium-High** | Good RLS + role checks, but IDOR in mobile API |

### Top 10 Remediation Actions (Effort-Prioritized)

| # | Action | Threat | Effort |
|---|--------|--------|--------|
| 1 | Delete `/api/auth/microsoft/debug` | SPOOFING + INFO | 5 min |
| 2 | Add role checks to mobile API routes | ELEVATION | 1 hr |
| 3 | Add CSRF protection to POST API routes | TAMPERING | 2 hr |
| 4 | Replace error.message forwarding with generic messages | INFO | 2 hr |
| 5 | Add file security controls to staff upload routes | TAMPERING + DOS | 2 hr |
| 6 | Add rate limiting to AI/Odoo proxy routes | DOS | 2 hr |
| 7 | Add Zod validation to all remaining API routes | TAMPERING | 4 hr |
| 8 | Implement nonce-based CSP | TAMPERING (XSS) | 4 hr |
| 9 | Add audit logging to admin operations | REPUDIATION | 3 hr |
| 10 | Implement portal token expiry and rotation | SPOOFING | 4 hr |

---

## Master Finding List

### Critical (Fix Today)

| # | Finding | STRIDE | OWASP | Files |
|---|---------|--------|-------|-------|
| 1 | Debug endpoint `/api/auth/microsoft/debug` — unauthenticated, leaks Azure AD metadata | S1, I1 | A01 | `src/app/api/auth/microsoft/debug/route.ts` |
| 2 | Mobile API no role checks — customer users access all projects, upload to any | E1 | A01 | All `src/app/api/mobile/*` routes |
| 3 | Mobile uploads skip all file validation — zero type/size/name checks | T1 | A04 | `src/app/api/mobile/sharepoint/upload/route.ts`, `src/app/api/mobile/presales/upload/route.ts` |

### High Priority (This Sprint)

| # | Finding | STRIDE | OWASP | Files |
|---|---------|--------|-------|-------|
| 4 | Error messages leak internals in 21+ routes | I1 | A05 | Multiple — see I1 section above |
| 5 | No rate limiting on AI, Odoo, admin, mobile endpoints | D1 | A04 | All `/api/*` except portal |
| 6 | 100MB server action body limit applies globally | D2 | A04 | `next.config.ts:102` |
| 7 | AI endpoint accepts `system_prompt_override` from any user | T2 | A08 | `src/app/api/ai/scope/route.ts:74` |
| 8 | Vulnerable dependencies — Next.js CVEs, file-type DoS, next-pwa unmaintained | -- | A06 | `package.json` |
| 9 | CSP allows `unsafe-eval` — XSS protections disabled | E3 | A05 | `next.config.ts:58` |
| 10 | Portal tokens never expire — permanent access | S2 | A04 | `src/app/api/portal/upload/route.ts`, `src/app/status/[token]/page.tsx` |
| 11 | PostgREST filter injection via `.or()` search | T3 | A03 | `src/app/(dashboard)/projects/page.tsx:146-149` |
| 12 | Mobile projects bypasses RLS via `createServiceClient()` | I2 | A01 | `src/app/api/mobile/projects/route.ts:35` |
| 13 | No CSRF protection on most POST API routes | T4 | A01 | Multiple POST `/api/*` routes |

### Medium Priority (Next Sprint)

| # | Finding | STRIDE | OWASP | Files |
|---|---------|--------|-------|-------|
| 14 | Excessive console.log in production (365 calls, PII in logs) | I | A09 | Mobile upload routes primarily |
| 15 | Missing audit logging for admin ops, calendar, portal | R1 | A09 | Admin routes, calendar actions |
| 16 | ActiveCampaign 150x API fan-out (no batching) | D3 | -- | `src/app/api/activecampaign/deals/route.ts` |
| 17 | In-memory rate limiter resets on deploy | D4 | A04 | `src/lib/portal/rate-limit.ts` |
| 18 | PWA caches sensitive API responses for 24 hours | I | A05 | `next.config.ts:107-117` |
| 19 | SOW config error path returns data without auth check | I4 | A01 | `src/app/api/sow/config/route.ts:271` |
| 20 | Portal status page uses `SELECT *` exposing full project | I3 | A01 | `src/app/status/[token]/page.tsx:56` |

---

## Security Requirements

### Critical Priority

| ID | Title | Description | Effort |
|----|-------|-------------|--------|
| SR-001 | Remove debug endpoint | Delete `src/app/api/auth/microsoft/debug/route.ts`. No route at `/api/auth/microsoft/debug` in production. | Small |
| SR-002 | Add portal token expiration | Add `client_token_expires_at` column, 90-day default TTL, validate in upload/status routes, admin UI for rotation. | Medium |
| SR-003 | Sanitize API error messages | All API catch blocks return generic messages. Log details server-side with correlation ID. No `error.message` in `NextResponse.json()`. | Medium |

### High Priority

| ID | Title | Description | Effort |
|----|-------|-------------|--------|
| SR-004 | Add rate limiting | Centralized rate limiting (Upstash Redis). Limits per route group: auth (10/min), AI (20/hr/user), admin (60/min), general (120/min/user). HTTP 429 with Retry-After. | Large |
| SR-005 | Strengthen CSP | Remove `unsafe-eval` from script-src. Remove `http:` from img-src. Conditionally add unsafe-eval only in dev. CSP violation reporting. | Medium |
| SR-006 | Reduce body size limit | Reduce global `serverActions.bodySizeLimit` to 4MB. Dedicated upload routes for video with streaming + Content-Length validation. | Medium |
| SR-007 | Update vulnerable deps | Update file-type >=21.3.1, replace next-pwa with @serwist/next, run `npm audit fix`. CI step for `npm audit --audit-level=high`. | Small |
| SR-008 | Enforce mobile API auth | All mobile routes check `profile.role`. Customer role denied. Project listing filtered by permissions. Upload routes verify project access. | Medium |

### Medium Priority

| ID | Title | Description | Effort |
|----|-------|-------------|--------|
| SR-009 | Restrict AI proxy | Remove `system_prompt_override` or restrict to admin. Cap message length (10k chars) and count (50). Zod schema. Log usage for cost attribution. | Small |
| SR-010 | Structured logging | Adopt pino with log levels. Suppress debug in production. Redact PII. ESLint `no-console` rule. | Large |
| SR-011 | Add CSRF protection | State-mutating API routes validate CSRF token or use SameSite=Strict cookies. Or migrate to server actions. Or require custom header. | Medium |
| SR-012 | Validate search input | Escape `.`, `,`, `%` in `searchParams.search` before `.or()` interpolation. | Small |
| SR-013 | Secure PWA caching | Exclude sensitive routes from cache. Clear cache on logout. Reduce TTL from 24h to 5min. `Cache-Control: no-store` on sensitive responses. | Small |

### Low Priority

| ID | Title | Description | Effort |
|----|-------|-------------|--------|
| SR-014 | Audit logging | Audit table with actor_id, action, target_type, target_id, metadata, created_at. Cover admin CRUD, password reset, calendar ops, portal uploads. Immutable via RLS. | Large |
| SR-015 | Mobile file validation | Reuse `file-security.ts` in mobile upload routes. Validate type, sanitize filename, strip EXIF, check size. | Small |
| SR-016 | Scope service worker cache | Anchor API cache regex to application origin. Exclude `/api/admin/`, `/api/auth/`. | Small |

---

## Implementation Plan

### Phase 1: Quick Wins (Day 1 — 30 minutes)

These fixes are trivial and eliminate the most critical exposures:

1. **Delete debug endpoint** — Remove `src/app/api/auth/microsoft/debug/route.ts` (SR-001)
2. **Remove system_prompt_override** — Edit `src/app/api/ai/scope/route.ts` to ignore client-supplied system prompt override (SR-009 partial)
3. **Reduce body size limit** — Change `serverActions.bodySizeLimit` from `'100MB'` to `'4MB'` in `next.config.ts` (SR-006 partial)

### Phase 2: Mobile API Hardening (Day 2 — 4 hours)

The mobile API is the largest attack surface with the least protection:

4. **Add role checks to all `/api/mobile/*` routes** — Check `profile.role`, reject customer users (SR-008)
5. **Port file-security.ts to mobile uploads** — Add `validateFileType()`, `validateFileSize()`, `sanitizeFilename()`, `stripExifData()` to both mobile upload routes (SR-015, T1)
6. **Replace service client with user client** in `/api/mobile/projects` — Respect RLS instead of bypassing it (I2)

### Phase 3: Error Sanitization & Input Validation (Day 3 — 4 hours)

7. **Sanitize error messages** across all API routes — Replace `error.message` with generic messages (SR-003)
8. **Escape search params** in `.or()` filter — Fix PostgREST filter injection in `projects/page.tsx` (SR-012, T3)
9. **Update vulnerable dependencies** — `npm audit fix`, replace next-pwa, update file-type (SR-007)

### Phase 4: Rate Limiting & CSP (Week 2)

10. **Implement rate limiting** with Upstash Redis or similar (SR-004)
11. **Add portal token expiration** — DB migration, validation logic, admin UI (SR-002)
12. **Strengthen CSP** — Remove unsafe-eval, nonce-based CSP via middleware (SR-005)
13. **Add CSRF protection** to POST API routes (SR-011)

### Phase 5: Observability & Audit (Week 3)

14. **Add audit logging** for admin operations (SR-014)
15. **Implement structured logging** with pino (SR-010)
16. **Secure PWA caching** — Exclude sensitive routes, reduce TTL (SR-013)
17. **Fix remaining medium findings** — SOW config error path (I4), portal SELECT * (I3), ActiveCampaign fan-out (D3)
