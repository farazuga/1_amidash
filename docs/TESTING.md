# Testing

## Overview

| Framework | Purpose | Files | Config |
|-----------|---------|-------|--------|
| Vitest | Unit & integration tests | 44 files, 879 tests | `vitest.config.ts` |
| Playwright | E2E browser tests | 6 spec files | `playwright.config.ts` |
| Jest + Puppeteer | E2E browser tests | 6 test files | `e2e/puppeteer/jest.config.ts` |
| k6 | Load testing | 4 scenarios | `load-tests/config.js` |

## Running Tests

### Unit & Integration
```bash
npm test                    # Run all tests once
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report (target: 85%)
```

### Specific test areas
```bash
# Calendar
npm test -- src/lib/calendar src/app/\(dashboard\)/calendar

# L10
npm test -- src/lib/l10 src/hooks/queries

# Odoo
npm test -- src/lib/odoo src/app/api/odoo

# Email
npm test -- src/lib/email src/app/api/email

# Components
npm test -- src/components
```

### E2E (Playwright)
```bash
npm run test:e2e            # Run all E2E tests
npm run test:e2e:ui         # Interactive UI mode
npm run test:e2e:headed     # Visible browser
npm run test:e2e:debug      # Debug mode with inspector
```

### E2E (Puppeteer)
```bash
npm run test:e2e:puppeteer  # Jest + Puppeteer tests
```

### Load Testing (k6)
```bash
cd load-tests
./run-tests.sh smoke local      # Quick validation
./run-tests.sh load staging     # Standard load test
./run-tests.sh stress staging   # Stress test
./run-tests.sh spike staging    # Spike test
```

## Test Architecture

### Directory Structure
```
src/test/
├── setup.ts       # Global test setup (mocks for matchMedia, ResizeObserver, etc.)
├── factories.ts   # Test data factories (createProject, createStatus, etc.)
├── utils.tsx      # Custom render with providers
└── mocks/
    ├── supabase.ts          # Chainable Supabase mock
    ├── activecampaign.ts    # AC client mock
    ├── media-devices.ts     # MediaRecorder/Camera mocks
    └── next-navigation.ts   # Next.js router mock
```

### Test Patterns

#### Server Action Tests
```typescript
// 1. Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// 2. Setup mock responses
vi.mocked(createClient).mockResolvedValue({
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
  from: vi.fn().mockImplementation((table) => { /* chain mocks */ }),
});

// 3. Call action and assert
const result = await myAction({ input: 'value' });
expect(result.success).toBe(true);
```

#### API Route Tests
```typescript
// Create mock request
function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/path', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// Call route handler
const response = await POST(makeRequest({ field: 'value' }));
const data = await response.json();
expect(response.status).toBe(200);
```

#### Component Tests
```typescript
import { render, screen } from '@/test/utils';

it('renders correctly', () => {
  render(<MyComponent prop="value" />);
  expect(screen.getByText('Expected text')).toBeInTheDocument();
});
```

#### TanStack Query Hook Tests
```typescript
// Use renderHook with QueryClient wrapper
const { result } = renderHook(() => useMyQuery(), { wrapper: createWrapper() });
await waitFor(() => expect(result.current.isSuccess).toBe(true));
```

### Factory Functions
Located in `src/test/factories.ts`:

| Factory | Creates | Key defaults |
|---------|---------|-------------|
| `createProfile()` | User profile | role: 'editor' |
| `createStatus()` | Project status | color: '#3b82f6' |
| `createProject()` | Full project | All 50+ fields with defaults |
| `createTag()` | Project tag | Random name |
| `createStatusHistory()` | Status change | Timestamps included |

### Mock Patterns

#### Supabase Auth Mock
```typescript
mockCreateClient.mockResolvedValue({
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'user-1' } },
    }),
  },
});
```

#### Email Settings Mock
Email routes require `checkEmailEnabled` to be mocked:
```typescript
vi.mock('@/lib/email/settings', () => ({
  checkEmailEnabled: vi.fn().mockResolvedValue({
    canSendEmail: true,
    globalEnabled: true,
    projectEnabled: true,
    recipientEnabled: true,
  }),
}));
```

## Coverage

### Current State
- 44 test files passing
- 879 tests, 2 skipped (pre-existing)
- Coverage target: 85% (lines, functions, branches, statements)

### Coverage Areas
| Area | Coverage | Notes |
|------|----------|-------|
| Server actions | High | Auth, dashboard, calendar, L10 |
| API routes | High | Email, Odoo, admin, customer |
| Calendar utils | High | 93 tests for date/time utilities |
| Components | Medium | StatusBadge, charts, skeletons |
| Hooks | Medium | Query hooks, utility hooks |
| Stores | Medium | Sidebar, undo |
| Libraries | High | Crypto, validation, image utils |

### Test Exclusions
- `signage-engine/**` - Separate app with own test suite
- `.claude/**` - Development tooling
- `e2e/**` - Excluded from Vitest (uses Playwright/Puppeteer)

## Vitest Configuration
```typescript
// vitest.config.ts
{
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./src/test/setup.ts'],
  exclude: ['node_modules', 'e2e/**', 'signage-engine/**', '.claude/**'],
  coverage: {
    provider: 'v8',
    thresholds: { lines: 85, functions: 85, branches: 85, statements: 85 },
  },
}
```

## Playwright Configuration
```typescript
// playwright.config.ts
{
  testDir: './e2e',
  timeout: 60000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
}
```
