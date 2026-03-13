# Recommendations

Actionable improvements for testing, security, and performance. Excludes feature additions.

## Testing Improvements

### P0 - Critical

#### Add CI/CD Pipeline
No GitHub Actions workflow exists. Tests don't run on PRs.
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test
      - run: npm run build
```
**Impact**: Prevents broken code from merging. Zero-effort quality gate.

#### Enforce Coverage in CI
Coverage target is 85% but not enforced. Add to CI pipeline:
```bash
npm run test:coverage -- --reporter=json
# Parse and fail if below threshold
```

### P1 - High

#### Consolidate E2E Frameworks
Currently using both Playwright AND Jest+Puppeteer for E2E tests. Consolidate to Playwright only:
- Playwright has better developer experience (UI mode, trace viewer, auto-waiting)
- Migrate 6 Puppeteer tests to Playwright spec files
- Remove jest, jest-puppeteer, puppeteer devDependencies

#### Implement Skipped Tests
2 tests in `src/app/(dashboard)/calendar/__tests__/actions.test.ts` are skipped:
- `bulkUpdateAssignmentStatus: skips assignments already at target status`
- `bulkUpdateAssignmentStatus: returns count of updated assignments`
These test important business logic. Implement proper mocks or use a test database.

#### Add API Integration Tests
All API route tests mock Supabase. Add integration tests that hit a real test database:
- Use Supabase local dev (`supabase start`)
- Seed test data with migrations
- Test actual query chains, RLS policies, and edge cases

### P2 - Medium

#### Add Component Test Coverage
Large components with minimal test coverage:
- `project-form.tsx` (40KB) - No tests
- `projects-table.tsx` (36KB) - No tests
- `issues-tab.tsx` (29KB) - No tests
- `scorecard-tab.tsx` (27KB) - No tests
- `quick-info.tsx` (28KB) - No tests

Add tests for critical user interactions and edge cases in these components.

#### Add E2E Tests for L10 Meetings
No E2E tests cover the L10 meeting system. Priority scenarios:
- Meeting creation and segment navigation
- Issue IDS workflow (identify → discuss → solve)
- Scorecard entry and goal tracking
- Realtime multi-user updates

#### Visual Regression Testing
Consider Playwright visual comparison for portal pages (customer-facing):
```typescript
await expect(page).toHaveScreenshot('portal-status.png');
```

---

## Security Improvements

### P0 - Critical

#### Add Rate Limiting to Login
No rate limiting on `/login` or Supabase auth endpoints. Brute force is possible.
- Option A: Supabase built-in rate limiting (configure in dashboard)
- Option B: Add middleware rate limiter using `@upstash/ratelimit` or in-memory

#### Move Rate Limiting to Persistent Storage
Portal upload rate limiting uses in-memory Map. Resets on every deploy (Railway).
- Migrate to Supabase table or Redis
- Ensures rate limits survive deploys and work across instances

### P1 - High

#### Migrate CSP to Nonce-Based
Current CSP uses `'unsafe-inline'` and `'unsafe-eval'` for scripts:
```
script-src 'self' 'unsafe-inline' 'unsafe-eval'
```
This weakens XSS protection significantly. Next.js supports nonce-based CSP:
- Generate nonce per request in middleware
- Pass to `<Script nonce={nonce}>` components
- Update CSP: `script-src 'self' 'nonce-{value}'`

#### Add CSRF Tokens to Email Routes
Email routes only validate `origin` header. This is vulnerable to:
- Browsers that don't send origin on same-site requests
- Origin header spoofing in some edge cases

Add double-submit CSRF token pattern:
```typescript
// Generate token, store in httpOnly cookie
// Require token in request header or body
```

### P2 - Medium

#### Add Security Headers for Service Workers
PWA service worker is registered but CSP doesn't address worker scope:
```
worker-src 'self';
```

#### Implement Content-Type Validation on Uploads
Portal uploads strip EXIF but should also validate:
- Magic bytes match declared content type
- Reject polyglot files (files valid as multiple types)
- Maximum dimension limits for images

#### Add API Key Rotation Mechanism
All integration API keys (Odoo, Resend, ActiveCampaign, Anthropic) have no rotation mechanism. Consider:
- Document rotation procedure
- Add key version support
- Monitor key usage/age

---

## Performance Improvements

### P0 - Critical

#### Lazy Load Heavy Components
Several large components load synchronously:
```typescript
// Before (synchronous, adds to initial bundle)
import { ProjectForm } from '@/components/projects/project-form';

// After (code-split, loads on demand)
import dynamic from 'next/dynamic';
const ProjectForm = dynamic(() => import('@/components/projects/project-form'), {
  loading: () => <FormSkeleton />,
});
```

Priority targets:
- `project-form.tsx` (40KB)
- `projects-table.tsx` (36KB)
- `issues-tab.tsx` (29KB)
- `scorecard-tab.tsx` (27KB)
- `recharts` components (large library)

### P1 - High

#### Optimize Bundle Size
`recharts` is a large dependency (~300KB). Options:
- Tree-shake: Import specific chart types only
- Consider lighter alternative: `@nivo/bar`, `@nivo/pie`
- Lazy load chart components (already partially done with `lazy-charts.tsx`)

#### Add Database Query Caching
No caching layer between app and Supabase. Frequently read data:
- Project statuses (rarely change)
- Project types (static)
- User profiles (change infrequently)

Options:
- TanStack Query already provides client-side cache (60s stale time)
- Add server-side cache with `unstable_cache` from Next.js
- For production: Consider Redis for cross-request caching

#### Optimize Calendar Rendering
Calendar with many assignments can be slow. Consider:
- Virtualize user rows for large teams (react-virtual)
- Memoize date calculations (useMemo on getCalendarDays)
- Debounce drag-drop position updates

### P2 - Medium

#### Add Image CDN/Optimization
`sharp` is used for image processing but there's no CDN pipeline:
- Use Next.js `<Image>` component with optimization
- Configure Supabase storage transform for thumbnails
- Add WebP/AVIF format support

#### Implement Incremental Static Regeneration
All pages are server-rendered. Static candidates:
- `/login` page
- Portal pages (`/status/[token]`) - revalidate on status change
- Public confirmation pages

#### Optimize L10 Realtime Subscriptions
All 6 L10 tables have realtime subscriptions. When user isn't on L10 page:
- Unsubscribe when navigating away (cleanup in useEffect)
- Use channel-based subscriptions with topic filters
- Only subscribe to active meeting's data

#### Database Query Optimization
- Add composite indexes for frequent query patterns (e.g., `projects.status_id + is_draft`)
- Review Supabase query plans for slow queries
- Consider database views for complex dashboard aggregations

---

## Priority Summary

| Priority | Area | Item | Effort |
|----------|------|------|--------|
| P0 | Testing | CI/CD pipeline | Low |
| P0 | Testing | Enforce coverage in CI | Low |
| P0 | Security | Login rate limiting | Low |
| P0 | Security | Persistent rate limiting | Medium |
| P0 | Performance | Lazy load heavy components | Low |
| P1 | Testing | Consolidate to Playwright | Medium |
| P1 | Testing | Implement skipped tests | Low |
| P1 | Testing | API integration tests | High |
| P1 | Security | Nonce-based CSP | Medium |
| P1 | Security | CSRF tokens for email | Medium |
| P1 | Performance | Bundle size optimization | Medium |
| P1 | Performance | Database query caching | Medium |
| P1 | Performance | Calendar rendering | Medium |
| P2 | Testing | Component test coverage | High |
| P2 | Testing | L10 E2E tests | High |
| P2 | Security | Service worker CSP | Low |
| P2 | Security | Upload content validation | Medium |
| P2 | Performance | Image CDN | Medium |
| P2 | Performance | ISR for static pages | Medium |
| P2 | Performance | Realtime subscription cleanup | Low |
