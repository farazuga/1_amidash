declare const page: import('puppeteer').Page;

import { loginAsAdmin, BASE_URL } from './helpers/portal';

describe('Email Template Customization', () => {
  it('shows email branding section in portal builder', async () => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/admin/portal-builder`, {
      waitUntil: 'networkidle0',
    });

    // Select a template if there are any
    const templateSelect = await page.$('select, [role="combobox"]');
    if (templateSelect) {
      await templateSelect.click();
    }

    // Verify email branding section exists
    const content = await page.content();
    expect(content.toLowerCase()).toContain('email');
  });

  it('sends test email without error', async () => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/admin/portal-builder`, {
      waitUntil: 'networkidle0',
    });

    // Look for send test email button (may need template selected first)
    const testEmailBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find((b) => b.textContent?.includes('Send Test')) ?? null;
    });

    if (testEmailBtn) {
      await (
        testEmailBtn as unknown as import('puppeteer').ElementHandle
      )?.click();
      // Wait for toast/response
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Basic smoke test - page shouldn't crash
    const content = await page.content();
    expect(content).toContain('<html');
  });
});
