/**
 * Microsoft Graph API client for Outlook Calendar operations
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { refreshAccessToken, isTokenExpired, calculateExpiresAt } from './auth';
import { createServiceClient } from '@/lib/supabase/server';
import { decryptToken, encryptToken, isEncryptionConfigured } from '@/lib/crypto';
import type {
  CalendarConnection,
  MicrosoftUserInfo,
  OutlookCalendarEvent,
  OutlookEventCreateResponse,
} from './types';

/**
 * Decrypt access token from storage if encryption is configured
 */
function getDecryptedAccessToken(encryptedToken: string): string {
  if (!isEncryptionConfigured()) {
    return encryptedToken;
  }
  try {
    return decryptToken(encryptedToken);
  } catch {
    // Token might not be encrypted (legacy data)
    console.warn('Token decryption failed, using raw token (may be legacy unencrypted data)');
    return encryptedToken;
  }
}

/**
 * Decrypt refresh token from storage if encryption is configured
 */
function getDecryptedRefreshToken(encryptedToken: string): string {
  if (!isEncryptionConfigured()) {
    return encryptedToken;
  }
  try {
    return decryptToken(encryptedToken);
  } catch {
    // Token might not be encrypted (legacy data)
    console.warn('Refresh token decryption failed, using raw token (may be legacy unencrypted data)');
    return encryptedToken;
  }
}

/**
 * Get a Microsoft Graph client with valid access token
 * Automatically refreshes token if expired
 */
export async function getGraphClient(
  connection: CalendarConnection
): Promise<{ client: Client; connection: CalendarConnection }> {
  let currentConnection = connection;

  // Decrypt tokens from storage
  const decryptedAccessToken = getDecryptedAccessToken(connection.access_token);
  const decryptedRefreshToken = getDecryptedRefreshToken(connection.refresh_token);

  // Check if token needs refresh
  if (isTokenExpired(connection.token_expires_at)) {
    console.log('Access token expired, refreshing...');

    try {
      const newTokens = await refreshAccessToken(decryptedRefreshToken);

      // Encrypt new tokens before storing
      let accessTokenToStore = newTokens.access_token;
      let refreshTokenToStore = newTokens.refresh_token;

      if (isEncryptionConfigured()) {
        accessTokenToStore = encryptToken(newTokens.access_token);
        refreshTokenToStore = encryptToken(newTokens.refresh_token);
      }

      // Update tokens in database
      const supabase = await createServiceClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('calendar_connections')
        .update({
          access_token: accessTokenToStore,
          refresh_token: refreshTokenToStore,
          token_expires_at: calculateExpiresAt(newTokens.expires_in).toISOString(),
        })
        .eq('id', connection.id);

      if (error) {
        console.error('Failed to update tokens in database:', error);
        throw new Error('Failed to update refreshed tokens');
      }

      // Update local connection object with encrypted tokens (for storage consistency)
      // but use decrypted tokens for the Graph client
      currentConnection = {
        ...connection,
        access_token: accessTokenToStore,
        refresh_token: refreshTokenToStore,
        token_expires_at: calculateExpiresAt(newTokens.expires_in).toISOString(),
      };

      // Use the fresh unencrypted access token for the client
      const client = Client.init({
        authProvider: (done) => {
          done(null, newTokens.access_token);
        },
      });

      return { client, connection: currentConnection };
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw new Error('Failed to refresh access token. User may need to reconnect.');
    }
  }

  // Create Graph client with decrypted access token
  const client = Client.init({
    authProvider: (done) => {
      done(null, decryptedAccessToken);
    },
  });

  return { client, connection: currentConnection };
}

/**
 * Get user info from Microsoft Graph
 */
export async function getUserInfo(accessToken: string): Promise<MicrosoftUserInfo> {
  const client = Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });

  const user = await client.api('/me').select('id,displayName,mail,userPrincipalName').get();

  return {
    id: user.id,
    displayName: user.displayName,
    mail: user.mail,
    userPrincipalName: user.userPrincipalName,
  };
}

/**
 * Create a calendar event in Outlook
 */
export async function createCalendarEvent(
  connection: CalendarConnection,
  event: OutlookCalendarEvent
): Promise<OutlookEventCreateResponse> {
  const { client } = await getGraphClient(connection);

  const calendarPath = connection.calendar_id === 'primary'
    ? '/me/calendar/events'
    : `/me/calendars/${connection.calendar_id}/events`;

  const response = await client.api(calendarPath).post(event);

  return {
    id: response.id,
    subject: response.subject,
    webLink: response.webLink,
  };
}

/**
 * Update an existing calendar event in Outlook
 */
export async function updateCalendarEvent(
  connection: CalendarConnection,
  eventId: string,
  event: Partial<OutlookCalendarEvent>
): Promise<void> {
  const { client } = await getGraphClient(connection);

  await client.api(`/me/events/${eventId}`).patch(event);
}

/**
 * Delete a calendar event from Outlook
 */
export async function deleteCalendarEvent(
  connection: CalendarConnection,
  eventId: string
): Promise<void> {
  const { client } = await getGraphClient(connection);

  try {
    await client.api(`/me/events/${eventId}`).delete();
  } catch (error: unknown) {
    // Ignore 404 errors (event already deleted)
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
      console.log('Event already deleted from Outlook');
      return;
    }
    throw error;
  }
}

/**
 * Get list of user's calendars
 */
export async function getCalendars(
  connection: CalendarConnection
): Promise<Array<{ id: string; name: string; isDefault: boolean }>> {
  const { client } = await getGraphClient(connection);

  const response = await client.api('/me/calendars').select('id,name,isDefaultCalendar').get();

  return response.value.map((cal: { id: string; name: string; isDefaultCalendar: boolean }) => ({
    id: cal.id,
    name: cal.name,
    isDefault: cal.isDefaultCalendar,
  }));
}

/**
 * Build an Outlook event object from assignment data
 */
export function buildEventFromAssignment(
  assignment: {
    id: string;
    booking_status: string;
    notes: string | null;
    project: {
      client_name: string;
      start_date: string;
      end_date: string;
    };
  },
  baseUrl: string
): OutlookCalendarEvent {
  const statusLabel = getStatusLabel(assignment.booking_status);
  const showAs = assignment.booking_status === 'confirmed' ? 'busy' : 'tentative';

  // Build description
  let description = `Project: ${assignment.project.client_name}\n`;
  description += `Status: ${statusLabel}\n`;
  if (assignment.notes) {
    description += `\nNotes: ${assignment.notes}`;
  }
  description += `\n\nView in AmiDash: ${baseUrl}/calendar`;

  // Parse dates - add one day to end date because Outlook end dates are exclusive
  const startDate = new Date(assignment.project.start_date);
  const endDate = new Date(assignment.project.end_date);
  endDate.setDate(endDate.getDate() + 1); // Make end date exclusive

  return {
    subject: `📋 ${assignment.project.client_name}`,
    body: {
      contentType: 'text',
      content: description,
    },
    start: {
      dateTime: startDate.toISOString().split('T')[0],
      timeZone: 'UTC',
    },
    end: {
      dateTime: endDate.toISOString().split('T')[0],
      timeZone: 'UTC',
    },
    isAllDay: true,
    showAs,
    categories: [getStatusCategory(assignment.booking_status)],
    sensitivity: 'normal',
  };
}

/**
 * Get human-readable status label
 */
function getStatusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'tentative':
      return 'Tentative';
    case 'pending_confirm':
      return 'Pending Confirmation';
    case 'confirmed':
      return 'Confirmed';
    default:
      return status;
  }
}

/**
 * Get Outlook category based on booking status
 */
function getStatusCategory(status: string): string {
  switch (status) {
    case 'draft':
      return 'Blue category';
    case 'tentative':
      return 'Orange category';
    case 'pending_confirm':
      return 'Purple category';
    case 'confirmed':
      return 'Green category';
    default:
      return 'Blue category';
  }
}
