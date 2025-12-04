// Email template utilities for Amitrace Dashboard

const BRAND_COLORS = {
  primary: '#023A2D',
  background: '#f8faf9',
  text: '#666',
  muted: '#999',
};

const LOGO_URL = 'https://www.amitrace.com/wp-content/uploads/2022/04/amitrace-logo.png';

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
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${BRAND_COLORS.background};">
        ${options.previewText ? `<div style="display: none; max-height: 0; overflow: hidden;">${options.previewText}</div>` : ''}
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <!-- Header -->
          <div style="background-color: ${BRAND_COLORS.primary}; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <img src="${LOGO_URL}" alt="Amitrace" style="height: 40px; filter: brightness(0) invert(1);">
          </div>

          <!-- Content -->
          <div style="background-color: white; padding: 40px 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            ${content}
          </div>

          <!-- Footer -->
          <div style="text-align: center; padding: 20px; color: ${BRAND_COLORS.muted}; font-size: 12px;">
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
      <a href="${url}" style="display: inline-block; background-color: ${BRAND_COLORS.primary}; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;">
        ${text}
      </a>
    </div>
  `;
}

function statusBadge(status: string): string {
  return `
    <div style="text-align: center; margin: 30px 0;">
      <span style="display: inline-block; background-color: ${BRAND_COLORS.primary}; color: white; padding: 12px 24px; border-radius: 50px; font-size: 18px; font-weight: 600;">
        ${status}
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

  const content = `
    <h1 style="color: ${BRAND_COLORS.primary}; font-size: 24px; margin: 0 0 10px 0;">
      Project Status Update
    </h1>

    <p style="color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
      Your project <strong>${clientName}</strong> has been updated.
    </p>

    ${previousStatus ? `
      <p style="color: ${BRAND_COLORS.muted}; font-size: 14px; margin: 0 0 10px 0;">
        Previous status: ${previousStatus}
      </p>
    ` : ''}

    ${statusBadge(newStatus)}

    ${note ? `
      <div style="background-color: #f5f5f5; border-left: 4px solid ${BRAND_COLORS.primary}; padding: 15px; margin: 20px 0; border-radius: 0 4px 4px 0;">
        <p style="color: ${BRAND_COLORS.text}; font-size: 14px; margin: 0; font-style: italic;">
          "${note}"
        </p>
      </div>
    ` : ''}

    ${button('View Project Status', portalUrl)}

    <p style="color: ${BRAND_COLORS.muted}; font-size: 14px; text-align: center; margin: 30px 0 0 0;">
      Questions? Reply to this email or contact us at support@amitrace.com
    </p>
  `;

  return baseTemplate(content, {
    previewText: `${clientName} status updated to ${newStatus}`,
  });
}

interface WelcomeEmailOptions {
  clientName: string;
  pocName: string;
  projectType: string;
  initialStatus: string;
  portalUrl: string;
}

export function welcomeEmail(options: WelcomeEmailOptions): string {
  const { clientName, pocName, projectType, initialStatus, portalUrl } = options;

  const content = `
    <h1 style="color: ${BRAND_COLORS.primary}; font-size: 24px; margin: 0 0 10px 0;">
      Welcome to Amitrace!
    </h1>

    <p style="color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
      Hi ${pocName},
    </p>

    <p style="color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
      Your project <strong>${clientName}</strong> has been created and is now being tracked in our system.
    </p>

    <div style="background-color: #f8faf9; border-radius: 8px; padding: 20px; margin: 25px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: ${BRAND_COLORS.muted}; font-size: 14px; padding: 8px 0;">Project Type:</td>
          <td style="color: ${BRAND_COLORS.text}; font-size: 14px; padding: 8px 0; text-align: right; font-weight: 600;">${projectType}</td>
        </tr>
        <tr>
          <td style="color: ${BRAND_COLORS.muted}; font-size: 14px; padding: 8px 0;">Current Status:</td>
          <td style="color: ${BRAND_COLORS.text}; font-size: 14px; padding: 8px 0; text-align: right; font-weight: 600;">${initialStatus}</td>
        </tr>
      </table>
    </div>

    <p style="color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
      You can track the progress of your project at any time using the link below. Bookmark it for easy access!
    </p>

    ${button('View Project Portal', portalUrl)}

    <p style="color: ${BRAND_COLORS.muted}; font-size: 14px; text-align: center; margin: 30px 0 0 0;">
      You'll receive email updates whenever your project status changes.<br>
      Questions? Reply to this email or contact us at support@amitrace.com
    </p>
  `;

  return baseTemplate(content, {
    previewText: `Your project ${clientName} is now being tracked`,
  });
}
