// Email template utilities for Amitrace Dashboard

/**
 * Escapes HTML special characters to prevent XSS/injection in email templates.
 * All user-controlled input should be passed through this function.
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

const BRAND_COLORS = {
  primary: '#023A2D',
  background: '#f8faf9',
  text: '#666',
  muted: '#999',
};

const LOGO_URL = 'https://dash.amitrace.com/new_logo.png';

interface BaseTemplateOptions {
  previewText?: string;
}

function baseTemplate(content: string, options: BaseTemplateOptions = {}): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${options.previewText ? `<meta name="x-apple-data-detectors" content="none">` : ''}
        <!--[if mso]>
        <style type="text/css">
          body, table, td { font-family: Arial, sans-serif !important; }
        </style>
        <![endif]-->
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${BRAND_COLORS.background};">
        ${options.previewText ? `<div style="display: none; max-height: 0; overflow: hidden;">${options.previewText}</div>` : ''}
        <div style="max-width: 600px; margin: 0 auto; padding: 20px 10px;">
          <!-- Header -->
          <div style="background-color: ${BRAND_COLORS.primary}; padding: 25px 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <!--[if mso]>
            <table role="presentation" width="100%"><tr><td style="text-align: center; padding: 10px;">
              <span style="font-size: 24px; font-weight: bold; color: white;">Amitrace</span>
            </td></tr></table>
            <![endif]-->
            <!--[if !mso]><!-->
            <img src="${LOGO_URL}" alt="Amitrace" style="height: 40px; max-width: 200px;">
            <!--<![endif]-->
          </div>

          <!-- Content -->
          <div style="background-color: white; padding: 30px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            ${content}
          </div>

          <!-- Footer -->
          <div style="text-align: center; padding: 20px 10px; color: ${BRAND_COLORS.muted}; font-size: 12px;">
            <p style="margin: 0 0 15px 0;">
              <a href="https://www.amitrace.com" style="color: ${BRAND_COLORS.primary}; text-decoration: none; margin: 0 8px;">Website</a>
              &bull;
              <a href="https://www.linkedin.com/company/amitrace" style="color: ${BRAND_COLORS.primary}; text-decoration: none; margin: 0 8px;">LinkedIn</a>
            </p>
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} Amitrace. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function button(text: string, url: string): string {
  return `
    <div style="text-align: center; margin: 30px 0;">
      <a href="${escapeHtml(url)}" style="display: inline-block; background-color: ${BRAND_COLORS.primary}; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;">
        ${escapeHtml(text)}
      </a>
    </div>
  `;
}

function statusBadge(status: string): string {
  return `
    <div style="text-align: center; margin: 30px 0;">
      <span style="display: inline-block; background-color: ${BRAND_COLORS.primary}; color: white; padding: 12px 24px; border-radius: 50px; font-size: 18px; font-weight: 600;">
        ${escapeHtml(status)}
      </span>
    </div>
  `;
}

// ============================================
// Email Templates
// ============================================

interface StatusChangeEmailOptions {
  clientName: string;
  newStatus: string;
  previousStatus?: string;
  portalUrl: string;
  note?: string;
}

export function statusChangeEmail(options: StatusChangeEmailOptions): string {
  const { clientName, newStatus, previousStatus, portalUrl, note } = options;

  // Escape all user-controlled inputs
  const safeClientName = escapeHtml(clientName);
  const safeNewStatus = escapeHtml(newStatus);
  const safePreviousStatus = previousStatus ? escapeHtml(previousStatus) : undefined;
  const safeNote = note ? escapeHtml(note) : undefined;

  const content = `
    <h1 style="color: ${BRAND_COLORS.primary}; font-size: 24px; margin: 0 0 10px 0;">
      Project Status Update
    </h1>

    <p style="color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
      Your project <strong>${safeClientName}</strong> has been updated.
    </p>

    ${safePreviousStatus ? `
      <p style="color: ${BRAND_COLORS.muted}; font-size: 14px; margin: 0 0 10px 0;">
        Previous status: ${safePreviousStatus}
      </p>
    ` : ''}

    ${statusBadge(safeNewStatus)}

    ${safeNote ? `
      <div style="background-color: #f5f5f5; border-left: 4px solid ${BRAND_COLORS.primary}; padding: 15px; margin: 20px 0; border-radius: 0 4px 4px 0;">
        <p style="color: ${BRAND_COLORS.text}; font-size: 14px; margin: 0; font-style: italic;">
          "${safeNote}"
        </p>
      </div>
    ` : ''}

    ${button('View Project Status', portalUrl)}

    <p style="color: ${BRAND_COLORS.muted}; font-size: 14px; text-align: center; margin: 30px 0 0 0;">
      Questions? Please email your project manager <a href="mailto:jason@amitrace.com" style="color: ${BRAND_COLORS.primary};">jason@amitrace.com</a>
    </p>
  `;

  return baseTemplate(content, {
    previewText: `${safeClientName} status updated to ${safeNewStatus}`,
  });
}

interface WelcomeEmailOptions {
  clientName: string;
  pocName: string;
  projectType: string;
  initialStatus: string;
  portalUrl: string;
}

// ============================================
// Calendar Assignment Email Templates
// ============================================

interface AssignmentCreatedEmailOptions {
  userName: string;
  projectName: string;
  startDate: string;
  endDate: string;
  bookingStatus: string;
  calendarUrl: string;
}

export function assignmentCreatedEmail(options: AssignmentCreatedEmailOptions): string {
  const { userName, projectName, startDate, endDate, bookingStatus, calendarUrl } = options;

  const safeUserName = escapeHtml(userName);
  const safeProjectName = escapeHtml(projectName);
  const safeStartDate = escapeHtml(startDate);
  const safeEndDate = escapeHtml(endDate);
  const safeStatus = escapeHtml(bookingStatus);

  const statusLabels: Record<string, string> = {
    pencil: 'Penciled In',
    pending_confirm: 'Pending Confirmation',
    confirmed: 'Confirmed',
  };

  const content = `
    <h1 style="color: ${BRAND_COLORS.primary}; font-size: 24px; margin: 0 0 10px 0;">
      You've Been Assigned to a Project
    </h1>

    <p style="color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
      Hi ${safeUserName},
    </p>

    <p style="color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
      You have been assigned to work on <strong>${safeProjectName}</strong>.
    </p>

    <div style="background-color: #f8faf9; border-radius: 8px; padding: 20px; margin: 25px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: ${BRAND_COLORS.muted}; font-size: 14px; padding: 8px 0;">Project:</td>
          <td style="color: ${BRAND_COLORS.text}; font-size: 14px; padding: 8px 0; text-align: right; font-weight: 600;">${safeProjectName}</td>
        </tr>
        <tr>
          <td style="color: ${BRAND_COLORS.muted}; font-size: 14px; padding: 8px 0;">Dates:</td>
          <td style="color: ${BRAND_COLORS.text}; font-size: 14px; padding: 8px 0; text-align: right; font-weight: 600;">${safeStartDate} - ${safeEndDate}</td>
        </tr>
        <tr>
          <td style="color: ${BRAND_COLORS.muted}; font-size: 14px; padding: 8px 0;">Status:</td>
          <td style="color: ${BRAND_COLORS.text}; font-size: 14px; padding: 8px 0; text-align: right; font-weight: 600;">${statusLabels[safeStatus] || safeStatus}</td>
        </tr>
      </table>
    </div>

    ${button('View My Schedule', calendarUrl)}

    <p style="color: ${BRAND_COLORS.muted}; font-size: 14px; text-align: center; margin: 30px 0 0 0;">
      Questions? Please contact your project manager.
    </p>
  `;

  return baseTemplate(content, {
    previewText: `You've been assigned to ${safeProjectName}`,
  });
}

interface AssignmentStatusChangedEmailOptions {
  userName: string;
  projectName: string;
  oldStatus: string;
  newStatus: string;
  calendarUrl: string;
}

export function assignmentStatusChangedEmail(options: AssignmentStatusChangedEmailOptions): string {
  const { userName, projectName, oldStatus, newStatus, calendarUrl } = options;

  const safeUserName = escapeHtml(userName);
  const safeProjectName = escapeHtml(projectName);

  const statusLabels: Record<string, string> = {
    pencil: 'Penciled In',
    pending_confirm: 'Pending Confirmation',
    confirmed: 'Confirmed',
  };

  const safeOldStatus = statusLabels[oldStatus] || escapeHtml(oldStatus);
  const safeNewStatus = statusLabels[newStatus] || escapeHtml(newStatus);

  const content = `
    <h1 style="color: ${BRAND_COLORS.primary}; font-size: 24px; margin: 0 0 10px 0;">
      Assignment Status Updated
    </h1>

    <p style="color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
      Hi ${safeUserName},
    </p>

    <p style="color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
      Your assignment status for <strong>${safeProjectName}</strong> has been updated.
    </p>

    <div style="background-color: #f8faf9; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
      <p style="color: ${BRAND_COLORS.muted}; font-size: 14px; margin: 0 0 10px 0;">
        ${safeOldStatus}
      </p>
      <p style="font-size: 24px; margin: 0 0 10px 0;">↓</p>
      <span style="display: inline-block; background-color: ${BRAND_COLORS.primary}; color: white; padding: 12px 24px; border-radius: 50px; font-size: 16px; font-weight: 600;">
        ${safeNewStatus}
      </span>
    </div>

    ${button('View My Schedule', calendarUrl)}

    <p style="color: ${BRAND_COLORS.muted}; font-size: 14px; text-align: center; margin: 30px 0 0 0;">
      Questions? Please contact your project manager.
    </p>
  `;

  return baseTemplate(content, {
    previewText: `${safeProjectName} status: ${safeNewStatus}`,
  });
}

interface AssignmentReminderEmailOptions {
  userName: string;
  projectName: string;
  startDate: string;
  calendarUrl: string;
}

export function assignmentReminderEmail(options: AssignmentReminderEmailOptions): string {
  const { userName, projectName, startDate, calendarUrl } = options;

  const safeUserName = escapeHtml(userName);
  const safeProjectName = escapeHtml(projectName);
  const safeStartDate = escapeHtml(startDate);

  const content = `
    <h1 style="color: ${BRAND_COLORS.primary}; font-size: 24px; margin: 0 0 10px 0;">
      Reminder: Assignment Tomorrow
    </h1>

    <p style="color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
      Hi ${safeUserName},
    </p>

    <p style="color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
      This is a reminder that you're scheduled to work on <strong>${safeProjectName}</strong> starting tomorrow, <strong>${safeStartDate}</strong>.
    </p>

    ${button('View My Schedule', calendarUrl)}

    <p style="color: ${BRAND_COLORS.muted}; font-size: 14px; text-align: center; margin: 30px 0 0 0;">
      Questions? Please contact your project manager.
    </p>
  `;

  return baseTemplate(content, {
    previewText: `Reminder: ${safeProjectName} starts tomorrow`,
  });
}

export function welcomeEmail(options: WelcomeEmailOptions): string {
  const { clientName, pocName, projectType, initialStatus, portalUrl } = options;

  // Escape all user-controlled inputs
  const safeClientName = escapeHtml(clientName);
  const safePocName = escapeHtml(pocName);
  const safeProjectType = escapeHtml(projectType);
  const safeInitialStatus = escapeHtml(initialStatus);

  const content = `
    <h1 style="color: ${BRAND_COLORS.primary}; font-size: 24px; margin: 0 0 10px 0;">
      Welcome to Amitrace!
    </h1>

    <p style="color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
      Hi ${safePocName},
    </p>

    <p style="color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
      Your project <strong>${safeClientName}</strong> has been created and is now being tracked in our system.
    </p>

    <div style="background-color: #f8faf9; border-radius: 8px; padding: 20px; margin: 25px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: ${BRAND_COLORS.muted}; font-size: 14px; padding: 8px 0;">Project Type:</td>
          <td style="color: ${BRAND_COLORS.text}; font-size: 14px; padding: 8px 0; text-align: right; font-weight: 600;">${safeProjectType}</td>
        </tr>
        <tr>
          <td style="color: ${BRAND_COLORS.muted}; font-size: 14px; padding: 8px 0;">Current Status:</td>
          <td style="color: ${BRAND_COLORS.text}; font-size: 14px; padding: 8px 0; text-align: right; font-weight: 600;">${safeInitialStatus}</td>
        </tr>
      </table>
    </div>

    <p style="color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
      You can track the progress of your project at any time using the link below. Bookmark it for easy access!
    </p>

    ${button('View Project Portal', portalUrl)}

    <p style="color: ${BRAND_COLORS.muted}; font-size: 14px; text-align: center; margin: 30px 0 0 0;">
      You'll receive email updates whenever your project status changes.<br>
      Questions? Please email your project manager <a href="mailto:jason@amitrace.com" style="color: ${BRAND_COLORS.primary};">jason@amitrace.com</a>
    </p>
  `;

  return baseTemplate(content, {
    previewText: `Your project ${safeClientName} is now being tracked`,
  });
}

// ============================================
// Customer Confirmation Email Templates
// ============================================

interface ConfirmationEmailOptions {
  customerName: string;
  projectName: string;
  assignments: Array<{
    engineerName: string;
    days: Array<{
      date: string;
      startTime: string;
      endTime: string;
    }>;
  }>;
  confirmUrl: string;
  expiresAt: string;
}

export function confirmationEmailTemplate(options: ConfirmationEmailOptions): string {
  const { customerName, projectName, assignments, confirmUrl, expiresAt } = options;

  const safeCustomerName = escapeHtml(customerName);
  const safeProjectName = escapeHtml(projectName);

  // Format expiration date
  const expiresDate = new Date(expiresAt);
  const formattedExpires = expiresDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Build schedule table rows
  const scheduleRows = assignments.flatMap(assignment => {
    const safeEngineerName = escapeHtml(assignment.engineerName);
    return assignment.days.map(day => {
      const date = new Date(day.date);
      const formattedDate = date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const startTime = day.startTime.slice(0, 5);
      const endTime = day.endTime.slice(0, 5);

      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: ${BRAND_COLORS.text};">
            ${escapeHtml(formattedDate)}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: ${BRAND_COLORS.text};">
            ${escapeHtml(startTime)} - ${escapeHtml(endTime)}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: ${BRAND_COLORS.text};">
            ${safeEngineerName}
          </td>
        </tr>
      `;
    });
  }).join('');

  const content = `
    <h1 style="color: ${BRAND_COLORS.primary}; font-size: 24px; margin: 0 0 20px 0;">
      Please Confirm Your Project Dates
    </h1>

    <p style="color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
      Hi ${safeCustomerName},
    </p>

    <p style="color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.5; margin: 0 0 25px 0;">
      We've scheduled the following dates for <strong>${safeProjectName}</strong>.
      Please review and confirm at your earliest convenience.
    </p>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; background: #f9fafb; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background: ${BRAND_COLORS.primary}; color: white;">
          <th style="padding: 12px; text-align: left; font-weight: 600;">Date</th>
          <th style="padding: 12px; text-align: left; font-weight: 600;">Time</th>
          <th style="padding: 12px; text-align: left; font-weight: 600;">Engineer</th>
        </tr>
      </thead>
      <tbody>
        ${scheduleRows}
      </tbody>
    </table>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${escapeHtml(confirmUrl)}" style="display: inline-block; background-color: ${BRAND_COLORS.primary}; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
        Review &amp; Confirm Dates
      </a>
    </div>

    <p style="color: ${BRAND_COLORS.muted}; font-size: 14px; text-align: center; margin: 25px 0 0 0;">
      This link will expire on ${escapeHtml(formattedExpires)}.
    </p>

    <p style="color: ${BRAND_COLORS.muted}; font-size: 14px; text-align: center; margin: 15px 0 0 0;">
      Questions? Please contact us at <a href="mailto:support@amitrace.com" style="color: ${BRAND_COLORS.primary};">support@amitrace.com</a>
    </p>
  `;

  return baseTemplate(content, {
    previewText: `Please confirm your project dates for ${safeProjectName}`,
  });
}

interface PMConfirmationResponseEmailOptions {
  pmName: string;
  projectName: string;
  customerName: string;
  action: 'confirm' | 'decline';
  declineReason?: string;
}

export function pmConfirmationResponseEmailTemplate(options: PMConfirmationResponseEmailOptions): string {
  const { pmName, projectName, customerName, action, declineReason } = options;

  const safePmName = escapeHtml(pmName);
  const safeProjectName = escapeHtml(projectName);
  const safeCustomerName = escapeHtml(customerName);
  const safeDeclineReason = declineReason ? escapeHtml(declineReason) : undefined;

  const isConfirmed = action === 'confirm';
  const statusColor = isConfirmed ? '#10B981' : '#EF4444';
  const statusText = isConfirmed ? 'Confirmed' : 'Declined';
  const statusEmoji = isConfirmed ? '✓' : '✗';

  const content = `
    <h1 style="color: ${BRAND_COLORS.primary}; font-size: 24px; margin: 0 0 20px 0;">
      Customer ${statusText} Project Dates
    </h1>

    <p style="color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
      Hi ${safePmName},
    </p>

    <p style="color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.5; margin: 0 0 25px 0;">
      <strong>${safeCustomerName}</strong> has responded to your confirmation request for <strong>${safeProjectName}</strong>.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <span style="display: inline-block; background-color: ${statusColor}; color: white; padding: 16px 32px; border-radius: 50px; font-size: 18px; font-weight: 600;">
        ${statusEmoji} ${statusText}
      </span>
    </div>

    ${!isConfirmed && safeDeclineReason ? `
      <div style="background-color: #FEF2F2; border-left: 4px solid #EF4444; padding: 15px; margin: 25px 0; border-radius: 0 8px 8px 0;">
        <p style="color: ${BRAND_COLORS.text}; font-size: 14px; margin: 0 0 5px 0; font-weight: 600;">
          Reason for declining:
        </p>
        <p style="color: ${BRAND_COLORS.text}; font-size: 14px; margin: 0; font-style: italic;">
          "${safeDeclineReason}"
        </p>
      </div>
    ` : ''}

    ${!isConfirmed ? `
      <p style="color: ${BRAND_COLORS.text}; font-size: 14px; line-height: 1.5; margin: 25px 0;">
        The assignment status has been reverted to <strong>Tentative</strong>.
        Please contact the customer to reschedule, then send a new confirmation request.
      </p>
    ` : `
      <p style="color: ${BRAND_COLORS.text}; font-size: 14px; line-height: 1.5; margin: 25px 0;">
        All assignments have been updated to <strong>Confirmed</strong> status.
      </p>
    `}

    ${button('View Calendar', `${process.env.NEXT_PUBLIC_APP_URL}/calendar`)}
  `;

  return baseTemplate(content, {
    previewText: `${safeCustomerName} ${statusText.toLowerCase()} dates for ${safeProjectName}`,
  });
}
