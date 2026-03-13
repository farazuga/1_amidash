export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { LOGO_URL, APP_NAME } from '@/lib/constants';
import { BlockRenderer } from '@/components/portal/blocks/block-renderer';
import type { DeliveryAddressConfirmation, Status, PortalBlock, PortalFileUpload } from '@/types';

// ============================================
// Rate Limiting (simple in-memory implementation)
// ============================================
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 60; // requests per minute per IP
const WINDOW_MS = 60 * 1000; // 1 minute window

// Clean up old entries periodically
function cleanupRateLimitMap() {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}

function checkRateLimit(ip: string): boolean {
  // Periodic cleanup (run every ~100 requests to avoid memory leak)
  if (rateLimitMap.size > 1000) {
    cleanupRateLimitMap();
  }

  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}


async function getProjectByToken(token: string) {
  const supabase = await createClient();

  const { data: project } = await supabase
    .from('projects')
    .select(`
      *,
      current_status:statuses(*)
    `)
    .eq('client_token', token)
    .single();

  return project;
}

async function incrementPortalViews(projectId: string) {
  const supabase = await createClient();

  // Increment view count - using type assertion since migration may not be applied yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.rpc as any)('increment_portal_views', { project_id: projectId });
}

async function getStatuses() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('statuses')
    .select('*')
    .eq('is_active', true)
    .order('display_order');
  return data || [];
}

async function getStatusHistory(projectId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('status_history')
    .select(`
      *,
      status:statuses(*)
    `)
    .eq('project_id', projectId)
    .order('changed_at', { ascending: false });
  return data || [];
}

async function getProjectTypeStatuses() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('project_type_statuses')
    .select('*');
  return data || [];
}

async function getFileUploads(projectId: string): Promise<PortalFileUpload[]> {
  // Using `as any` since portal_file_uploads table types not yet regenerated
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const { data } = await supabase
    .from('portal_file_uploads')
    .select('*')
    .eq('project_id', projectId)
    .order('slot_index', { ascending: true });
  return (data || []) as PortalFileUpload[];
}

async function getAddressConfirmation(projectId: string): Promise<DeliveryAddressConfirmation | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const { data } = await supabase
    .from('delivery_address_confirmations')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();
  return data as DeliveryAddressConfirmation | null;
}

interface PortalTemplateResult {
  blocks: PortalBlock[];
  backgroundImageUrl: string | null;
}

async function getPortalTemplate(projectTypeId: string | null): Promise<PortalTemplateResult> {
  const supabase = await createClient();

  const DEFAULT_BLOCKS: PortalBlock[] = [
    { id: 'blk_status_default', type: 'current_status' },
    { id: 'blk_poc_default', type: 'poc_info' },
    { id: 'blk_history_default', type: 'status_history' },
  ];

  // Note: portal_templates table added by migration 048 - using `as any` until types regenerated
  if (projectTypeId) {
    // Try to get template via project type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: projectType } = await (supabase as any)
      .from('project_types')
      .select('portal_template_id')
      .eq('id', projectTypeId)
      .single();

    if (projectType?.portal_template_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: template } = await (supabase as any)
        .from('portal_templates')
        .select('blocks, background_image_url')
        .eq('id', projectType.portal_template_id)
        .single();

      if (template?.blocks && Array.isArray(template.blocks) && template.blocks.length > 0) {
        return { blocks: template.blocks as PortalBlock[], backgroundImageUrl: template.background_image_url ?? null };
      }
    }
  }

  // Fallback to default template
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: defaultTemplate } = await (supabase as any)
    .from('portal_templates')
    .select('blocks, background_image_url')
    .eq('is_default', true)
    .single();

  if (defaultTemplate?.blocks && Array.isArray(defaultTemplate.blocks) && defaultTemplate.blocks.length > 0) {
    return { blocks: defaultTemplate.blocks as PortalBlock[], backgroundImageUrl: defaultTemplate.background_image_url ?? null };
  }

  return { blocks: DEFAULT_BLOCKS, backgroundImageUrl: null };
}

export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  // Rate limiting check
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             headersList.get('x-real-ip') ||
             'unknown';

  if (!checkRateLimit(ip)) {
    return (
      <div className="min-h-screen bg-[#f8faf9] flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <h1 className="text-xl font-semibold text-[#023A2D] mb-2">Too Many Requests</h1>
            <p className="text-muted-foreground">Please wait a moment before refreshing.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { token } = await params;
  const project = await getProjectByToken(token);

  if (!project) {
    notFound();
  }

  const [statuses, statusHistory, projectTypeStatuses, portalTemplate, fileUploads, addressConfirmation] = await Promise.all([
    getStatuses(),
    getStatusHistory(project.id),
    getProjectTypeStatuses(),
    getPortalTemplate(project.project_type_id),
    getFileUploads(project.id),
    getAddressConfirmation(project.id),
  ]);

  const { blocks: templateBlocks, backgroundImageUrl } = portalTemplate;

  // Increment view count (fire and forget - don't block render)
  incrementPortalViews(project.id);

  // Filter statuses by project type (with fallback to all statuses)
  const allowedStatusIds = project.project_type_id
    ? projectTypeStatuses
        .filter((pts: { project_type_id: string }) => pts.project_type_id === project.project_type_id)
        .map((pts: { status_id: string }) => pts.status_id)
    : [];

  const filteredStatuses = ((project.project_type_id && allowedStatusIds.length > 0
    ? statuses.filter(s => allowedStatusIds.includes(s.id))
    : statuses) as Status[]).filter(s => !s.is_internal_only);

  const actualStatus = project.current_status as Status | null;

  // If current status is internal-only, find the last client-visible status from history
  const clientVisibleStatus: Status | null = actualStatus?.is_internal_only
    ? (statusHistory.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (entry: any) => entry.status && !entry.status.is_internal_only
      )?.status as Status | undefined) ?? null
    : actualStatus;

  const currentStatus = clientVisibleStatus;
  const isOnHold = currentStatus?.name === 'Hold';

  // Filter status history to exclude internal-only entries
  const clientVisibleHistory = statusHistory.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (entry: any) => entry.status && !entry.status.is_internal_only
  );

  // Partition blocks into left column, right column, and bottom (full-width)
  const LEFT_TYPES = new Set(['current_status', 'poc_info']);
  const BOTTOM_TYPES = new Set(['status_history']);

  const leftBlocks = templateBlocks.filter((b) => LEFT_TYPES.has(b.type));
  const rightBlocks = templateBlocks.filter(
    (b) => !LEFT_TYPES.has(b.type) && !BOTTOM_TYPES.has(b.type)
  );
  const bottomBlocks = templateBlocks.filter((b) => BOTTOM_TYPES.has(b.type));

  // Ensure left always has current_status and poc_info even if missing from template
  if (!leftBlocks.some((b) => b.type === 'current_status')) {
    leftBlocks.unshift({ id: 'blk_status_fallback', type: 'current_status' });
  }
  if (!leftBlocks.some((b) => b.type === 'poc_info')) {
    leftBlocks.push({ id: 'blk_poc_fallback', type: 'poc_info' });
  }
  if (!bottomBlocks.some((b) => b.type === 'status_history')) {
    bottomBlocks.push({ id: 'blk_history_fallback', type: 'status_history' });
  }

  const portalData = {
    project: project as any,
    currentStatus,
    filteredStatuses,
    isOnHold,
    clientVisibleHistory,
    projectToken: token,
    fileUploads,
    addressConfirmation,
  };

  return (
    <div
      className="min-h-screen bg-[#f8faf9]"
      style={backgroundImageUrl ? {
        backgroundImage: `url(${backgroundImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      } : undefined}
    >
      {/* Header with Logo */}
      <header className="bg-[#023A2D] text-white py-2">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center">
            <Image
              src={LOGO_URL}
              alt={APP_NAME}
              width={120}
              height={32}
              className="brightness-0 invert"
              priority
            />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Two-column layout */}
        <div className="md:grid md:grid-cols-2 md:gap-6 items-start">
          {/* Left column: status + contact */}
          <div className="space-y-4">
            {leftBlocks.map((block) => (
              <BlockRenderer key={block.id} block={block} data={portalData} />
            ))}
          </div>

          {/* Right column: builder blocks */}
          {rightBlocks.length > 0 && (
            <div className="space-y-4">
              {rightBlocks.map((block) => (
                <BlockRenderer key={block.id} block={block} data={portalData} />
              ))}
            </div>
          )}
        </div>

        {/* Bottom: status history full-width */}
        {bottomBlocks.map((block) => (
          <BlockRenderer key={block.id} block={block} data={portalData} />
        ))}

        {/* Footer */}
        <footer className="mt-6 text-center text-xs text-muted-foreground">
          <p>
            Questions? Contact us at{' '}
            <a
              href="mailto:support@amitrace.com"
              className="text-[#023A2D] hover:underline"
            >
              support@amitrace.com
            </a>
          </p>
          <p className="mt-1">&copy; {new Date().getFullYear()} {APP_NAME}</p>
        </footer>
      </main>
    </div>
  );
}
