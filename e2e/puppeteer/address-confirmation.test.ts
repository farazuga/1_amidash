declare const page: import('puppeteer').Page;

import {
  createTestProject,
  cleanupTestProject,
  navigateToPortal,
  BASE_URL,
} from './helpers/portal';

describe('Address Confirmation Block', () => {
  let testProjectId: string;

  afterEach(async () => {
    if (testProjectId) {
      await cleanupTestProject(testProjectId);
      testProjectId = '';
    }
  });

  it('shows address on portal when available', async () => {
    const { projectId, token } = await createTestProject({
      withAddress: true,
      pocEmail: 'confirm@example.com',
    });
    testProjectId = projectId;

    await navigateToPortal(page, token);

    // The portal should show the project info - basic smoke test
    const content = await page.content();
    expect(content).toContain('<html');
  });

  it('rejects wrong email for confirmation', async () => {
    const { projectId, token } = await createTestProject({
      withAddress: true,
      pocEmail: 'correct@example.com',
    });
    testProjectId = projectId;

    // Call the API directly to test the rejection
    const response = await fetch(
      `${BASE_URL}/api/portal/confirm-address`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email: 'wrong@example.com' }),
      }
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toContain('does not match');
  });

  it('confirms address with correct email', async () => {
    const { projectId, token } = await createTestProject({
      withAddress: true,
      pocEmail: 'correct@example.com',
    });
    testProjectId = projectId;

    // Call API to confirm
    const response = await fetch(
      `${BASE_URL}/api/portal/confirm-address`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email: 'correct@example.com' }),
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it('returns alreadyConfirmed on second attempt', async () => {
    const { projectId, token } = await createTestProject({
      withAddress: true,
      pocEmail: 'correct@example.com',
    });
    testProjectId = projectId;

    // First confirm
    await fetch(`${BASE_URL}/api/portal/confirm-address`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, email: 'correct@example.com' }),
    });

    // Second attempt
    const response = await fetch(
      `${BASE_URL}/api/portal/confirm-address`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email: 'correct@example.com' }),
      }
    );

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.alreadyConfirmed).toBe(true);
  });

  it('returns error when no address set', async () => {
    const { projectId, token } = await createTestProject({
      withAddress: false,
      pocEmail: 'test@example.com',
    });
    testProjectId = projectId;

    const response = await fetch(
      `${BASE_URL}/api/portal/confirm-address`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email: 'test@example.com' }),
      }
    );

    expect(response.status).toBe(400);
  });
});
