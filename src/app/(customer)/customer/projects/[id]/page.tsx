export const dynamic = 'force-dynamic';

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AnimatedProgressBar } from '@/components/portal/animated-progress-bar';
import { StatusTimeline } from '@/components/portal/status-timeline';
import { StatusAnimation, statusColors, statusMessages } from '@/components/portal/status-animations';
import { Mail, Phone, User, ArrowLeft } from 'lucide-react';

async function getProject(projectId: string) {
  const supabase = await createClient();

  const { data: project } = await supabase
    .from('projects')
    .select(`
      *,
      current_status:statuses(*)
    `)
    .eq('id', projectId)
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

export default async function CustomerProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;

  // Get current user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect('/login');
  }

  const [project, statuses, statusHistory, projectTypeStatuses] = await Promise.all([
    getProject(projectId),
    getStatuses(),
    getStatusHistory(projectId),
    getProjectTypeStatuses(),
  ]);

  if (!project) {
    notFound();
  }

  // Verify this customer has access to this project (poc_email matches)
  if (project.poc_email?.toLowerCase() !== user.email.toLowerCase()) {
    notFound();
  }

  // Filter statuses by project type
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
    <div className="space-y-4">
      {/* Back button */}
      <Link href="/customer">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Button>
      </Link>

      {/* Main Status Card */}
      <Card className="border-[#023A2D]/20 overflow-hidden">
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
                  Hi {project.poc_name.split(' ')[0]}! Here&apos;s your project status.
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

      {/* Contact Information */}
      <Card className="border-[#023A2D]/20">
        <CardContent className="py-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Your Contact Info */}
            {project.poc_name && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-2">Your Contact Info</h3>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-3.5 w-3.5 text-[#023A2D]" />
                    <span className="font-medium">{project.poc_name}</span>
                  </div>
                  {project.poc_email && (
                    <div className="flex items-center gap-2 text-sm text-[#023A2D]">
                      <Mail className="h-3.5 w-3.5" />
                      <span>{project.poc_email}</span>
                    </div>
                  )}
                  {project.poc_phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{project.poc_phone}</span>
                    </div>
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
          <StatusTimeline history={statusHistory} />
        </CardContent>
      </Card>
    </div>
  );
}
