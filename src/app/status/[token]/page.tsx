export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LOGO_URL, APP_NAME } from '@/lib/constants';
import { AnimatedProgressBar } from '@/components/portal/animated-progress-bar';
import { StatusTimeline } from '@/components/portal/status-timeline';
import { StatusAnimation, statusColors, statusMessages } from '@/components/portal/status-animations';
import { Mail, Phone, User } from 'lucide-react';
import type { Status } from '@/types';

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

// ============================================
// Data Masking Utilities
// ============================================
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${local[1]}***@${domain}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `***-***-${digits.slice(-4)}`;
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
  const [project, statuses, statusHistory, projectTypeStatuses] = await Promise.all([
    getProjectByToken(token),
    getStatuses(),
    getProjectByToken(token).then((p) =>
      p ? getStatusHistory(p.id) : []
    ),
    getProjectTypeStatuses(),
  ]);

  if (!project) {
    notFound();
  }

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

  return (
    <div className="min-h-screen bg-[#f8faf9]">
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

      <main className="container mx-auto px-4 py-6 max-w-3xl">
        {/* Main Status Card - Compact Layout */}
        <Card className="mb-4 border-[#023A2D]/20 overflow-hidden">
          {/* Colorful header based on status */}
          <div
            className="h-1.5"
            style={{
              backgroundColor: currentStatus?.name
                ? statusColors[currentStatus.name]?.accent || '#023A2D'
                : '#023A2D'
            }}
          />
          <CardContent className="pt-4 pb-4">
            {/* Project Name Left, Animation Right */}
            <div className="flex items-center justify-between gap-4 mb-4">
              {/* Project Info - Left */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-bold text-[#023A2D] truncate">
                    {project.client_name}
                  </h1>
                  {project.sales_order_number && (
                    <span className="text-sm text-muted-foreground font-medium">
                      #{project.sales_order_number}
                    </span>
                  )}
                </div>
                {project.poc_name && (
                  <p className="text-sm text-muted-foreground">
                    Hi {project.poc_name.split(' ')[0]}! Here&apos;s your update.
                  </p>
                )}
              </div>
              {/* Animation - Right */}
              <div className="w-20 h-20 flex-shrink-0">
                <StatusAnimation statusName={currentStatus?.name || 'PO Received'} />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t mb-4" />

            {/* Current Status Badge + Message */}
            <div className="text-center mb-4">
              <Badge
                className="text-base px-5 py-1.5 shadow-md border-2 mb-2"
                style={{
                  backgroundColor: isOnHold
                    ? '#FED7AA'
                    : statusColors[currentStatus?.name || '']?.accent || '#023A2D',
                  color: 'white',
                  borderColor: isOnHold
                    ? '#F97316'
                    : statusColors[currentStatus?.name || '']?.accent || '#023A2D',
                }}
              >
                {currentStatus?.name || 'Pending'}
              </Badge>
              <p className="text-sm text-muted-foreground italic">
                {isOnHold
                  ? statusMessages['Hold']
                  : statusMessages[currentStatus?.name || ''] || "We're working on your project!"}
              </p>
            </div>

            {/* Progress Bar */}
            <AnimatedProgressBar
              currentStatus={currentStatus}
              statuses={filteredStatuses}
              isOnHold={isOnHold}
            />
          </CardContent>
        </Card>

        {/* Contact Information - Compact */}
        <Card className="mb-4 border-[#023A2D]/20">
          <CardContent className="py-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Point of Contact */}
              {project.poc_name && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-2">Point of Contact</h3>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-3.5 w-3.5 text-[#023A2D]" />
                      <span className="font-medium">{project.poc_name}</span>
                    </div>
                    {project.poc_email && (
                      <a
                        href={`mailto:${project.poc_email}`}
                        className="flex items-center gap-2 text-sm text-[#023A2D] hover:underline"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        <span>{maskEmail(project.poc_email)}</span>
                      </a>
                    )}
                    {project.poc_phone && (
                      <a
                        href={`tel:${project.poc_phone}`}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[#023A2D]"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        <span>{maskPhone(project.poc_phone)}</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Project Manager */}
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-2">Project Manager</h3>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-3.5 w-3.5 text-[#023A2D]" />
                    <span className="font-medium">Jason Watson</span>
                  </div>
                  <a
                    href="mailto:jason@amitrace.com"
                    className="flex items-center gap-2 text-sm text-[#023A2D] hover:underline"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    jason@amitrace.com
                  </a>
                  <a
                    href="tel:770-263-9190"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[#023A2D]"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    770-263-9190
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status History */}
        <Card className="border-[#023A2D]/20">
          <CardHeader className="py-3">
            <h2 className="text-sm font-semibold text-[#023A2D]">
              Status History
            </h2>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <StatusTimeline history={clientVisibleHistory} />
          </CardContent>
        </Card>

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
