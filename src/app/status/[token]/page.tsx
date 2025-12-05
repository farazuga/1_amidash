export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { LOGO_URL, APP_NAME } from '@/lib/constants';
import { AnimatedProgressBar } from '@/components/portal/animated-progress-bar';
import { StatusTimeline } from '@/components/portal/status-timeline';
import { Calendar, Clock, Mail, Phone, FileText, User } from 'lucide-react';

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

  const filteredStatuses = project.project_type_id && allowedStatusIds.length > 0
    ? statuses.filter(s => allowedStatusIds.includes(s.id))
    : statuses;

  const currentStatus = project.current_status;
  const isOnHold = currentStatus?.name === 'Hold';

  return (
    <div className="min-h-screen bg-[#f8faf9]">
      {/* Header */}
      <header className="bg-[#023A2D] text-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center">
            <Image
              src={LOGO_URL}
              alt={APP_NAME}
              width={180}
              height={50}
              className="brightness-0 invert"
              priority
            />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Project Info Card */}
        <Card className="mb-6 border-[#023A2D]/20">
          <CardHeader className="pb-4">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-[#023A2D]">
                Project Status
              </h1>
              <p className="text-lg text-muted-foreground">
                {project.client_name}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {/* Current Status */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2">
                <Badge
                  className={`text-lg px-4 py-2 ${
                    isOnHold
                      ? 'bg-orange-100 text-orange-800 border-orange-300'
                      : 'bg-[#023A2D] text-white'
                  }`}
                >
                  {currentStatus?.name || 'Pending'}
                </Badge>
                {isOnHold && (
                  <Badge variant="outline" className="text-orange-600 border-orange-300">
                    On Hold
                  </Badge>
                )}
              </div>
            </div>

            {/* Animated Progress Bar */}
            <div className="mb-8">
              <AnimatedProgressBar
                currentStatus={currentStatus}
                statuses={filteredStatuses}
                isOnHold={isOnHold}
              />
            </div>

            {/* Key Dates */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {project.goal_completion_date && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Calendar className="h-5 w-5 text-[#023A2D]" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Expected Completion
                    </p>
                    <p className="font-medium">
                      {format(
                        new Date(project.goal_completion_date),
                        'MMMM d, yyyy'
                      )}
                    </p>
                  </div>
                </div>
              )}

              {project.expected_update_date && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Clock className="h-5 w-5 text-[#023A2D]" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Next Update
                    </p>
                    <p className="font-medium">
                      {format(
                        new Date(project.expected_update_date),
                        'MMMM d, yyyy'
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Project Details */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {project.sales_order_number && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <FileText className="h-5 w-5 text-[#023A2D]" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Sales Order #
                    </p>
                    <p className="font-medium">{project.sales_order_number}</p>
                  </div>
                </div>
              )}

              {project.po_number && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <FileText className="h-5 w-5 text-[#023A2D]" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Client PO #
                    </p>
                    <p className="font-medium">{project.po_number}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="mb-6 border-[#023A2D]/20">
          <CardHeader>
            <h2 className="text-lg font-semibold text-[#023A2D]">
              Contact Information
            </h2>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Point of Contact */}
              {project.poc_name && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Point of Contact</h3>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-[#023A2D]" />
                      <span className="font-medium">{project.poc_name}</span>
                    </div>
                    {project.poc_email && (
                      <a
                        href={`mailto:${project.poc_email}`}
                        className="flex items-center gap-2 text-sm text-[#023A2D] hover:underline"
                        title="Click to email"
                      >
                        <Mail className="h-4 w-4" />
                        <span>{maskEmail(project.poc_email)}</span>
                      </a>
                    )}
                    {project.poc_phone && (
                      <a
                        href={`tel:${project.poc_phone}`}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[#023A2D]"
                        title="Click to call"
                      >
                        <Phone className="h-4 w-4" />
                        <span>{maskPhone(project.poc_phone)}</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Project Manager */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Project Manager</h3>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-[#023A2D]" />
                    <span className="font-medium">Jason Watson</span>
                  </div>
                  <a
                    href="mailto:jason@amitrace.com"
                    className="flex items-center gap-2 text-sm text-[#023A2D] hover:underline"
                  >
                    <Mail className="h-4 w-4" />
                    jason@amitrace.com
                  </a>
                  <a
                    href="tel:770-263-9190"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[#023A2D]"
                  >
                    <Phone className="h-4 w-4" />
                    770-263-9190
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status History */}
        <Card className="border-[#023A2D]/20">
          <CardHeader>
            <h2 className="text-lg font-semibold text-[#023A2D]">
              Status History
            </h2>
          </CardHeader>
          <CardContent>
            <StatusTimeline history={statusHistory} />
          </CardContent>
        </Card>

        {/* Footer */}
        <footer className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            Questions? Contact us at{' '}
            <a
              href="mailto:support@amitrace.com"
              className="text-[#023A2D] hover:underline"
            >
              support@amitrace.com
            </a>
          </p>
          <p className="mt-2">&copy; {new Date().getFullYear()} {APP_NAME}</p>
        </footer>
      </main>
    </div>
  );
}
