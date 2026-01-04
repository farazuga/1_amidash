/**
 * Types for Microsoft Graph / Outlook Calendar integration
 */

export interface CalendarConnection {
  id: string;
  user_id: string;
  provider: 'microsoft' | 'google';
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  outlook_email: string | null;
  calendar_id: string;
  created_at: string;
  updated_at: string;
}

export interface SyncedCalendarEvent {
  id: string;
  assignment_id: string;
  connection_id: string;
  external_event_id: string;
  last_synced_at: string;
  sync_error: string | null;
}

export interface MicrosoftTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface MicrosoftUserInfo {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
}

export interface OutlookCalendarEvent {
  id?: string;
  subject: string;
  body?: {
    contentType: 'text' | 'html';
    content: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  isAllDay?: boolean;
  showAs?: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere' | 'unknown';
  categories?: string[];
  sensitivity?: 'normal' | 'personal' | 'private' | 'confidential';
}

export interface OutlookEventCreateResponse {
  id: string;
  subject: string;
  webLink: string;
}

export interface SyncResult {
  success: boolean;
  eventId?: string;
  error?: string;
}

// Configuration
export interface MicrosoftOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tenantId: string;
  scopes: string[];
}

// For assignment data passed to sync
export interface AssignmentForSync {
  id: string;
  user_id: string;
  project_id: string;
  booking_status: string;
  notes: string | null;
  project: {
    id: string;
    client_name: string;
    start_date: string;
    end_date: string;
    sales_order_number?: string | null;
    sales_order_url?: string | null;
    poc_name?: string | null;
    poc_email?: string | null;
    poc_phone?: string | null;
    goal_completion_date?: string | null;
  };
  // Other engineers assigned to the same project (excluding current user)
  other_engineers?: string[];
}
