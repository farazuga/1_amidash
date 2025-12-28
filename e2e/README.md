# E2E Testing with Playwright

This directory contains end-to-end tests for the application using Playwright.

## Getting Started

### Prerequisites

- Node.js installed
- Dependencies installed (`npm install`)
- Playwright browsers installed (`npx playwright install chromium`)

### Running Tests

```bash
# Run all E2E tests in headless mode
npm run test:e2e

# Run tests with UI mode (interactive)
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Run tests in debug mode
npm run test:e2e:debug

# Run specific test file
npx playwright test e2e/auth.spec.ts

# Run tests matching a pattern
npx playwright test -g "login"

# Run tests on specific browser
npx playwright test --project=chromium
```

## Project Structure

```
e2e/
├── README.md           # This file
├── fixtures.ts         # Test fixtures and helper classes
├── auth.spec.ts        # Authentication tests
└── example.spec.ts     # Example tests and patterns
```

## Test Files

### `fixtures.ts`

Contains reusable test utilities and helper classes:

- **TestHelpers**: General purpose test helpers for navigation, form filling, etc.
- **AuthHelpers**: Authentication-specific helpers (login, logout, etc.)
- **DatabaseHelpers**: Database setup and cleanup utilities
- **APIHelpers**: API testing utilities

### `auth.spec.ts`

Tests for authentication flows:

- Login functionality
- Logout functionality
- Protected routes
- Registration (scaffolded)
- Password reset (scaffolded)

Most tests are currently scaffolded with `test.skip()` and need to be implemented based on your specific authentication implementation.

### `example.spec.ts`

Demonstrates various Playwright testing patterns:

- Basic navigation
- Form interaction
- Element visibility checks
- API mocking
- Responsive testing
- Local storage interaction
- Network request inspection

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from './fixtures';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    // Arrange
    await page.goto('/some-page');

    // Act
    await page.getByRole('button', { name: 'Submit' }).click();

    // Assert
    await expect(page).toHaveURL('/success');
  });
});
```

### Using Test Helpers

```typescript
import { test, expect } from './fixtures';
import { TestHelpers } from './fixtures';

test('using helpers', async ({ page }) => {
  const helpers = new TestHelpers(page);

  await helpers.goto('/login');
  await helpers.fillByLabel('Email', 'test@example.com');
  await helpers.clickButton('Sign In');

  // Add assertions
});
```

### Common Patterns

#### Selecting Elements

```typescript
// By role
await page.getByRole('button', { name: 'Submit' })

// By label
await page.getByLabel('Email')

// By text
await page.getByText('Welcome')

// By test ID
await page.getByTestId('user-menu')

// By CSS selector (use sparingly)
await page.locator('.some-class')
```

#### Assertions

```typescript
// Element visibility
await expect(page.getByText('Success')).toBeVisible()

// URL
await expect(page).toHaveURL(/dashboard/)

// Text content
await expect(page.getByRole('heading')).toHaveText('Dashboard')

// Count
await expect(page.getByRole('listitem')).toHaveCount(5)
```

#### Waiting

```typescript
// Wait for selector
await page.waitForSelector('[data-testid="content"]')

// Wait for network idle
await page.waitForLoadState('networkidle')

// Wait for URL
await page.waitForURL('**/dashboard')

// Wait for timeout (avoid if possible)
await page.waitForTimeout(1000)
```

## Configuration

See `playwright.config.ts` in the project root for configuration options:

- Base URL: `http://localhost:3000`
- Browser: Chromium (desktop)
- Screenshots: On failure
- Videos: On failure
- Retries: 2 on CI, 0 locally

## Best Practices

1. **Use semantic selectors**: Prefer `getByRole`, `getByLabel`, and `getByText` over CSS selectors
2. **Add test IDs**: Use `data-testid` for elements that are hard to select semantically
3. **Keep tests independent**: Each test should be able to run in isolation
4. **Use fixtures**: Create reusable fixtures for common setup
5. **Avoid hard-coded waits**: Use Playwright's auto-waiting instead of `waitForTimeout`
6. **Clean up**: Use `afterEach` hooks to clean up test data
7. **Mock when appropriate**: Mock external APIs to make tests faster and more reliable
8. **Test user flows**: Focus on testing complete user journeys, not just individual actions

## Debugging

### Debug Mode

```bash
npm run test:e2e:debug
```

This opens the Playwright Inspector where you can:
- Step through tests
- Inspect the DOM
- See console logs
- View network requests

### UI Mode

```bash
npm run test:e2e:ui
```

This opens the Playwright UI where you can:
- Run tests interactively
- See test results in real-time
- Inspect screenshots and videos
- Time-travel through test execution

### VS Code Extension

Install the [Playwright Test for VS Code](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright) extension for:
- Running tests from the editor
- Setting breakpoints
- Debugging with VS Code debugger

## Continuous Integration

Tests are configured to run on CI with:
- Single worker (no parallelization)
- 2 retries on failure
- Screenshots and videos on failure

See `.github/workflows` for CI configuration (to be added).

## TODO

The following items need to be implemented based on your specific application:

1. **Authentication Tests**
   - Update test credentials
   - Implement actual login flow
   - Add registration tests
   - Add password reset tests

2. **Test Data**
   - Set up test database
   - Create test users
   - Implement database helpers

3. **API Integration**
   - Implement API helpers
   - Add API response mocking
   - Test API error scenarios

4. **Additional Test Coverage**
   - Dashboard tests
   - Project management tests
   - Settings tests
   - User profile tests

5. **CI/CD Integration**
   - Add GitHub Actions workflow
   - Configure test environments
   - Set up test reporting

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-playwright)
