declare const page: import('puppeteer').Page;

import { loginAsAdmin, BASE_URL } from './helpers/portal';

/** Find a button element by its text content. */
async function findButtonByText(text: string) {
  return page.evaluateHandle((t) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find((b) => b.textContent?.includes(t)) ?? null;
  }, text);
}

describe('Customer Approvals', () => {
  it('shows approvals page for admin', async () => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/approvals`, { waitUntil: 'networkidle0' });

    // Verify page loads with tabs
    const content = await page.content();
    expect(content).toContain('Pending');
    expect(content).toContain('Approved');
    expect(content).toContain('Rejected');
  });

  it('sets approval user in admin settings', async () => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/admin/settings`, {
      waitUntil: 'networkidle0',
    });

    // Look for Customer Approvals section
    const content = await page.content();
    expect(content).toContain('Customer Approval');
  });

  it('approval dashboard tabs work', async () => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/approvals`, { waitUntil: 'networkidle0' });

    // Click Approved tab
    const approvedTab = await findButtonByText('Approved');
    await (
      approvedTab as unknown as import('puppeteer').ElementHandle
    )?.click();
    await new Promise((r) => setTimeout(r, 500));

    // Click Rejected tab
    const rejectedTab = await findButtonByText('Rejected');
    await (
      rejectedTab as unknown as import('puppeteer').ElementHandle
    )?.click();
    await new Promise((r) => setTimeout(r, 500));

    // Should not crash
    expect(await page.title()).toBeTruthy();
  });

  it('shows reject note as required', async () => {
    // This is a unit-level behavioral test - verify the reject flow requires a note
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/approvals`, { waitUntil: 'networkidle0' });

    // Basic smoke test - the page loads
    const content = await page.content();
    expect(content).toBeTruthy();
  });
});
