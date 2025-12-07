import { test, expect } from './fixtures';
import { TestHelpers } from './fixtures';

/**
 * Example E2E Tests
 *
 * This file demonstrates various Playwright testing patterns and best practices
 */

test.describe('Example Tests', () => {
  test('basic navigation test', async ({ page }) => {
    // Navigate to home page
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check page title
    await expect(page).toHaveTitle(/amidash/i);

    // TODO: Add more assertions based on your home page
  });

  test('using test helpers', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Use helper method to navigate
    await helpers.goto('/');

    // TODO: Add assertions
  });

  test.skip('example of a skipped test', async () => {
    // This test will be skipped
    // Remove .skip when you're ready to enable it
  });

  test('example of checking element visibility', async ({ page }) => {
    await page.goto('/');

    // Check if an element is visible using role
    // TODO: Update selector to match your app
    // await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Check if an element is visible using test id
    // await expect(page.getByTestId('hero-section')).toBeVisible();

    // Check if an element is visible using text
    // await expect(page.getByText('Welcome')).toBeVisible();
  });

  test('example of form interaction', async ({ page }) => {
    await page.goto('/');

    // Fill form fields
    // await page.getByLabel('Name').fill('Test User');
    // await page.getByLabel('Email').fill('test@example.com');

    // Select from dropdown
    // await page.getByRole('combobox', { name: 'Country' }).selectOption('US');

    // Check checkbox
    // await page.getByRole('checkbox', { name: 'Subscribe' }).check();

    // Click button
    // await page.getByRole('button', { name: 'Submit' }).click();

    // TODO: Add assertions
  });

  test('example of waiting for elements', async ({ page }) => {
    await page.goto('/');

    // Wait for specific element to appear
    // await page.waitForSelector('[data-testid="content"]', { state: 'visible' });

    // Wait for network to be idle
    // await page.waitForLoadState('networkidle');

    // Wait for specific URL
    // await page.waitForURL('**/dashboard');

    // TODO: Add assertions
  });

  test('example of handling dialogs', async ({ page }) => {
    // Listen for dialog and auto-accept
    page.on('dialog', dialog => dialog.accept());

    await page.goto('/');

    // Trigger action that shows dialog
    // await page.getByRole('button', { name: 'Delete' }).click();

    // TODO: Add assertions
  });

  test('example of API mocking', async ({ page }) => {
    // Mock API response
    await page.route('**/api/users', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          users: [
            { id: 1, name: 'Test User 1' },
            { id: 2, name: 'Test User 2' },
          ],
        }),
      });
    });

    await page.goto('/');

    // TODO: Add assertions
  });

  test('example of screenshot on failure', async ({ page }) => {
    await page.goto('/');

    // This will automatically take a screenshot on failure
    // due to the configuration in playwright.config.ts

    // TODO: Add assertions that might fail
  });

  test('example of responsive testing', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');

    // Check mobile-specific elements
    // await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();

    // Set viewport to desktop size
    await page.setViewportSize({ width: 1280, height: 720 });

    // Check desktop-specific elements
    // await expect(page.getByRole('navigation')).toBeVisible();

    // TODO: Add assertions
  });

  test('example of local storage', async ({ page }) => {
    await page.goto('/');

    // Set local storage
    await page.evaluate(() => {
      localStorage.setItem('theme', 'dark');
    });

    // Get local storage
    const theme = await page.evaluate(() => {
      return localStorage.getItem('theme');
    });

    expect(theme).toBe('dark');
  });

  test('example of network request inspection', async ({ page }) => {
    // Listen to all requests
    page.on('request', request => {
      console.log('Request:', request.url());
    });

    // Listen to all responses
    page.on('response', response => {
      console.log('Response:', response.url(), response.status());
    });

    await page.goto('/');

    // TODO: Add assertions
  });
});

/**
 * Test hooks example
 */
test.describe('Test Hooks Example', () => {
  // Runs once before all tests in this describe block
  test.beforeAll(async () => {
    console.log('Setting up test suite...');
    // Add setup logic here (e.g., database seeding)
  });

  // Runs once after all tests in this describe block
  test.afterAll(async () => {
    console.log('Cleaning up test suite...');
    // Add cleanup logic here (e.g., database cleanup)
  });

  // Runs before each test
  test.beforeEach(async () => {
    console.log('Setting up test...');
    // Add per-test setup logic here
  });

  // Runs after each test
  test.afterEach(async () => {
    console.log('Cleaning up test...');
    // Add per-test cleanup logic here
  });

  test.skip('example test with hooks', async () => {
    // This test will use the hooks defined above
  });
});
