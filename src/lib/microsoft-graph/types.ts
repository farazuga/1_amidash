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

// Statuses that should be synced to Outlook
export const SYNCABLE_STATUSES = ['pending_confirm', 'confirmed'] as const;
export type SyncableStatus = (typeof SYNCABLE_STATUSES)[number];

// Team member info for event body
export interface TeamMemberForSync {
  full_name: string;
  booking_status: string;
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
    // Extended fields for enriched event body
    sales_order?: string | null;
    poc_name?: string | null;
    poc_email?: string | null;
    poc_phone?: string | null;
    scope_link?: string | null;
    sales_order_url?: string | null;
  };
  // Other team members on this project (excluding this user)
  team_members?: TeamMemberForSync[];
}
