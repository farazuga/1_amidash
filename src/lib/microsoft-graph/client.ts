/**
 * Microsoft Graph API client for Outlook Calendar operations
 * Uses app-level client credentials — targets users by email
 */

import { getAppAccessToken } from './auth';
import type { OutlookEvent, OutlookEventInput } from './types';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

// Base fetch wrapper
async function graphFetch(path: string, options: RequestInit = {}) {
  const token = await getAppAccessToken();
  const response = await fetch(`${GRAPH_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Graph API error ${response.status}: ${(error as { error?: { message?: string } }).error?.message || response.statusText}`
    );
  }
  if (response.status === 204) return null;
  return response.json();
}

// Create a dedicated "AmiDash" calendar on a user's account
export async function createCalendarForUser(
  email: string
): Promise<{ id: string; name: string }> {
  return graphFetch(`/users/${email}/calendars`, {
    method: 'POST',
    body: JSON.stringify({ name: 'AmiDash' }),
  });
}

// Verify a calendar exists
export async function getCalendarForUser(
  email: string,
  calendarId: string
): Promise<{ id: string; name: string } | null> {
  try {
    return await graphFetch(`/users/${email}/calendars/${calendarId}`);
  } catch {
    return null;
  }
}

// Create an event on a specific user's calendar
export async function createCalendarEvent(
  email: string,
  calendarId: string,
  event: OutlookEventInput
): Promise<{ id: string }> {
  return graphFetch(`/users/${email}/calendars/${calendarId}/events`, {
    method: 'POST',
    body: JSON.stringify(event),
  });
}

// Update an existing event
export async function updateCalendarEvent(
  email: string,
  calendarId: string,
  eventId: string,
  event: Partial<OutlookEventInput>
): Promise<{ id: string }> {
  return graphFetch(
    `/users/${email}/calendars/${calendarId}/events/${eventId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(event),
    }
  );
}

// Delete an event
export async function deleteCalendarEvent(
  email: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  await graphFetch(
    `/users/${email}/calendars/${calendarId}/events/${eventId}`,
    {
      method: 'DELETE',
    }
  );
}

// Read events from a user's DEFAULT calendar (read-only, for conflict display)
// Masks private/confidential events
export async function getCalendarEvents(
  email: string,
  startDate: string,
  endDate: string
): Promise<OutlookEvent[]> {
  const params = new URLSearchParams({
    startDateTime: `${startDate}T00:00:00Z`,
    endDateTime: `${endDate}T23:59:59Z`,
    $select: 'id,subject,start,end,isAllDay,showAs,sensitivity',
    $top: '100',
  });

  const data = await graphFetch(`/users/${email}/calendarView?${params}`);

  return ((data as { value?: Array<Record<string, unknown>> }).value || []).map(
    (event: Record<string, unknown>) => ({
      id: event.id as string,
      subject:
        event.sensitivity === 'private' || event.sensitivity === 'confidential'
          ? 'Private'
          : (event.subject as string),
      start: event.start as { dateTime: string; timeZone: string },
      end: event.end as { dateTime: string; timeZone: string },
      isAllDay: event.isAllDay as boolean,
      showAs: event.showAs as OutlookEvent['showAs'],
      sensitivity: event.sensitivity as OutlookEvent['sensitivity'],
      isFromOutlook: true as const,
    })
  );
}

// Build a calendar event from assignment data
export function buildCalendarEvent(params: {
  projectName: string;
  date: string;
  startTime: string;
  endTime: string;
  teamMembers: string[];
  pmContact?: string;
  dashboardUrl?: string;
}): OutlookEventInput {
  const body = [
    `📋 Project: ${params.projectName}`,
    params.teamMembers.length > 0
      ? `👥 Team: ${params.teamMembers.join(', ')}`
      : null,
    params.pmContact ? `📞 PM: ${params.pmContact}` : null,
    params.dashboardUrl ? `🔗 Details: ${params.dashboardUrl}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    subject: params.projectName,
    body: { contentType: 'text', content: body },
    start: {
      dateTime: `${params.date}T${params.startTime}:00`,
      timeZone: 'America/New_York',
    },
    end: {
      dateTime: `${params.date}T${params.endTime}:00`,
      timeZone: 'America/New_York',
    },
    isAllDay: false,
    showAs: 'busy',
    categories: ['Green category'],
    sensitivity: 'normal',
  };
}
