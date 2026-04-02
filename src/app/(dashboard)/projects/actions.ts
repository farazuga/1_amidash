'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { createProjectSharePointFolder } from '@/lib/sharepoint/folder-operations';
import { getGlobalSharePointConfig, migrateChildFilesToParent } from '@/app/(dashboard)/projects/[salesOrder]/files/actions';
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
  // Odoo integration
  odoo_order_id?: number | null;
  odoo_invoice_status?: string | null;
  project_description?: string | null;
  // Draft & Delivery
  is_draft?: boolean;
  delivery_street?: string | null;
  delivery_city?: string | null;
  delivery_state?: string | null;
  delivery_zip?: string | null;
  delivery_country?: string | null;
  // Parent-child
  parent_project_id?: string | null;
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

  // ---- Draft project flow ----
  if (data.is_draft) {
    // Look up the "Draft" status by name
    const { data: draftStatus } = await supabase
      .from('statuses')
      .select('id')
      .eq('name', 'Draft')
      .single();

    if (!draftStatus) {
      return { success: false, error: 'Draft status not found' };
    }

    // Insert draft project (skip sales order uniqueness check, no client_token)
    const { data: newProject, error: insertError } = await supabase
      .from('projects')
      .insert({
        client_name: data.client_name,
        sales_order_number: data.sales_order_number ?? undefined,
        sales_order_url: data.sales_order_url,
        po_number: data.po_number,
        sales_amount: data.sales_amount,
        contract_type: data.contract_type,
        goal_completion_date: data.goal_completion_date,
        start_date: data.start_date || undefined,
        end_date: data.end_date || undefined,
        salesperson_id: data.salesperson_id,
        poc_name: data.poc_name,
        poc_email: data.poc_email,
        poc_phone: data.poc_phone,
        secondary_poc_email: data.secondary_poc_email,
        scope_link: data.scope_link,
        number_of_vidpods: data.number_of_vidpods ?? null,
        project_type_id: data.project_type_id,
        current_status_id: draftStatus.id,
        is_draft: true,
        created_by: user.id,
        email_notifications_enabled: data.email_notifications_enabled ?? true,
        activecampaign_account_id: data.activecampaign_account_id || null,
        activecampaign_contact_id: data.activecampaign_contact_id || null,
        secondary_activecampaign_contact_id: data.secondary_activecampaign_contact_id || null,
        // Odoo integration
        ...(data.odoo_order_id != null && { odoo_order_id: data.odoo_order_id }),
        ...(data.odoo_invoice_status != null && { odoo_invoice_status: data.odoo_invoice_status }),
        ...(data.project_description != null && { project_description: data.project_description }),
        ...(data.odoo_order_id != null && { odoo_last_synced_at: new Date().toISOString() }),
        // Parent-child
        ...(data.parent_project_id != null && { parent_project_id: data.parent_project_id }),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Draft project insert error:', insertError);
      return { success: false, error: 'Failed to create draft project' };
    }

    // Create status history and audit log (skip SharePoint for drafts)
    try {
      await Promise.all([
        supabase.from('status_history').insert({
          project_id: newProject.id,
          status_id: draftStatus.id,
          changed_by: user.id,
        }),
        supabase.from('audit_logs').insert({
          project_id: newProject.id,
          user_id: user.id,
          action: 'create',
          field_name: 'project',
          new_value: `${data.client_name} (draft)`,
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
    }

    revalidatePath('/projects');

    return {
      success: true,
      projectId: newProject.id,
      salesOrderNumber: newProject.sales_order_number ?? newProject.id,
    };
  }

  // ---- Non-draft project flow ----

  // Validate delivery address for non-draft projects
  if (!data.delivery_street?.trim() || !data.delivery_city?.trim() || !data.delivery_state?.trim() || !data.delivery_zip?.trim()) {
    return { success: false, error: 'Delivery address is required to create a project' };
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
      sales_order_number: data.sales_order_number ?? undefined,
      sales_order_url: data.sales_order_url,
      po_number: data.po_number,
      sales_amount: data.sales_amount,
      contract_type: data.contract_type,
      goal_completion_date: data.goal_completion_date,
      start_date: data.start_date || undefined,
      end_date: data.end_date || undefined,
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
      delivery_street: data.delivery_street || null,
      delivery_city: data.delivery_city || null,
      delivery_state: data.delivery_state || null,
      delivery_zip: data.delivery_zip || null,
      delivery_country: data.delivery_country || 'US',
      // Odoo integration
      ...(data.odoo_order_id != null && { odoo_order_id: data.odoo_order_id }),
      ...(data.odoo_invoice_status != null && { odoo_invoice_status: data.odoo_invoice_status }),
      ...(data.project_description != null && { project_description: data.project_description }),
      ...(data.odoo_order_id != null && { odoo_last_synced_at: new Date().toISOString() }),
      // Parent-child (child projects skip client_token via DB trigger, skip SharePoint below)
      ...(data.parent_project_id != null && { parent_project_id: data.parent_project_id }),
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
  // Skip for child projects — they use the parent's SharePoint folder
  if (data.sales_order_number && !data.parent_project_id) {
    (async () => {
      try {
        // Check if global SharePoint is configured
        const globalConfig = await getGlobalSharePointConfig();
        if (!globalConfig) {
          console.log('[createProject] SharePoint not configured, skipping folder creation');
          return;
        }

        // Create the SharePoint folder
        const result = await createProjectSharePointFolder(
          {
            projectId: newProject.id,
            salesOrderNumber: data.sales_order_number!,
            clientName: data.client_name,
            userId: user.id,
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

export async function publishDraft(projectId: string, data: CreateProjectData): Promise<CreateProjectResult> {
  const supabase = await createClient();

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  // Verify project exists and is a draft
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: project } = await (supabase as any)
    .from('projects')
    .select('id, is_draft, client_name')
    .eq('id', projectId)
    .single();

  if (!project) return { success: false, error: 'Project not found' };
  if (!project.is_draft) return { success: false, error: 'Project is not a draft' };

  // Validate delivery address
  if (!data.delivery_street?.trim() || !data.delivery_city?.trim() || !data.delivery_state?.trim() || !data.delivery_zip?.trim()) {
    return { success: false, error: 'Delivery address is required to publish a project' };
  }

  // Check sales order uniqueness
  if (data.sales_order_number && data.sales_order_number.trim()) {
    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('sales_order_number', data.sales_order_number.trim())
      .neq('id', projectId)
      .maybeSingle();
    if (existing) {
      return { success: false, error: `Sales Order # ${data.sales_order_number} is already in use` };
    }
  }

  // Get first status for project type
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

  // Update project: publish it
  const { data: updatedProject, error: updateError } = await supabase
    .from('projects')
    .update({
      is_draft: false,
      client_name: data.client_name,
      sales_order_number: data.sales_order_number ?? undefined,
      sales_order_url: data.sales_order_url,
      po_number: data.po_number,
      sales_amount: data.sales_amount,
      contract_type: data.contract_type,
      goal_completion_date: data.goal_completion_date,
      start_date: data.start_date || undefined,
      end_date: data.end_date || undefined,
      salesperson_id: data.salesperson_id,
      poc_name: data.poc_name,
      poc_email: data.poc_email,
      poc_phone: data.poc_phone,
      secondary_poc_email: data.secondary_poc_email,
      scope_link: data.scope_link,
      number_of_vidpods: data.number_of_vidpods ?? null,
      project_type_id: data.project_type_id,
      current_status_id: firstStatus.id,
      email_notifications_enabled: data.email_notifications_enabled ?? true,
      delivery_street: data.delivery_street,
      delivery_city: data.delivery_city,
      delivery_state: data.delivery_state,
      delivery_zip: data.delivery_zip,
      delivery_country: data.delivery_country || 'US',
    })
    .eq('id', projectId)
    .select()
    .single();

  if (updateError) {
    console.error('Publish draft error:', updateError);
    return { success: false, error: 'Failed to publish project' };
  }

  // Create status history + audit log
  try {
    await Promise.all([
      supabase.from('status_history').insert({
        project_id: projectId,
        status_id: firstStatus.id,
        changed_by: user.id,
      }),
      supabase.from('audit_logs').insert({
        project_id: projectId,
        user_id: user.id,
        action: 'update',
        field_name: 'is_draft',
        old_value: 'true',
        new_value: 'false',
      }),
    ]);
  } catch (err) {
    console.error('Background tasks error:', err);
  }

  // Handle tags
  if (data.tags?.length > 0) {
    try {
      // Remove existing tags first
      await supabase.from('project_tags').delete().eq('project_id', projectId);
      await supabase.from('project_tags').insert(
        data.tags.map(tagId => ({ project_id: projectId, tag_id: tagId }))
      );
    } catch (err) {
      console.error('Tags update error:', err);
    }
  }

  // Auto-create SharePoint folder (background)
  if (data.sales_order_number) {
    (async () => {
      try {
        const globalConfig = await getGlobalSharePointConfig();
        if (!globalConfig) return;
        const result = await createProjectSharePointFolder(
          {
            projectId,
            salesOrderNumber: data.sales_order_number!,
            clientName: data.client_name,
            userId: user.id,
            globalConfig,
          },
          supabase
        );
        if (result.success) {
          console.log(`[publishDraft] SharePoint folder created: ${data.sales_order_number}`);
        }
      } catch (error) {
        console.error('[publishDraft] SharePoint folder creation error:', error);
      }
    })();
  }

  revalidatePath('/projects');

  return {
    success: true,
    projectId: updatedProject.id,
    salesOrderNumber: updatedProject.sales_order_number ?? updatedProject.id,
    clientToken: updatedProject.client_token ?? undefined,
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

  // Validate schedule status value (3-status workflow: draft, pending, confirmed)
  const validStatuses = ['draft', 'pending', 'confirmed'];
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
    created_date: 'created_date',
    invoiced_date: 'invoiced_date',
    // Odoo integration
    project_description: 'project_description',
    odoo_invoice_status: 'odoo_invoice_status',
    odoo_last_synced_at: 'odoo_last_synced_at',
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
    .select('sales_order_number, goal_completion_date, sales_amount, salesperson_id, start_date, end_date, sales_order_url, created_at, created_date, invoiced_date, project_description, odoo_invoice_status, odoo_last_synced_at')
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

// ============================================
// Odoo Invoice Status Refresh
// ============================================

export interface RefreshInvoiceStatusResult {
  success: boolean;
  invoiceStatus?: string;
  syncedAt?: string;
  error?: string;
}

export async function refreshOdooInvoiceStatus(projectId: string): Promise<RefreshInvoiceStatusResult> {
  const supabase = await createClient();

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  // Get project's Odoo order ID
  const { data: project } = await supabase
    .from('projects')
    .select('odoo_order_id, odoo_invoice_status, sales_order_number')
    .eq('id', projectId)
    .single();

  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  if (!project.odoo_order_id) {
    return { success: false, error: 'No Odoo order linked to this project' };
  }

  // Use the Odoo client directly (server action has direct access)
  const { isOdooConfigured, getOdooClient } = await import('@/lib/odoo');
  const { getInvoiceStatus } = await import('@/lib/odoo/queries');

  if (!isOdooConfigured()) {
    return { success: false, error: 'Odoo is not configured' };
  }

  try {
    const client = getOdooClient();
    const invoiceStatus = await getInvoiceStatus(client, project.odoo_order_id);

    if (!invoiceStatus) {
      return { success: false, error: 'Order not found in Odoo' };
    }

    const syncedAt = new Date().toISOString();
    const oldStatus = project.odoo_invoice_status;

    // Update project with new invoice status
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        odoo_invoice_status: invoiceStatus,
        odoo_last_synced_at: syncedAt,
      })
      .eq('id', projectId);

    if (updateError) {
      return { success: false, error: 'Failed to update invoice status' };
    }

    // Audit log if status changed
    if (oldStatus !== invoiceStatus) {
      try {
        await supabase.from('audit_logs').insert({
          project_id: projectId,
          user_id: user.id,
          action: 'update',
          field_name: 'odoo_invoice_status',
          old_value: oldStatus || '',
          new_value: invoiceStatus,
        });
      } catch (err) {
        console.error('Audit log error:', err);
      }
    }

    // Revalidate
    if (project.sales_order_number) {
      revalidatePath(`/projects/${project.sales_order_number}`);
    }
    revalidatePath('/projects');

    return { success: true, invoiceStatus, syncedAt };
  } catch (error) {
    console.error('Odoo invoice status refresh error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to refresh invoice status',
    };
  }
}

export async function getProjectBasicInfo(salesOrder: string): Promise<{
  success: boolean;
  data?: {
    id: string;
    client_name: string;
    sales_order_number: string | null;
    sales_order_url: string | null;
    sales_amount: number | null;
  };
  error?: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .select('id, client_name, sales_order_number, sales_order_url, sales_amount')
    .eq('sales_order_number', salesOrder)
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as { id: string; client_name: string; sales_order_number: string | null; sales_order_url: string | null; sales_amount: number | null } };
}

// ==========================================
// Sub-project (parent-child) actions
// ==========================================

export async function linkSubProject(
  parentId: string,
  childId: string
): Promise<{ success: boolean; error?: string; fileMigrationWarning?: string }> {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  // Validate parent exists and is not itself a child
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: parent } = await (supabase as any)
    .from('projects')
    .select('id, parent_project_id, client_name, sales_order_number')
    .eq('id', parentId)
    .single();

  if (!parent) return { success: false, error: 'Parent project not found' };
  if (parent.parent_project_id) {
    return { success: false, error: 'Cannot add sub-projects to a project that is itself a sub-project' };
  }

  // Validate child exists, is not a parent, and is not already linked
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: child } = await (supabase as any)
    .from('projects')
    .select('id, parent_project_id, client_name, sales_order_number')
    .eq('id', childId)
    .single();

  if (!child) return { success: false, error: 'Child project not found' };
  if (child.parent_project_id) {
    return { success: false, error: 'This project is already a sub-project of another project' };
  }
  if (childId === parentId) {
    return { success: false, error: 'A project cannot be its own sub-project' };
  }

  // Check if child has its own children (would violate depth constraint)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase as any)
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('parent_project_id', childId);

  if (count && count > 0) {
    return { success: false, error: 'Cannot link a project that has its own sub-projects' };
  }

  // Link the child to the parent (DB trigger will clear client_token)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from('projects')
    .update({ parent_project_id: parentId })
    .eq('id', childId);

  if (updateError) {
    console.error('Link sub-project error:', updateError);
    return { success: false, error: updateError.message };
  }

  // Migrate child's existing files to parent's SharePoint folder
  let fileMigrationWarning: string | undefined;
  try {
    const migrationResult = await migrateChildFilesToParent(childId, parentId);
    if (!migrationResult.success) {
      fileMigrationWarning = `Project linked, but some files could not be moved to the parent folder: ${migrationResult.error}`;
    } else if (migrationResult.movedCount > 0) {
      console.log(`[linkSubProject] Migrated ${migrationResult.movedCount} files from child ${childId} to parent ${parentId}`);
    }
  } catch (err) {
    console.error('[linkSubProject] File migration failed:', err);
    fileMigrationWarning = 'Project linked, but files could not be moved to the parent folder. You may need to move them manually in SharePoint.';
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    project_id: childId,
    user_id: user.id,
    action: 'update',
    field_name: 'parent_project_id',
    old_value: null,
    new_value: `${parent.client_name} (${parent.sales_order_number || parent.id})`,
  });

  revalidatePath('/projects');
  if (parent.sales_order_number) revalidatePath(`/projects/${parent.sales_order_number}`);
  if (child.sales_order_number) revalidatePath(`/projects/${child.sales_order_number}`);

  return { success: true, fileMigrationWarning };
}

export async function unlinkSubProject(
  childId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  // Verify child has a parent
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: child } = await (supabase as any)
    .from('projects')
    .select('id, parent_project_id, client_name, sales_order_number')
    .eq('id', childId)
    .single();

  if (!child) return { success: false, error: 'Project not found' };
  if (!child.parent_project_id) {
    return { success: false, error: 'This project is not a sub-project' };
  }

  const parentId = child.parent_project_id;

  // Get parent info for audit log
  const { data: parent } = await supabase
    .from('projects')
    .select('sales_order_number, client_name')
    .eq('id', parentId)
    .single();

  // Unlink and regenerate client_token
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from('projects')
    .update({
      parent_project_id: null,
      client_token: crypto.randomUUID(),
    })
    .eq('id', childId);

  if (updateError) {
    console.error('Unlink sub-project error:', updateError);
    return { success: false, error: updateError.message };
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    project_id: childId,
    user_id: user.id,
    action: 'update',
    field_name: 'parent_project_id',
    old_value: parent ? `${parent.client_name} (${parent.sales_order_number || parentId})` : parentId,
    new_value: null,
  });

  revalidatePath('/projects');
  if (parent?.sales_order_number) revalidatePath(`/projects/${parent.sales_order_number}`);
  if (child.sales_order_number) revalidatePath(`/projects/${child.sales_order_number}`);

  return { success: true };
}

export async function getSubProjects(parentId: string) {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('projects')
    .select(`
      id,
      client_name,
      sales_order_number,
      po_number,
      sales_amount,
      odoo_invoice_status,
      schedule_status,
      start_date,
      end_date,
      created_date,
      current_status:statuses(id, name, color)
    `)
    .eq('parent_project_id', parentId)
    .order('created_date', { ascending: true });

  if (error) {
    console.error('Get sub-projects error:', error);
    return [];
  }

  return (data || []) as Array<{
    id: string;
    client_name: string;
    sales_order_number: string | null;
    po_number: string | null;
    sales_amount: number | null;
    odoo_invoice_status: string | null;
    schedule_status: string | null;
    start_date: string | null;
    end_date: string | null;
    created_date: string;
    current_status: { id: string; name: string; color: string | null } | null;
  }>;
}

export async function searchProjectsForLinking(
  query: string,
  excludeProjectId: string
): Promise<{ id: string; client_name: string; sales_order_number: string | null; sales_amount: number | null }[]> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('projects')
    .select('id, client_name, sales_order_number, sales_amount, parent_project_id')
    .is('parent_project_id', null)
    .neq('id', excludeProjectId)
    .or(`client_name.ilike.%${query}%,sales_order_number.ilike.%${query}%`)
    .limit(10);

  if (!data) return [];

  // Filter out projects that already have children (they'd become grandparents)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projectIds = data.map((p: any) => p.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: childCounts } = await (supabase as any)
    .from('projects')
    .select('parent_project_id')
    .in('parent_project_id', projectIds);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parentIds = new Set((childCounts || []).map((c: any) => c.parent_project_id));

  return data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((p: any) => !parentIds.has(p.id))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map(({ parent_project_id: _unused, ...rest }: any) => rest);
}
