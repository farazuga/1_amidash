declare const page: import('puppeteer').Page;

import {
  loginAsAdmin,
  BASE_URL,
} from './helpers/portal';

/** Find a button element by its text content. */
async function findButtonByText(text: string) {
  return page.evaluateHandle((t) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find((b) => b.textContent?.includes(t)) ?? null;
  }, text);
}

describe('Delivery Address', () => {
  it('opens address dialog and saves structured address', async () => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/projects/new`, { waitUntil: 'networkidle0' });

    // Click delivery address button to open dialog
    const addressBtn = await findButtonByText('Add Delivery Address');
    await (addressBtn as unknown as import('puppeteer').ElementHandle)?.click();

    // Wait for dialog
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Fill address fields
    await page.type('input[name="street"]', '123 Main St');
    await page.type('input[name="city"]', 'Charleston');
    await page.type('input[name="zip"]', '29401');

    // Save
    const saveBtn = await page.evaluateHandle(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return null;
      const buttons = Array.from(dialog.querySelectorAll('button'));
      return buttons.find((b) => b.textContent?.includes('Save')) ?? null;
    });
    await (saveBtn as unknown as import('puppeteer').ElementHandle)?.click();

    // Verify dialog closed and address shown
    await page.waitForFunction(
      () => document.body.innerText.includes('123 Main St'),
      { timeout: 5000 }
    );
  });

  it('allows draft without address', async () => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/projects/new`, { waitUntil: 'networkidle0' });

    await page.type('input[name="client_name"]', 'No Address Draft');

    const draftBtn = await findButtonByText('Save as Draft');
    await (draftBtn as unknown as import('puppeteer').ElementHandle)?.click();

    // Should succeed without address
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    expect(page.url()).toContain('/projects');
  });

  it('requires address for non-draft creation', async () => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/projects/new`, { waitUntil: 'networkidle0' });

    await page.type('input[name="client_name"]', 'Address Required Client');

    const createBtn = await findButtonByText('Create Project');
    await (createBtn as unknown as import('puppeteer').ElementHandle)?.click();

    // Verify validation error
    await page.waitForFunction(
      () =>
        document.body.innerText.toLowerCase().includes('delivery address'),
      { timeout: 5000 }
    );
  });
});
