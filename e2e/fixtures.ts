import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Test Fixtures
 *
 * Extend base test with custom fixtures and helpers for E2E testing
 */

// Extend base test with custom fixtures
export const test = base.extend({
  // Add custom fixtures here as needed
});

// Re-export expect
export { expect };

/**
 * Test Helpers
 */

export class TestHelpers {
  constructor(public readonly page: Page) {}

  /**
   * Navigate to a page and wait for it to load
   */
  async goto(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for an element to be visible
   */
  async waitForElement(selector: string, timeout = 10000) {
    await this.page.waitForSelector(selector, { state: 'visible', timeout });
  }

  /**
   * Fill form field by label
   */
  async fillByLabel(label: string, value: string) {
    await this.page.getByLabel(label).fill(value);
  }

  /**
   * Click button by text
   */
  async clickButton(text: string) {
    await this.page.getByRole('button', { name: text }).click();
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation() {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Take a screenshot with a descriptive name
   */
  async screenshot(name: string) {
    await this.page.screenshot({ path: `test-results/screenshots/${name}.png` });
  }

  /**
   * Check if element exists
   */
  async elementExists(selector: string): Promise<boolean> {
    return (await this.page.$(selector)) !== null;
  }

  /**
   * Get element text content
   */
  async getTextContent(selector: string): Promise<string | null> {
    return await this.page.textContent(selector);
  }

  /**
   * Wait for URL to contain specific path
   */
  async waitForURL(urlPattern: string | RegExp, timeout = 10000) {
    await this.page.waitForURL(urlPattern, { timeout });
  }
}

/**
 * Authentication Helpers
 */

export class AuthHelpers extends TestHelpers {
  /**
   * Login with credentials
   * TODO: Implement based on your authentication flow
   */
  async login(email: string, password: string) {
    // Navigate to login page
    await this.goto('/login');

    // Fill in credentials
    await this.fillByLabel('Email', email);
    await this.fillByLabel('Password', password);

    // Submit form
    await this.clickButton('Sign In');

    // Wait for navigation
    await this.waitForNavigation();
  }

  /**
   * Logout
   * TODO: Implement based on your logout flow
   */
  async logout() {
    // Click logout button/link
    await this.clickButton('Logout');
    await this.waitForNavigation();
  }

  /**
   * Check if user is authenticated
   * TODO: Implement based on your app's authenticated state
   */
  async isAuthenticated(): Promise<boolean> {
    // Check for authenticated user indicator
    return await this.elementExists('[data-testid="user-menu"]');
  }
}

/**
 * Database Helpers
 */

export class DatabaseHelpers {
  /**
   * Clean up test data
   * TODO: Implement based on your database setup
   */
  async cleanup() {
    // Add cleanup logic here
    console.log('Database cleanup - implement based on your needs');
  }

  /**
   * Seed test data
   * TODO: Implement based on your database setup
   */
  async seed() {
    // Add seed logic here
    console.log('Database seed - implement based on your needs');
  }
}

/**
 * API Helpers
 */

export class APIHelpers {
  constructor(private baseURL: string) {}

  /**
   * Make authenticated API request
   * TODO: Implement based on your API structure
   */
  async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    return response;
  }

  /**
   * Create test user via API
   * TODO: Implement based on your API structure
   */
  async createTestUser(userData: any) {
    // Implement user creation logic
    console.log('Create test user - implement based on your API');
  }

  /**
   * Delete test user via API
   * TODO: Implement based on your API structure
   */
  async deleteTestUser(userId: string) {
    // Implement user deletion logic
    console.log('Delete test user - implement based on your API');
  }
}
