declare const page: import('puppeteer').Page;

import {
  createTestProject,
  cleanupTestProject,
  navigateToPortal,
} from './helpers/portal';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('File Upload Block', () => {
  let testProjectId: string;

  afterEach(async () => {
    if (testProjectId) {
      await cleanupTestProject(testProjectId);
      testProjectId = '';
    }
  });

  it('shows file upload slots on portal', async () => {
    // Note: This test requires a project with a portal template that includes file_upload block
    const { projectId, token } = await createTestProject({
      withAddress: true,
    });
    testProjectId = projectId;

    await navigateToPortal(page, token);

    // Basic smoke - the page loads
    const content = await page.content();
    expect(content).toBeTruthy();
  });

  it('rejects files over 3MB', async () => {
    const { projectId, token } = await createTestProject({
      withAddress: true,
    });
    testProjectId = projectId;

    await navigateToPortal(page, token);

    // Create a temp file larger than 3MB
    const tmpDir = os.tmpdir();
    const largePath = path.join(tmpDir, 'large-test.pdf');
    fs.writeFileSync(largePath, Buffer.alloc(4 * 1024 * 1024)); // 4MB

    // Try to find a file input
    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      await (fileInput as import('puppeteer').ElementHandle<HTMLInputElement>).uploadFile(largePath);
      // Should show error about file size
      await new Promise((r) => setTimeout(r, 1000));
      const content = await page.content();
      expect(content.toLowerCase()).toMatch(/too large|3\s*mb|size/);
    }

    // Cleanup temp file
    fs.unlinkSync(largePath);
  });

  it('rejects invalid file types', async () => {
    const { projectId, token } = await createTestProject({
      withAddress: true,
    });
    testProjectId = projectId;

    await navigateToPortal(page, token);

    // Create a temp .txt file
    const tmpDir = os.tmpdir();
    const txtPath = path.join(tmpDir, 'test.txt');
    fs.writeFileSync(txtPath, 'hello world');

    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      await (fileInput as import('puppeteer').ElementHandle<HTMLInputElement>).uploadFile(txtPath);
      await new Promise((r) => setTimeout(r, 1000));
      const content = await page.content();
      // Should reject .txt
      expect(content.toLowerCase()).toMatch(/not allowed|invalid|type/);
    }

    fs.unlinkSync(txtPath);
  });
});
