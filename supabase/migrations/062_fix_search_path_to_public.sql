-- Fix: Migration 061 set search_path = '' (empty) on all public functions,
-- which breaks any function that references tables without schema qualification.
-- The correct fix is search_path = 'public' — still pinned (not mutable),
-- but allows functions to resolve table names in the public schema.

-- Auth/Core
ALTER FUNCTION public.handle_new_user() SET search_path = 'public';
ALTER FUNCTION public.get_user_role(uuid) SET search_path = 'public';
ALTER FUNCTION public.update_updated_at_column() SET search_path = 'public';
ALTER FUNCTION public.increment_portal_views(uuid) SET search_path = 'public';

-- Calendar
ALTER FUNCTION public.get_calendar_assignments(date, date, uuid) SET search_path = 'public';
ALTER FUNCTION public.get_user_schedule(uuid, date, date) SET search_path = 'public';
ALTER FUNCTION public.get_next_booking_status(text) SET search_path = 'public';
ALTER FUNCTION public.check_user_conflicts(uuid, date, date, uuid) SET search_path = 'public';
ALTER FUNCTION public.auto_set_schedule_status() SET search_path = 'public';
ALTER FUNCTION public.is_status_visible_to_engineers(text) SET search_path = 'public';

-- Files
ALTER FUNCTION public.update_project_files_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_presales_files_updated_at() SET search_path = 'public';
ALTER FUNCTION public.get_project_file_counts(uuid) SET search_path = 'public';
ALTER FUNCTION public.get_presales_file_counts(text) SET search_path = 'public';
ALTER FUNCTION public.link_presales_files_to_project(text, uuid) SET search_path = 'public';
ALTER FUNCTION public.migrate_presales_to_project_files(text, uuid, uuid) SET search_path = 'public';
ALTER FUNCTION public.get_pending_upload_count(uuid) SET search_path = 'public';

-- Confirmation
ALTER FUNCTION public.validate_confirmation_token(text) SET search_path = 'public';
ALTER FUNCTION public.process_confirmation_response(text, text, text) SET search_path = 'public';
ALTER FUNCTION public.get_confirmation_details(text) SET search_path = 'public';
ALTER FUNCTION public.get_confirmation_schedule(text) SET search_path = 'public';
ALTER FUNCTION public.expire_pending_confirmation_requests() SET search_path = 'public';

-- Goals
ALTER FUNCTION public.get_monthly_goal(integer, integer) SET search_path = 'public';
ALTER FUNCTION public.get_quarterly_goal(integer, integer) SET search_path = 'public';
ALTER FUNCTION public.get_yearly_goal(integer) SET search_path = 'public';

-- SharePoint
ALTER FUNCTION public.get_sharepoint_config() SET search_path = 'public';
ALTER FUNCTION public.is_sharepoint_configured() SET search_path = 'public';
ALTER FUNCTION public.update_project_sharepoint_connections_updated_at() SET search_path = 'public';

-- Trigger timestamps
ALTER FUNCTION public.update_calendar_connection_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_project_assignments_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_assignment_days_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_signage_slides_updated_at() SET search_path = 'public';
ALTER FUNCTION public.auto_set_invoiced_date() SET search_path = 'public';

-- L10/Teams
ALTER FUNCTION public.get_comment_team_id(text, uuid) SET search_path = 'public';
ALTER FUNCTION public.get_user_team_ids(uuid) SET search_path = 'public';
ALTER FUNCTION public.has_team_role(uuid, uuid, text[]) SET search_path = 'public';
ALTER FUNCTION public.is_team_creator(uuid, uuid) SET search_path = 'public';
ALTER FUNCTION public.is_team_member(uuid, uuid) SET search_path = 'public';
