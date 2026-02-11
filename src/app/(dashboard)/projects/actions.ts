'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { createProjectSharePointFolder } from '@/lib/sharepoint/folder-operations';
import { getGlobalSharePointConfig, getMicrosoftConnection } from '@/app/(dashboard)/projects/[salesOrder]/files/actions';
import { syncProjectAssignmentsToOutlook } from '@/lib/microsoft-graph/sync';

// Helper to get sales order number from project ID for revalidation
async function getSalesOrderNumber(projectId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('projects')
    .select('sales_order_number')
    .eq('id', projectId)
    .single();
  return data?.sales_order_number || null;
}

export interface CreateProjectData {
  client_name: string;
  sales_order_number: string | null;
  sales_order_url: string | null;
  po_number: string | null;
  sales_amount: number | null;
  contract_type: string;
  goal_completion_date: string | null;
  start_date?: string | null;
  end_date?: string | null;
  salesperson_id: string;
  poc_name: string | null;
  poc_email: string | null;
  poc_phone: string | null;
  secondary_poc_email: string | null;
  scope_link: string | null;
  number_of_vidpods?: number | null;
  project_type_id: string;
  tags: string[];
  email_notifications_enabled?: boolean;
  activecampaign_account_id?: string | null;
  activecampaign_contact_id?: string | null;
  secondary_activecampaign_contact_id?: string | null;
}

export interface CreateProjectResult {
  success: boolean;
  projectId?: string;
  salesOrderNumber?: string;
  clientToken?: string;
  error?: string;
}

export async function createProject(data: CreateProjectData): Promise<CreateProjectResult> {
  const supabase = await createClient();

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  // Check if sales order number is already in use
  if (data.sales_order_number && data.sales_order_number.trim()) {
    const { data: existingProject } = await supabase
      .from('projects')
      .select('id, client_name')
      .eq('sales_order_number', data.sales_order_number.trim())
      .maybeSingle();

    if (existingProject) {
      return {
        success: false,
        error: `Sales Order # ${data.sales_order_number} is already used by project "${existingProject.client_name}"`
      };
    }
  }

  // Get first status for the selected project type
  const { data: projectTypeStatuses } = await supabase
    .from('project_type_statuses')
    .select('status_id')
    .eq('project_type_id', data.project_type_id);

  if (!projectTypeStatuses || projectTypeStatuses.length === 0) {
    return { success: false, error: 'No statuses configured for this project type' };
  }

  const statusIds = projectTypeStatuses.map(pts => pts.status_id);

  const { data: statuses } = await supabase
    .from('statuses')
    .select('*')
    .in('id', statusIds)
    .eq('is_active', true)
    .order('display_order');

  if (!statuses || statuses.length === 0) {
    return { success: false, error: 'No active statuses for this project type' };
  }

  const firstStatus = statuses[0];

  // Insert the project
  const { data: newProject, error: insertError } = await supabase
    .from('projects')
    .insert({
      client_name: data.client_name,
      sales_order_number: data.sales_order_number,
      sales_order_url: data.sales_order_url,
      po_number: data.po_number,
      sales_amount: data.sales_amount,
      contract_type: data.contract_type,
      goal_completion_date: data.goal_completion_date,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      salesperson_id: data.salesperson_id,
      poc_name: data.poc_name,
      poc_email: data.poc_email,
      poc_phone: data.poc_phone,
      secondary_poc_email: data.secondary_poc_email,
      scope_link: data.scope_link,
      number_of_vidpods: data.number_of_vidpods ?? null,
      project_type_id: data.project_type_id,
      current_status_id: firstStatus.id,
      created_by: user.id,
      email_notifications_enabled: data.email_notifications_enabled ?? true,
      activecampaign_account_id: data.activecampaign_account_id || null,
      activecampaign_contact_id: data.activecampaign_contact_id || null,
      secondary_activecampaign_contact_id: data.secondary_activecampaign_contact_id || null,
    })
    .select()
    .single();

  if (insertError) {
    console.error('Project insert error:', insertError);
    return { success: false, error: 'Failed to create project' };
  }

  // Create status history, audit log, and tags in background
  // These are non-blocking since the project is already created
  try {
    await Promise.all([
      supabase.from('status_history').insert({
        project_id: newProject.id,
        status_id: firstStatus.id,
        changed_by: user.id,
      }),
      supabase.from('audit_logs').insert({
        project_id: newProject.id,
        user_id: user.id,
        action: 'create',
        field_name: 'project',
        new_value: data.client_name,
      }),
      data.tags.length > 0
        ? supabase.from('project_tags').insert(
            data.tags.map((tagId) => ({
              project_id: newProject.id,
              tag_id: tagId,
            }))
          )
        : Promise.resolve(),
    ]);
  } catch (err) {
    console.error('Background tasks error:', err);
    // Don't fail the whole operation for background tasks
  }

  // Auto-create SharePoint folder (background, non-blocking)
  // Only if sales_order_number is provided (required for folder naming)
  if (data.sales_order_number) {
    (async () => {
      try {
        // Check if global SharePoint is configured
        const globalConfig = await getGlobalSharePointConfig();
        if (!globalConfig) {
          console.log('[createProject] SharePoint not configured, skipping folder creation');
          return;
        }

        // Get user's Microsoft connection
        const msConnection = await getMicrosoftConnection(user.id);
        if (!msConnection) {
          console.log('[createProject] User not connected to Microsoft, skipping folder creation');
          return;
        }

        // Create the SharePoint folder
        const result = await createProjectSharePointFolder(
          {
            projectId: newProject.id,
            salesOrderNumber: data.sales_order_number!,
            clientName: data.client_name,
            userId: user.id,
            msConnection,
            globalConfig,
          },
          supabase
        );

        if (result.success) {
          console.log(`[createProject] SharePoint folder created: ${data.sales_order_number} ${data.client_name}`);
        } else {
          console.error('[createProject] SharePoint folder creation failed:', result.error);
        }
      } catch (error) {
        console.error('[createProject] SharePoint folder creation error:', error);
        // Don't fail - folder can be created later when files are uploaded
      }
    })();
  }

  revalidatePath('/projects');

  return {
    success: true,
    projectId: newProject.id,
    salesOrderNumber: newProject.sales_order_number ?? newProject.id,
    clientToken: newProject.client_token ?? undefined,
  };
}

export interface UpdateStatusData {
  projectId: string;
  newStatusId: string;
  note?: string;
  currentStatusName?: string;
  newStatusName?: string;
}

export interface UpdateStatusResult {
  success: boolean;
  error?: string;
}

export interface UpdateProjectDatesData {
  projectId: string;
  startDate: string | null;
  endDate: string | null;
}

export interface UpdateProjectDatesResult {
  success: boolean;
  error?: string;
}

export async function updateProjectDates(data: UpdateProjectDatesData): Promise<UpdateProjectDatesResult> {
  const supabase = await createClient();

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  // Get current project dates for audit log
  const { data: project, error: fetchError } = await supabase
    .from('projects')
    .select('start_date, end_date, sales_order_number')
    .eq('id', data.projectId)
    .single();

  if (fetchError) {
    return { success: false, error: 'Project not found' };
  }

  // Update project dates
  const { error: updateError } = await supabase
    .from('projects')
    .update({
      start_date: data.startDate,
      end_date: data.endDate,
    })
    .eq('id', data.projectId);

  if (updateError) {
    console.error('Date update error:', updateError);
    return { success: false, error: 'Failed to update dates' };
  }

  // Add audit log
  try {
    await supabase.from('audit_logs').insert({
      project_id: data.projectId,
      user_id: user.id,
      action: 'update',
      field_name: 'dates',
      old_value: project.start_date && project.end_date
        ? `${project.start_date} to ${project.end_date}`
        : null,
      new_value: data.startDate && data.endDate
        ? `${data.startDate} to ${data.endDate}`
        : null,
    });
  } catch (err) {
    console.error('Audit log error:', err);
    // Don't fail the whole operation
  }

  // Sync all assignments for this project to Outlook (dates changed)
  // Uses the centralized helper that also fetches team members for enriched event body
  if (data.startDate && data.endDate) {
    syncProjectAssignmentsToOutlook(data.projectId).catch((err) =>
      console.error('Error syncing project assignments to Outlook:', err)
    );
  }

  if (project.sales_order_number) {
    revalidatePath(`/projects/${project.sales_order_number}`);
  }
  revalidatePath('/projects');
  revalidatePath('/project-calendar');

  return { success: true };
}

export async function updateProjectStatus(data: UpdateStatusData): Promise<UpdateStatusResult> {
  const supabase = await createClient();

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  // Update project status
  const { error: updateError } = await supabase
    .from('projects')
    .update({ current_status_id: data.newStatusId })
    .eq('id', data.projectId);

  if (updateError) {
    console.error('Status update error:', updateError);
    return { success: false, error: 'Failed to update status' };
  }

  // Add to status history and audit log
  try {
    await Promise.all([
      supabase.from('status_history').insert({
        project_id: data.projectId,
        status_id: data.newStatusId,
        note: data.note || null,
        changed_by: user.id,
      }),
      supabase.from('audit_logs').insert({
        project_id: data.projectId,
        user_id: user.id,
        action: 'update',
        field_name: 'status',
        old_value: data.currentStatusName || null,
        new_value: data.newStatusName || null,
      }),
    ]);
  } catch (err) {
    console.error('Background tasks error:', err);
    // Don't fail the whole operation for background tasks
  }

  const salesOrder = await getSalesOrderNumber(data.projectId);
  if (salesOrder) {
    revalidatePath(`/projects/${salesOrder}`);
  }
  revalidatePath('/projects');

  return { success: true };
}

export interface BulkUpdateScheduleStatusData {
  projectIds: string[];
  scheduleStatus: string;
}

export interface BulkUpdateScheduleStatusResult {
  success: boolean;
  updatedCount?: number;
  error?: string;
}

export async function bulkUpdateScheduleStatus(data: BulkUpdateScheduleStatusData): Promise<BulkUpdateScheduleStatusResult> {
  const supabase = await createClient();

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  // Permission check - only admin/editor can bulk update
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'editor'].includes(profile.role || '')) {
    return { success: false, error: 'Insufficient permissions' };
  }

  if (!data.projectIds.length) {
    return { success: false, error: 'No projects selected' };
  }

  // Validate schedule status value
  const validStatuses = ['draft', 'tentative', 'pending_confirm', 'confirmed'];
  if (!validStatuses.includes(data.scheduleStatus)) {
    return { success: false, error: 'Invalid schedule status' };
  }

  // Update all projects
  const { error: updateError, count } = await supabase
    .from('projects')
    .update({ schedule_status: data.scheduleStatus })
    .in('id', data.projectIds);

  if (updateError) {
    console.error('Bulk status update error:', updateError);
    return { success: false, error: 'Failed to update projects' };
  }

  // Add audit logs
  try {
    await supabase.from('audit_logs').insert(
      data.projectIds.map(projectId => ({
        project_id: projectId,
        user_id: user.id,
        action: 'update',
        field_name: 'schedule_status',
        new_value: data.scheduleStatus,
      }))
    );
  } catch (err) {
    console.error('Audit log error:', err);
    // Don't fail the whole operation
  }

  revalidatePath('/projects');
  revalidatePath('/project-calendar');

  return { success: true, updatedCount: count || data.projectIds.length };
}

export interface UpdateScheduleStatusData {
  projectId: string;
  scheduleStatus: string;
}

export interface UpdateScheduleStatusResult {
  success: boolean;
  error?: string;
}

export async function updateProjectScheduleStatus(data: UpdateScheduleStatusData): Promise<UpdateScheduleStatusResult> {
  const supabase = await createClient();

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  // Verify user has permission (admin or editor)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'editor'].includes(profile.role || '')) {
    return { success: false, error: 'Insufficient permissions' };
  }

  // Verify project exists and has dates
  const { data: project } = await supabase
    .from('projects')
    .select('id, start_date, end_date, sales_order_number')
    .eq('id', data.projectId)
    .single();

  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  if (!project.start_date || !project.end_date) {
    return { success: false, error: 'Project must have start and end dates to set schedule status' };
  }

  // Update the project
  const { error: updateError } = await supabase
    .from('projects')
    .update({ schedule_status: data.scheduleStatus })
    .eq('id', data.projectId);

  if (updateError) {
    console.error('Schedule status update error:', updateError);
    return { success: false, error: 'Failed to update schedule status' };
  }

  // Add audit log
  try {
    await supabase.from('audit_logs').insert({
      project_id: data.projectId,
      user_id: user.id,
      action: 'update',
      field_name: 'schedule_status',
      new_value: data.scheduleStatus,
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }

  if (project.sales_order_number) {
    revalidatePath(`/projects/${project.sales_order_number}`);
  }
  revalidatePath('/projects');
  revalidatePath('/project-calendar');

  return { success: true };
}

// Inline edit actions for Quick Info fields
export interface InlineEditData {
  projectId: string;
  field: string;
  value: string | null;
  note?: string;
}

export interface InlineEditResult {
  success: boolean;
  error?: string;
}

export async function inlineEditProjectField(data: InlineEditData): Promise<InlineEditResult> {
  const supabase = await createClient();

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  // Map field names to database columns
  const fieldMap: Record<string, string> = {
    goal_date: 'goal_completion_date',
    sales_amount: 'sales_amount',
    salesperson_id: 'salesperson_id',
    start_date: 'start_date',
    end_date: 'end_date',
    sales_order_number: 'sales_order_number',
    sales_order_url: 'sales_order_url',
    status_id: 'current_status_id',
    created_at: 'created_at',
    invoiced_date: 'invoiced_date',
  };

  const dbField = fieldMap[data.field];
  if (!dbField) {
    return { success: false, error: 'Invalid field' };
  }

  // Special handling for status changes - need to update status history
  if (data.field === 'status_id' && data.value) {
    // Use the dedicated status update function for proper history tracking
    const { data: currentProject } = await supabase
      .from('projects')
      .select('current_status:statuses(name)')
      .eq('id', data.projectId)
      .single();

    const { data: newStatus } = await supabase
      .from('statuses')
      .select('name')
      .eq('id', data.value)
      .single();

    const result = await updateProjectStatus({
      projectId: data.projectId,
      newStatusId: data.value,
      note: data.note,
      currentStatusName: (currentProject?.current_status as { name: string } | null)?.name,
      newStatusName: newStatus?.name,
    });

    return result;
  }

  // Get current project for audit log and sales order
  const { data: project } = await supabase
    .from('projects')
    .select('sales_order_number, goal_completion_date, sales_amount, salesperson_id, start_date, end_date, sales_order_url, created_at, invoiced_date')
    .eq('id', data.projectId)
    .single();

  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  // Get old value for audit log
  const oldValue = project[dbField as keyof typeof project];

  // Prepare value for database
  let dbValue: string | number | null = data.value;
  if (data.field === 'sales_amount' && data.value) {
    dbValue = parseFloat(data.value) || null;
  }

  // Update the field
  const { error: updateError } = await supabase
    .from('projects')
    .update({ [dbField]: dbValue })
    .eq('id', data.projectId);

  if (updateError) {
    console.error('Inline edit error:', updateError);
    return { success: false, error: 'Failed to update field' };
  }

  // Add audit log
  try {
    await supabase.from('audit_logs').insert({
      project_id: data.projectId,
      user_id: user.id,
      action: 'update',
      field_name: data.field,
      old_value: String(oldValue ?? ''),
      new_value: data.value || '',
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }

  // If date field changed, sync assignments to Outlook
  // Uses the centralized helper that also fetches team members for enriched event body
  if (data.field === 'start_date' || data.field === 'end_date') {
    syncProjectAssignmentsToOutlook(data.projectId).catch((err) =>
      console.error('Error syncing project assignments to Outlook:', err)
    );
  }

  // Revalidate paths
  if (project.sales_order_number) {
    revalidatePath(`/projects/${project.sales_order_number}`);
  }
  revalidatePath('/projects');
  revalidatePath('/project-calendar');

  return { success: true };
}

// ============================================
// Get Project Scheduled Hours
// ============================================

export interface ProjectScheduledHoursResult {
  success: boolean;
  data?: {
    totalHours: number;
    totalDays: number;
    byEngineer: Array<{
      userId: string;
      userName: string;
      hours: number;
      days: number;
    }>;
  };
  error?: string;
}

export async function getProjectScheduledHours(projectId: string): Promise<ProjectScheduledHoursResult> {
  const supabase = await createClient();

  // Define types for the query result
  interface AssignmentDayRow {
    work_date: string;
    start_time: string;
    end_time: string;
  }

  interface AssignmentRow {
    id: string;
    user_id: string;
    user: { id: string; full_name: string | null; email: string } | null;
    assignment_days: AssignmentDayRow[] | null;
  }

  // Fetch all assignments for this project with their assignment days
  const { data: assignments, error } = await supabase
    .from('project_assignments')
    .select(`
      id,
      user_id,
      user:profiles!project_assignments_user_id_fkey(id, full_name, email),
      assignment_days(
        work_date,
        start_time,
        end_time
      )
    `)
    .eq('project_id', projectId);

  if (error) {
    console.error('Error fetching project hours:', error);
    return { success: false, error: error.message };
  }

  if (!assignments || assignments.length === 0) {
    return {
      success: true,
      data: {
        totalHours: 0,
        totalDays: 0,
        byEngineer: [],
      },
    };
  }

  // Type assertion for assignments
  const typedAssignments = assignments as unknown as AssignmentRow[];

  // Calculate hours per engineer
  const byEngineer: Array<{
    userId: string;
    userName: string;
    hours: number;
    days: number;
  }> = [];

  let totalHours = 0;
  let totalDays = 0;

  // Parse time string to decimal hours
  const parseTime = (timeStr: string): number => {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1] || '0', 10);
    return hours + minutes / 60;
  };

  for (const assignment of typedAssignments) {
    const days = assignment.assignment_days || [];
    let engineerHours = 0;

    for (const day of days) {
      const startHour = parseTime(day.start_time || '07:00');
      const endHour = parseTime(day.end_time || '16:00');
      const hoursWorked = Math.max(0, endHour - startHour);
      engineerHours += hoursWorked;
    }

    byEngineer.push({
      userId: assignment.user_id,
      userName: assignment.user?.full_name || assignment.user?.email || 'Unknown',
      hours: Math.round(engineerHours * 10) / 10, // Round to 1 decimal
      days: days.length,
    });

    totalHours += engineerHours;
    totalDays += days.length;
  }

  return {
    success: true,
    data: {
      totalHours: Math.round(totalHours * 10) / 10,
      totalDays,
      byEngineer,
    },
  };
}
