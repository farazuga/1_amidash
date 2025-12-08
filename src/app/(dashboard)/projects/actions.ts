'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface CreateProjectData {
  client_name: string;
  sales_order_number: string | null;
  sales_order_url: string | null;
  po_number: string | null;
  sales_amount: number | null;
  contract_type: string;
  goal_completion_date: string | null;
  salesperson_id: string;
  poc_name: string | null;
  poc_email: string | null;
  poc_phone: string | null;
  scope_link: string | null;
  project_type_id: string;
  tags: string[];
  email_notifications_enabled?: boolean;
}

export interface CreateProjectResult {
  success: boolean;
  projectId?: string;
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
      salesperson_id: data.salesperson_id,
      poc_name: data.poc_name,
      poc_email: data.poc_email,
      poc_phone: data.poc_phone,
      scope_link: data.scope_link,
      project_type_id: data.project_type_id,
      current_status_id: firstStatus.id,
      created_by: user.id,
      email_notifications_enabled: data.email_notifications_enabled ?? true,
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

  revalidatePath('/projects');

  return {
    success: true,
    projectId: newProject.id,
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

  revalidatePath(`/projects/${data.projectId}`);
  revalidatePath('/projects');

  return { success: true };
}
