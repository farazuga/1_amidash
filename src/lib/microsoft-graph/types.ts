/**
 * Types for Microsoft Graph / Outlook Calendar integration
 * App-level client credentials — no per-user OAuth tokens
 */

// --- Legacy type kept for SharePoint integration compatibility ---
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

// --- New app-level calendar types ---

export interface EngineerOutlookCalendar {
  id: string;
  user_id: string;
  outlook_calendar_id: string;
  outlook_email: string;
  created_at: string;
  updated_at: string;
}

export interface OutlookEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay: boolean;
  showAs: 'free' | 'tentative' | 'busy' | 'oof' | 'unknown';
  sensitivity: 'normal' | 'personal' | 'private' | 'confidential';
  isFromOutlook: true;
}

export interface OutlookEventInput {
  subject: string;
  body?: { contentType: string; content: string };
  location?: { displayName: string };
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay: boolean;
  showAs: string;
  categories?: string[];
  sensitivity?: string;
}

export interface SyncedCalendarEvent {
  id: string;
  assignment_id: string;
  user_id: string;
  work_date: string;
  external_event_id: string;
  last_synced_at: string;
  sync_error: string | null;
}

export interface SyncResult {
  success: boolean;
  eventId?: string;
  error?: string;
}

// Statuses that should be synced to personal Outlook calendar
export const SYNCABLE_STATUSES = ['confirmed'] as const;
export type SyncableStatus = (typeof SYNCABLE_STATUSES)[number];

// Statuses that should appear on the "AmiDash - Projects" calendar
export const PROJECTS_CALENDAR_STATUSES = ['pending', 'confirmed'] as const;
export type ProjectsCalendarStatus = (typeof PROJECTS_CALENDAR_STATUSES)[number];

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
    sales_order?: string | null;
    poc_name?: string | null;
    poc_email?: string | null;
    poc_phone?: string | null;
    scope_link?: string | null;
    sales_order_url?: string | null;
  };
  team_members?: TeamMemberForSync[];
}
