'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { sendEmail } from '@/lib/email/send';
import { checkEmailEnabled } from '@/lib/email/settings';
import { confirmationEmailTemplate, pmConfirmationResponseEmailTemplate } from '@/lib/email/templates';
import {
  createConfirmationRequestSchema,
  confirmationResponseSchema,
} from '@/lib/validation';
import type {
  ConfirmationPageData,
  ConfirmationScheduleItem,
  CreateConfirmationRequestData,
  ConfirmationResponseData,
  BookingStatus,
} from '@/types/calendar';

// Generic action result type
interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// Rate Limiting for Public Confirmation Endpoints
// ============================================
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 5; // Stricter limit for sensitive endpoint (5 per minute)
const WINDOW_MS = 60 * 1000; // 1 minute window

// Clean up old entries periodically to prevent memory leaks
function cleanupRateLimitMap() {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}

function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  // Periodic cleanup (run when map exceeds threshold)
  if (rateLimitMap.size > 1000) {
    cleanupRateLimitMap();
  }

  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }

  if (record.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT - record.count };
}

// Get client IP for rate limiting
async function getClientIp(): Promise<string> {
  const headersList = await headers();
  return headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         headersList.get('x-real-ip') ||
         'unknown';
}

// Type for assignment query result (used before types are regenerated)
interface AssignmentWithDays {
  id: string;
  booking_status: string;
  user?: { id: string; full_name: string | null; email: string };
  assignment_days?: Array<{
    work_date: string;
    start_time: string;
    end_time: string;
  }>;
}

/**
 * Create a confirmation request and send email to customer
 * Called by PM when ready to send schedule to customer for confirmation
 */
export async function createConfirmationRequest(
  params: CreateConfirmationRequestData
): Promise<ActionResult<{ id: string; token: string }>> {
  try {
    // Validate input
    const validated = createConfirmationRequestSchema.safeParse(params);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0].message };
    }

    const supabase = await createClient();

    // Check user is admin/editor
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.role || !['admin', 'editor'].includes(profile.role)) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Get project details
    const { data: project } = await supabase
      .from('projects')
      .select('id, client_name, poc_name, poc_email')
      .eq('id', params.projectId)
      .single();

    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    // Get assignments with days and user info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: assignments } = await (supabase as any)
      .from('project_assignments')
      .select(`
        id,
        booking_status,
        user:profiles!project_assignments_user_id_fkey(id, full_name, email),
        assignment_days(work_date, start_time, end_time)
      `)
      .in('id', params.assignmentIds);

    if (!assignments?.length) {
      return { success: false, error: 'No assignments found' };
    }

    const typedAssignments = assignments as AssignmentWithDays[];

    // Check all assignments are in tentative status
    const nonTentative = typedAssignments.filter(a => a.booking_status !== 'tentative');
    if (nonTentative.length > 0) {
      return {
        success: false,
        error: 'All assignments must be in tentative status to send for confirmation',
      };
    }

    // Create confirmation request
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: request, error: createError } = await (supabase as any)
      .from('confirmation_requests')
      .insert({
        project_id: params.projectId,
        sent_to_email: params.sendToEmail,
        sent_to_name: params.sendToName,
        created_by: user.id,
      })
      .select()
      .single();

    if (createError) {
      return { success: false, error: createError.message };
    }

    // Link assignments to request
    const assignmentLinks = params.assignmentIds.map(assignmentId => ({
      confirmation_request_id: request.id,
      assignment_id: assignmentId,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: linkError } = await (supabase as any)
      .from('confirmation_request_assignments')
      .insert(assignmentLinks);

    if (linkError) {
      // Cleanup the request if linking failed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('confirmation_requests').delete().eq('id', request.id);
      return { success: false, error: linkError.message };
    }

    // Update assignment statuses to pending_confirm
    const { error: updateError } = await supabase
      .from('project_assignments')
      .update({ booking_status: 'pending_confirm' as BookingStatus })
      .in('id', params.assignmentIds);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Record status change in history
    for (const assignment of typedAssignments) {
      await supabase.from('booking_status_history').insert({
        assignment_id: assignment.id,
        old_status: 'tentative',
        new_status: 'pending_confirm',
        changed_by: user.id,
        note: `Sent confirmation request to ${params.sendToEmail}`,
      });
    }

    // Build schedule for email
    const scheduleItems: Array<{
      engineerName: string;
      days: Array<{ date: string; startTime: string; endTime: string }>;
    }> = typedAssignments.map(a => ({
      engineerName: a.user?.full_name || 'Unknown',
      days: (a.assignment_days || []).map(d => ({
        date: d.work_date,
        startTime: d.start_time,
        endTime: d.end_time,
      })),
    }));

    // Check if emails are enabled before sending
    const emailSettings = await checkEmailEnabled(params.projectId, params.sendToEmail);

    if (emailSettings.canSendEmail) {
      // Send confirmation email
      const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL}/confirm/${request.token}`;

      const emailHtml = confirmationEmailTemplate({
        customerName: params.sendToName || project.poc_name || 'Customer',
        projectName: project.client_name,
        assignments: scheduleItems,
        confirmUrl,
        expiresAt: request.expires_at,
      });

      const emailResult = await sendEmail({
        to: params.sendToEmail,
        subject: `Please confirm your project dates - ${project.client_name}`,
        html: emailHtml,
      });

      if (!emailResult.success) {
        console.error('Failed to send confirmation email:', emailResult.error);
        // Don't fail the whole operation - request was created
      }
    } else {
      console.log('Skipping confirmation email - emails disabled:', {
        global: emailSettings.globalEnabled,
        project: emailSettings.projectEnabled,
        recipient: emailSettings.recipientEnabled,
      });
    }

    revalidatePath('/calendar');

    return {
      success: true,
      data: { id: request.id, token: request.token },
    };
  } catch (error) {
    console.error('createConfirmationRequest error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle customer confirmation response (public - uses service client)
 * Called from the customer confirmation page
 */
export async function handleConfirmationResponse(
  params: ConfirmationResponseData
): Promise<ActionResult<void>> {
  try {
    // Rate limit by IP + token combination to prevent brute force attacks
    const clientIp = await getClientIp();
    const rateLimitKey = `confirm:${clientIp}:${params.token}`;
    const { allowed } = checkRateLimit(rateLimitKey);
    if (!allowed) {
      return { success: false, error: 'Too many attempts. Please try again in a minute.' };
    }

    // Validate input
    const validated = confirmationResponseSchema.safeParse(params);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0].message };
    }

    // Use service client since this is a public action
    const supabase = await createServiceClient();

    // Get confirmation request with project and creator info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: request, error: fetchError } = await (supabase as any)
      .from('confirmation_requests')
      .select(`
        *,
        project:projects(id, client_name, poc_name),
        created_by_profile:profiles!confirmation_requests_created_by_fkey(email, full_name)
      `)
      .eq('token', params.token)
      .single();

    if (fetchError || !request) {
      return { success: false, error: 'Invalid or expired link' };
    }

    // Check if already responded
    if (request.status !== 'pending') {
      return { success: false, error: 'This request has already been responded to' };
    }

    // Check if expired
    if (new Date(request.expires_at) < new Date()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('confirmation_requests')
        .update({ status: 'expired' })
        .eq('id', request.id);
      return { success: false, error: 'This confirmation link has expired' };
    }

    const newStatus = params.action === 'confirm' ? 'confirmed' : 'declined';
    const newBookingStatus: BookingStatus = params.action === 'confirm' ? 'confirmed' : 'tentative';

    // Update confirmation request
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateRequestError } = await (supabase as any)
      .from('confirmation_requests')
      .update({
        status: newStatus,
        responded_at: new Date().toISOString(),
        decline_reason: params.declineReason || null,
      })
      .eq('id', request.id);

    if (updateRequestError) {
      return { success: false, error: updateRequestError.message };
    }

    // Get linked assignments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: linkedAssignments } = await (supabase as any)
      .from('confirmation_request_assignments')
      .select('assignment_id')
      .eq('confirmation_request_id', request.id);

    const assignmentIds = linkedAssignments?.map((la: { assignment_id: string }) => la.assignment_id) || [];

    if (assignmentIds.length > 0) {
      // Update assignment statuses
      await supabase
        .from('project_assignments')
        .update({ booking_status: newBookingStatus })
        .in('id', assignmentIds);

      // Record status changes in history
      for (const assignmentId of assignmentIds) {
        await supabase.from('booking_status_history').insert({
          assignment_id: assignmentId,
          old_status: 'pending_confirm',
          new_status: newBookingStatus,
          note: params.action === 'confirm'
            ? 'Customer confirmed via portal'
            : `Customer declined: ${params.declineReason || 'No reason provided'}`,
        });
      }
    }

    // Send notification email to PM who created the request
    if (request.created_by_profile?.email) {
      const notificationHtml = pmConfirmationResponseEmailTemplate({
        pmName: request.created_by_profile.full_name || 'PM',
        projectName: request.project?.client_name || 'Unknown Project',
        customerName: request.sent_to_name || request.sent_to_email,
        action: params.action,
        declineReason: params.declineReason,
      });

      await sendEmail({
        to: request.created_by_profile.email,
        subject: `Customer ${params.action === 'confirm' ? 'confirmed' : 'declined'} - ${request.project?.client_name}`,
        html: notificationHtml,
      });
    }

    return { success: true };
  } catch (error) {
    console.error('handleConfirmationResponse error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get confirmation request details by token (for public page)
 * Used to display the confirmation page to customers
 */
export async function getConfirmationRequestByToken(
  token: string
): Promise<ActionResult<ConfirmationPageData>> {
  try {
    if (!token) {
      return { success: false, error: 'Token required' };
    }

    // Rate limit by IP to prevent token enumeration
    const clientIp = await getClientIp();
    const rateLimitKey = `confirm-view:${clientIp}`;
    const { allowed } = checkRateLimit(rateLimitKey);
    if (!allowed) {
      return { success: false, error: 'Too many requests. Please try again in a minute.' };
    }

    // Use service client for public access
    const supabase = createServiceClient();

    // Get confirmation request with project info
    const { data: request, error: fetchError } = await (supabase as any)
      .from('confirmation_requests')
      .select(`
        *,
        project:projects(id, client_name, poc_name)
      `)
      .eq('token', token)
      .single();

    if (fetchError || !request) {
      return { success: false, error: 'Invalid confirmation link' };
    }

    // Get linked assignments with user and day info
    const { data: linkedAssignments } = await (supabase as any)
      .from('confirmation_request_assignments')
      .select(`
        assignment:project_assignments(
          id,
          user:profiles!project_assignments_user_id_fkey(full_name),
          assignment_days(work_date, start_time, end_time)
        )
      `)
      .eq('confirmation_request_id', request.id);

    // Group by date with engineers
    const dateMap = new Map<string, ConfirmationScheduleItem>();

    for (const la of linkedAssignments || []) {
      const assignment = la.assignment;
      if (!assignment) continue;

      for (const day of assignment.assignment_days || []) {
        const key = `${day.work_date}-${day.start_time}-${day.end_time}`;
        if (!dateMap.has(key)) {
          dateMap.set(key, {
            date: day.work_date,
            start_time: day.start_time,
            end_time: day.end_time,
            engineers: [],
          });
        }
        const engineerName = assignment.user?.full_name || 'Unknown';
        if (!dateMap.get(key)!.engineers.includes(engineerName)) {
          dateMap.get(key)!.engineers.push(engineerName);
        }
      }
    }

    const dates = Array.from(dateMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)
    );

    const isExpired = new Date(request.expires_at) < new Date();
    const isResponded = request.status !== 'pending';

    return {
      success: true,
      data: {
        project_name: request.project?.client_name || 'Unknown Project',
        customer_name: request.sent_to_name || request.project?.poc_name || 'Customer',
        dates,
        is_expired: isExpired,
        is_responded: isResponded,
        previous_response: isResponded && request.status !== 'expired'
          ? (request.status as 'confirmed' | 'declined')
          : undefined,
      },
    };
  } catch (error) {
    console.error('getConfirmationRequestByToken error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get pending confirmation requests for PM dashboard
 */
export async function getPendingConfirmations(): Promise<
  ActionResult<Array<{
    id: string;
    project_id: string;
    project_name: string;
    sent_to_email: string;
    sent_to_name: string | null;
    sent_at: string;
    expires_at: string;
    is_expired: boolean;
    assignment_count: number;
  }>>
> {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await (supabase as any)
      .from('confirmation_requests')
      .select(`
        id,
        project_id,
        project:projects(client_name),
        sent_to_email,
        sent_to_name,
        sent_at,
        expires_at
      `)
      .eq('status', 'pending')
      .order('expires_at', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    // Get assignment counts
    interface ConfirmationRequestRow {
      id: string;
      project_id: string;
      project?: { client_name: string };
      sent_to_email: string;
      sent_to_name: string;
      sent_at: string;
      expires_at: string;
    }
    const result = await Promise.all(
      ((data || []) as ConfirmationRequestRow[]).map(async (req) => {
        const { count } = await (supabase as any)
          .from('confirmation_request_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('confirmation_request_id', req.id);

        return {
          id: req.id,
          project_id: req.project_id,
          project_name: req.project?.client_name || 'Unknown',
          sent_to_email: req.sent_to_email,
          sent_to_name: req.sent_to_name,
          sent_at: req.sent_at,
          expires_at: req.expires_at,
          is_expired: new Date(req.expires_at) < new Date(),
          assignment_count: count || 0,
        };
      })
    );

    return { success: true, data: result };
  } catch (error) {
    console.error('getPendingConfirmations error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Resend confirmation email for an existing request
 */
export async function resendConfirmationEmail(
  requestId: string
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient();

    // Check user permissions
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.role || !['admin', 'editor'].includes(profile.role)) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Get the request
    const { data: request } = await (supabase as any)
      .from('confirmation_requests')
      .select(`
        *,
        project:projects(client_name, poc_name)
      `)
      .eq('id', requestId)
      .single();

    if (!request) {
      return { success: false, error: 'Confirmation request not found' };
    }

    if (request.status !== 'pending') {
      return { success: false, error: 'Cannot resend - request already responded to' };
    }

    // Get assignments for the email
    const { data: linkedAssignments } = await (supabase as any)
      .from('confirmation_request_assignments')
      .select(`
        assignment:project_assignments(
          user:profiles!project_assignments_user_id_fkey(full_name),
          assignment_days(work_date, start_time, end_time)
        )
      `)
      .eq('confirmation_request_id', request.id);

    interface LinkedAssignmentItem {
      assignment?: {
        user?: { full_name: string | null };
        assignment_days?: Array<{ work_date: string; start_time: string; end_time: string }>;
      };
    }
    const scheduleItems = ((linkedAssignments || []) as LinkedAssignmentItem[]).map((la) => ({
      engineerName: la.assignment?.user?.full_name || 'Unknown',
      days: (la.assignment?.assignment_days || []).map((d) => ({
        date: d.work_date,
        startTime: d.start_time,
        endTime: d.end_time,
      })),
    }));

    // Check if emails are enabled before sending
    const emailSettings = await checkEmailEnabled(request.project_id, request.sent_to_email);

    if (!emailSettings.canSendEmail) {
      let reason = 'Email notifications disabled';
      if (!emailSettings.globalEnabled) {
        reason = 'Client emails are disabled globally';
      } else if (!emailSettings.projectEnabled) {
        reason = 'Email notifications disabled for this project';
      } else if (!emailSettings.recipientEnabled) {
        reason = 'Recipient has opted out of email notifications';
      }
      return { success: false, error: reason };
    }

    // Send email
    const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL}/confirm/${request.token}`;

    const emailHtml = confirmationEmailTemplate({
      customerName: request.sent_to_name || request.project?.poc_name || 'Customer',
      projectName: request.project?.client_name || 'Unknown',
      assignments: scheduleItems,
      confirmUrl,
      expiresAt: request.expires_at,
    });

    const emailResult = await sendEmail({
      to: request.sent_to_email,
      subject: `Reminder: Please confirm your project dates - ${request.project?.client_name}`,
      html: emailHtml,
    });

    if (!emailResult.success) {
      return { success: false, error: 'Failed to send email' };
    }

    return { success: true };
  } catch (error) {
    console.error('resendConfirmationEmail error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Cancel a pending confirmation request
 */
export async function cancelConfirmationRequest(
  requestId: string
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient();

    // Check user permissions
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.role || !['admin', 'editor'].includes(profile.role)) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Get the request
    const { data: request } = await (supabase as any)
      .from('confirmation_requests')
      .select('id, status')
      .eq('id', requestId)
      .single();

    if (!request) {
      return { success: false, error: 'Confirmation request not found' };
    }

    if (request.status !== 'pending') {
      return { success: false, error: 'Cannot cancel - request already responded to' };
    }

    // Get linked assignments to revert their status
    const { data: linkedAssignments } = await (supabase as any)
      .from('confirmation_request_assignments')
      .select('assignment_id')
      .eq('confirmation_request_id', request.id);

    const assignmentIds = linkedAssignments?.map((la: { assignment_id: string }) => la.assignment_id) || [];

    // Revert assignments to tentative
    if (assignmentIds.length > 0) {
      await supabase
        .from('project_assignments')
        .update({ booking_status: 'tentative' as BookingStatus })
        .in('id', assignmentIds);

      // Record status changes
      for (const assignmentId of assignmentIds) {
        await supabase.from('booking_status_history').insert({
          assignment_id: assignmentId,
          old_status: 'pending_confirm',
          new_status: 'tentative',
          changed_by: user.id,
          note: 'Confirmation request cancelled',
        });
      }
    }

    // Delete the request (cascade will delete linked assignments)
    await (supabase as any)
      .from('confirmation_requests')
      .delete()
      .eq('id', request.id);

    revalidatePath('/calendar');

    return { success: true };
  } catch (error) {
    console.error('cancelConfirmationRequest error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
