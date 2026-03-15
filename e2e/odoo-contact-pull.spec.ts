import { test, expect } from '@playwright/test';
import { AuthHelpers } from './fixtures';

/**
 * Odoo Contact Pull E2E Tests
 *
 * Tests the Odoo integration for:
 * 1. Client name autocomplete (searches Odoo partners)
 * 2. Delivery address auto-population from sales order pull
 * 3. POC auto-fill from partner selection
 *
 * These tests mock the Odoo API responses to run without real Odoo credentials.
 */

const MOCK_PARTNERS = [
  {
    id: 101,
    name: 'Acme Corporation',
    email: 'info@acme.com',
    phone: '+1 (555) 123-4567',
    isCompany: true,
    address: {
      street: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      country: 'US',
    },
  },
  {
    id: 102,
    name: 'John Smith',
    email: 'john@acme.com',
    phone: '+1 (555) 987-6543',
    isCompany: false,
    address: {
      street: '456 Oak Ave',
      city: 'Dallas',
      state: 'TX',
      zip: '75201',
      country: 'US',
    },
  },
];

const MOCK_ODOO_PULL_RESULT = {
  salesOrder: {
    odooOrderId: 12345,
    salesOrderUrl: 'https://odoo.example.com/web#id=12345&model=sale.order',
    salesAmount: 25000,
    poNumber: 'PO-2026-001',
    invoiceStatus: 'to invoice',
  },
  client: {
    name: 'Acme Corporation',
    pocName: 'Jane Doe',
    pocEmail: 'jane@acme.com',
    pocPhone: '(555) 111-2222',
  },
  salesperson: {
    odooName: 'Sales Rep',
    matchedProfileId: null,
  },
  lineItems: [
    {
      productName: '[ami_INSTALL] Installation Service',
      quantity: 1,
      description: 'Standard installation',
      subtotal: 15000,
    },
    {
      productName: '[ami_VIDPOD] VidPod Unit',
      quantity: 2,
      description: 'VidPod hardware',
      subtotal: 10000,
    },
  ],
  deliveryAddress: {
    street: '789 Shipping Blvd, Suite 100',
    city: 'Houston',
    state: 'TX',
    zip: '77001',
    country: 'US',
  },
};

test.describe('Odoo Contact Pull', () => {
  test.beforeEach(async ({ page }) => {
    const auth = new AuthHelpers(page);
    await auth.login('admin@example.com', 'password123');
  });

  test.describe('Client Name Autocomplete', () => {
    test('should search Odoo partners as user types', async ({ page }) => {
      // Mock the partner search API
      await page.route('**/api/odoo/partners*', async (route) => {
        const url = new URL(route.request().url());
        const query = url.searchParams.get('q');
        if (query && query.length >= 2) {
          const filtered = MOCK_PARTNERS.filter((p) =>
            p.name.toLowerCase().includes(query.toLowerCase())
          );
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ partners: filtered }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ partners: [] }),
          });
        }
      });

      await page.goto('/projects/new');
      await page.waitForLoadState('networkidle');

      // Type in client name field
      const clientNameInput = page.getByLabel('Client Name *');
      await clientNameInput.fill('Acme');

      // Wait for autocomplete dropdown
      await expect(page.getByText('Odoo Contacts')).toBeVisible({ timeout: 5000 });

      // Should show company result with building icon
      await expect(page.getByText('Acme Corporation')).toBeVisible();
      await expect(page.getByText('info@acme.com')).toBeVisible();
    });

    test('should show both companies and contacts in search results', async ({ page }) => {
      await page.route('**/api/odoo/partners*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ partners: MOCK_PARTNERS }),
        });
      });

      await page.goto('/projects/new');
      await page.waitForLoadState('networkidle');

      const clientNameInput = page.getByLabel('Client Name *');
      await clientNameInput.fill('test');

      await expect(page.getByText('Odoo Contacts')).toBeVisible({ timeout: 5000 });

      // Both company and contact should appear
      await expect(page.getByText('Acme Corporation')).toBeVisible();
      await expect(page.getByText('John Smith')).toBeVisible();
    });

    test('should auto-fill delivery address when selecting a partner', async ({ page }) => {
      await page.route('**/api/odoo/partners*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ partners: MOCK_PARTNERS }),
        });
      });

      await page.goto('/projects/new');
      await page.waitForLoadState('networkidle');

      const clientNameInput = page.getByLabel('Client Name *');
      await clientNameInput.fill('Acme');

      await expect(page.getByText('Odoo Contacts')).toBeVisible({ timeout: 5000 });

      // Select the company
      await page.getByText('Acme Corporation').click();

      // Client name should be filled
      await expect(clientNameInput).toHaveValue('Acme Corporation');

      // Delivery address should be auto-populated
      await expect(page.getByText('123 Main St')).toBeVisible({ timeout: 3000 });
      await expect(page.getByText('Austin')).toBeVisible();
    });

    test('should auto-fill POC fields when selecting a contact (non-company)', async ({ page }) => {
      await page.route('**/api/odoo/partners*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ partners: MOCK_PARTNERS }),
        });
      });

      await page.goto('/projects/new');
      await page.waitForLoadState('networkidle');

      const clientNameInput = page.getByLabel('Client Name *');
      await clientNameInput.fill('John');

      await expect(page.getByText('Odoo Contacts')).toBeVisible({ timeout: 5000 });

      // Select the contact (non-company)
      await page.getByText('John Smith').click();

      // POC fields should be auto-filled
      const pocNameInput = page.locator('#poc_name');
      const pocEmailInput = page.locator('#poc_email');

      await expect(pocNameInput).toHaveValue('John Smith', { timeout: 3000 });
      await expect(pocEmailInput).toHaveValue('john@acme.com');
    });
  });

  test.describe('Odoo Pull - Delivery Address', () => {
    test('should auto-populate delivery address from sales order pull', async ({ page }) => {
      // Mock the Odoo pull API
      await page.route('**/api/odoo/pull', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_ODOO_PULL_RESULT),
        });
      });

      // Mock summarize (non-blocking)
      await page.route('**/api/odoo/summarize', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ summary: 'Test project description' }),
        });
      });

      await page.goto('/projects/new');
      await page.waitForLoadState('networkidle');

      // Enter sales order number
      const soInput = page.locator('#sales_order_number');
      await soInput.fill('S10001');

      // Click "Pull from Odoo" button
      const pullButton = page.getByRole('button', { name: /Pull from Odoo/i });
      await expect(pullButton).toBeEnabled();
      await pullButton.click();

      // Wait for pull to complete
      await expect(page.getByText('Pulled data from Odoo')).toBeVisible({ timeout: 10000 });

      // Verify client name was populated
      const clientNameInput = page.getByLabel('Client Name *');
      await expect(clientNameInput).toHaveValue('Acme Corporation');

      // Verify POC fields were populated
      const pocNameInput = page.locator('#poc_name');
      const pocEmailInput = page.locator('#poc_email');
      const pocPhoneInput = page.locator('#poc_phone');

      await expect(pocNameInput).toHaveValue('Jane Doe');
      await expect(pocEmailInput).toHaveValue('jane@acme.com');
      await expect(pocPhoneInput).toHaveValue('(555) 111-2222');

      // Verify delivery address was populated and displayed
      const deliverySection = page.locator('text=Delivery Address').locator('..');
      await expect(page.getByText('789 Shipping Blvd, Suite 100')).toBeVisible({ timeout: 3000 });
      await expect(page.getByText('Houston')).toBeVisible();
      await expect(page.getByText('TX')).toBeVisible();
      await expect(page.getByText('77001')).toBeVisible();

      // The button should say "Edit Address" (not "Add Address")
      await expect(page.getByRole('button', { name: /Edit Address/i })).toBeVisible();
    });

    test('should show delivery address in edit dialog after pull', async ({ page }) => {
      await page.route('**/api/odoo/pull', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_ODOO_PULL_RESULT),
        });
      });

      await page.route('**/api/odoo/summarize', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ summary: 'Test description' }),
        });
      });

      await page.goto('/projects/new');
      await page.waitForLoadState('networkidle');

      // Pull from Odoo
      const soInput = page.locator('#sales_order_number');
      await soInput.fill('S10001');
      await page.getByRole('button', { name: /Pull from Odoo/i }).click();
      await expect(page.getByText('Pulled data from Odoo')).toBeVisible({ timeout: 10000 });

      // Click "Edit Address" to open dialog
      await page.getByRole('button', { name: /Edit Address/i }).click();

      // Dialog should show pre-filled address
      const streetInput = page.getByLabel('Street Address');
      const cityInput = page.getByLabel('City');
      const stateInput = page.getByLabel('State');
      const zipInput = page.getByLabel('ZIP Code');

      await expect(streetInput).toHaveValue('789 Shipping Blvd, Suite 100');
      await expect(cityInput).toHaveValue('Houston');
      await expect(stateInput).toHaveValue('TX');
      await expect(zipInput).toHaveValue('77001');
    });

    test('should handle pull with no delivery address gracefully', async ({ page }) => {
      const resultWithoutAddress = {
        ...MOCK_ODOO_PULL_RESULT,
        deliveryAddress: null,
      };

      await page.route('**/api/odoo/pull', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(resultWithoutAddress),
        });
      });

      await page.route('**/api/odoo/summarize', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ summary: 'Test' }),
        });
      });

      await page.goto('/projects/new');
      await page.waitForLoadState('networkidle');

      const soInput = page.locator('#sales_order_number');
      await soInput.fill('S10001');
      await page.getByRole('button', { name: /Pull from Odoo/i }).click();
      await expect(page.getByText('Pulled data from Odoo')).toBeVisible({ timeout: 10000 });

      // Should show "Add Address" button (not "Edit Address")
      await expect(page.getByRole('button', { name: /Add Address/i })).toBeVisible();
    });
  });
});
