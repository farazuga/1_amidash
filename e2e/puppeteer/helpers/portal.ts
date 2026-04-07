import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import type { Page } from 'puppeteer';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

export async function createTestProject(
  options: {
    isDraft?: boolean;
    withAddress?: boolean;
    clientName?: string;
    pocEmail?: string;
  } = {}
) {
  const supabase = getSupabase();
  const token = randomUUID();

  // Get Draft status ID
  const { data: draftStatus } = await supabase
    .from('statuses')
    .select('id')
    .eq('name', 'Draft')
    .single();

  // Get any non-draft status
  const { data: activeStatus } = await supabase
    .from('statuses')
    .select('id')
    .eq('is_internal_only', false)
    .eq('is_active', true)
    .limit(1)
    .single();

  const projectData: Record<string, unknown> = {
    client_name: options.clientName || `E2E Test ${Date.now()}`,
    client_token: token,
    is_draft: options.isDraft ?? false,
    current_status_id: options.isDraft ? draftStatus?.id : activeStatus?.id,
    poc_email: options.pocEmail || 'test@example.com',
    poc_name: 'Test User',
    created_date: new Date().toISOString().split('T')[0],
  };

  if (options.withAddress) {
    projectData.delivery_street = '123 Main St';
    projectData.delivery_city = 'Charleston';
    projectData.delivery_state = 'SC';
    projectData.delivery_zip = '29401';
    projectData.delivery_country = 'US';
  }

  const { data: project, error } = await supabase
    .from('projects')
    .insert(projectData)
    .select()
    .single();

  if (error) throw error;
  return { projectId: project.id, token };
}

export async function cleanupTestProject(projectId: string) {
  const supabase = getSupabase();
  // Clean up in order: approvals, file uploads, confirmations, status history, project
  await supabase
    .from('customer_approval_tasks')
    .delete()
    .filter(
      'file_upload_id',
      'in',
      `(select id from portal_file_uploads where project_id = '${projectId}')`
    );
  await supabase
    .from('portal_file_uploads')
    .delete()
    .eq('project_id', projectId);
  await supabase
    .from('delivery_address_confirmations')
    .delete()
    .eq('project_id', projectId);
  await supabase
    .from('status_history')
    .delete()
    .eq('project_id', projectId);
  await supabase.from('projects').delete().eq('id', projectId);
}

export async function navigateToPortal(page: Page, token: string) {
  await page.goto(`${BASE_URL}/status/${token}`, {
    waitUntil: 'networkidle0',
  });
}

export async function loginAsAdmin(page: Page) {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!email || !password)
    throw new Error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be set');

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });
}

export { BASE_URL };
