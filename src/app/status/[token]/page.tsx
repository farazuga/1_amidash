export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { LOGO_URL, APP_NAME } from '@/lib/constants';
import { AnimatedProgressBar } from '@/components/portal/animated-progress-bar';
import { StatusTimeline } from '@/components/portal/status-timeline';
import { Calendar, Clock, Mail, Phone, FileText, User } from 'lucide-react';

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
                      >
                        <Mail className="h-4 w-4" />
                        {project.poc_email}
                      </a>
                    )}
                    {project.poc_phone && (
                      <a
                        href={`tel:${project.poc_phone}`}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[#023A2D]"
                      >
                        <Phone className="h-4 w-4" />
                        {project.poc_phone}
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
