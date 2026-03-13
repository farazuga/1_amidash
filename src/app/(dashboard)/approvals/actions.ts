'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { sendEmail, getPortalUrl } from '@/lib/email/send';
import { fileApprovedEmail, fileRejectedEmail } from '@/lib/email/templates';
import { getEmailStyleForProject } from '@/app/(dashboard)/admin/portal-builder/email-actions';
import { getApprovalUserId } from '@/app/(dashboard)/admin/settings/approval-actions';
import type { CustomerApprovalTask } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any;

export async function checkApprovalAccess(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'admin') return true;

  // Check if user is the designated approval user
  const approvalUserId = await getApprovalUserId();
  return approvalUserId === user.id;
}

export async function getApprovalTasks(
  filter: 'pending' | 'approved' | 'rejected' | 'all'
): Promise<CustomerApprovalTask[]> {
  const supabase = await createClient();

  let query = (supabase as AnySupabaseClient)
    .from('customer_approval_tasks')
    .select(`
      *,
      file_upload:portal_file_uploads(*),
      assigned_to_profile:profiles!customer_approval_tasks_assigned_to_fkey(*)
    `)
    .order('created_at', { ascending: false });

  if (filter !== 'all') {
    query = query.eq('status', filter);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Now get project info for each task via file_upload.project_id
  const tasks = (data || []) as CustomerApprovalTask[];
  if (tasks.length === 0) return tasks;

  const projectIds = [...new Set(tasks.map(t => t.file_upload?.project_id).filter((id): id is string => !!id))];
  if (projectIds.length > 0) {
    const { data: projects } = await supabase
      .from('projects')
      .select('id, client_name, sales_order_number, client_token, poc_email, poc_name, project_type_id')
      .in('id', projectIds);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projectMap = new Map((projects || []).map((p: any) => [p.id, p]));
    for (const task of tasks) {
      if (task.file_upload?.project_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        task.project = projectMap.get(task.file_upload.project_id) as any;
      }
    }
  }

  return tasks;
}

export async function getPendingApprovalCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await (supabase as AnySupabaseClient)
    .from('customer_approval_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (error) return 0;
  return count || 0;
}

export async function approveFile(taskId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Get the task with file upload and project
  const { data: task, error: taskError } = await (supabase as AnySupabaseClient)
    .from('customer_approval_tasks')
    .select('*, file_upload:portal_file_uploads(*)')
    .eq('id', taskId)
    .single();

  if (taskError || !task) return { success: false, error: 'Task not found' };

  const now = new Date().toISOString();

  // Update approval task
  const { error: updateError } = await (supabase as AnySupabaseClient)
    .from('customer_approval_tasks')
    .update({ status: 'approved', completed_at: now })
    .eq('id', taskId);

  if (updateError) return { success: false, error: updateError.message };

  // Update file upload status
  await (supabase as AnySupabaseClient)
    .from('portal_file_uploads')
    .update({
      upload_status: 'approved',
      reviewed_by: user.id,
      reviewed_at: now,
    })
    .eq('id', task.file_upload_id);

  // Send approval email to customer
  try {
    const { data: project } = await supabase
      .from('projects')
      .select('client_name, client_token, poc_email, project_type_id, id')
      .eq('id', task.file_upload.project_id)
      .single();

    if (project?.poc_email && project?.client_token) {
      const styleOverrides = await getEmailStyleForProject(project.id);
      const html = fileApprovedEmail({
        clientName: project.client_name,
        fileName: task.file_upload.original_filename || 'Uploaded file',
        portalUrl: getPortalUrl(project.client_token),
        styleOverrides: styleOverrides || undefined,
      });

      await sendEmail({
        to: project.poc_email,
        subject: 'Your file has been approved - Amitrace',
        html,
      });
    }
  } catch (err) {
    console.error('Failed to send approval email:', err);
    // Don't fail the approval itself if email fails
  }

  revalidatePath('/approvals');
  return { success: true };
}

export async function rejectFile(
  taskId: string,
  note: string
): Promise<{ success: boolean; error?: string }> {
  if (!note?.trim()) return { success: false, error: 'Rejection note is required' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Get the task with file upload
  const { data: task, error: taskError } = await (supabase as AnySupabaseClient)
    .from('customer_approval_tasks')
    .select('*, file_upload:portal_file_uploads(*)')
    .eq('id', taskId)
    .single();

  if (taskError || !task) return { success: false, error: 'Task not found' };

  const now = new Date().toISOString();

  // Update approval task
  const { error: updateError } = await (supabase as AnySupabaseClient)
    .from('customer_approval_tasks')
    .update({ status: 'rejected', note: note.trim(), completed_at: now })
    .eq('id', taskId);

  if (updateError) return { success: false, error: updateError.message };

  // Update file upload status
  await (supabase as AnySupabaseClient)
    .from('portal_file_uploads')
    .update({
      upload_status: 'rejected',
      rejection_note: note.trim(),
      reviewed_by: user.id,
      reviewed_at: now,
    })
    .eq('id', task.file_upload_id);

  // Send rejection email to customer
  try {
    const { data: project } = await supabase
      .from('projects')
      .select('client_name, client_token, poc_email, id')
      .eq('id', task.file_upload.project_id)
      .single();

    if (project?.poc_email && project?.client_token) {
      const styleOverrides = await getEmailStyleForProject(project.id);
      const html = fileRejectedEmail({
        clientName: project.client_name,
        fileName: task.file_upload.original_filename || 'Uploaded file',
        rejectionNote: note.trim(),
        portalUrl: getPortalUrl(project.client_token),
        styleOverrides: styleOverrides || undefined,
      });

      await sendEmail({
        to: project.poc_email,
        subject: 'File requires changes - Amitrace',
        html,
      });
    }
  } catch (err) {
    console.error('Failed to send rejection email:', err);
  }

  revalidatePath('/approvals');
  return { success: true };
}
