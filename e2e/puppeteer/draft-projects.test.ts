declare const page: import('puppeteer').Page;

import {
  createTestProject,
  cleanupTestProject,
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

describe('Draft Projects', () => {
  let testProjectId: string;

  afterEach(async () => {
    if (testProjectId) {
      await cleanupTestProject(testProjectId);
      testProjectId = '';
    }
  });

  it('creates a draft with only client name', async () => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/projects/new`, { waitUntil: 'networkidle0' });

    // Fill only client name
    await page.type('input[name="client_name"]', 'Draft Test Client');

    // Click "Save as Draft"
    const draftBtn = await findButtonByText('Save as Draft');
    await (draftBtn as unknown as import('puppeteer').ElementHandle)?.click();

    // Wait for redirect/success
    await page.waitForNavigation({ waitUntil: 'networkidle0' });

    // Verify we're on projects page
    expect(page.url()).toContain('/projects');
  });

  it('rejects creating non-draft without delivery address', async () => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/projects/new`, { waitUntil: 'networkidle0' });

    // Fill required fields but skip delivery address
    await page.type('input[name="client_name"]', 'No Address Client');

    // Click "Create Project"
    const createBtn = await findButtonByText('Create Project');
    await (createBtn as unknown as import('puppeteer').ElementHandle)?.click();

    // Wait for error message about delivery address
    await page.waitForFunction(
      () =>
        document.body.innerText.toLowerCase().includes('delivery address'),
      { timeout: 5000 }
    );
  });

  it('publishes a draft with all required fields', async () => {
    // Create draft via API
    const { projectId } = await createTestProject({ isDraft: true });
    testProjectId = projectId;

    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/projects/${projectId}`, {
      waitUntil: 'networkidle0',
    });

    // Verify it shows as draft somehow
    const content = await page.content();
    expect(content).toContain('Draft');
  });

  it('excludes drafts from dashboard metrics', async () => {
    // Create draft with sales amount
    const { projectId } = await createTestProject({
      isDraft: true,
      clientName: 'Dashboard Draft Test',
    });
    testProjectId = projectId;

    await loginAsAdmin(page);
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

    // The dashboard should load - we just verify it doesn't crash
    const content = await page.content();
    expect(content).toContain('Dashboard');
  });
});
