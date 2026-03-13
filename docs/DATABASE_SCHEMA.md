# Database Schema

## Overview
Supabase PostgreSQL with 51 migrations (001-050, some numbers skipped). Row Level Security enabled on all tables.

## Core Tables

### `profiles`
User profiles linked to Supabase auth.
- `id` (uuid, PK) - References auth.users
- `email` (text)
- `full_name` (text)
- `role` (text) - admin, editor, viewer, customer

### `projects`
Main project entity (~50 fields).
- `id` (uuid, PK)
- `sales_order_number` (text, unique)
- `client_name` (text)
- `status_id` (uuid, FK → statuses)
- `project_type_id` (uuid, FK → project_types)
- `start_date` / `end_date` (date)
- `sales_amount` (numeric)
- `po_number` (text)
- `salesperson_id` (uuid, FK → profiles)
- `schedule_status` (text) - draft, tentative, pending_confirm, confirmed
- `is_draft` (boolean) - Draft mode toggle
- `odoo_order_id` (integer) - Odoo sales order ID
- `odoo_invoice_status` (text) - no, to invoice, invoiced
- `client_token` (uuid) - Portal access token
- `delivery_address_*` - Delivery address fields
- `poc_email`, `poc_name`, `secondary_poc_email`, `secondary_poc_name`

### `statuses`
Configurable project statuses.
- `id` (uuid, PK)
- `name` (text)
- `color` (text, nullable) - Hex color code
- `order` (integer) - Display order

### `project_types`
- VidPod, Solution, Box Sale

### `tags` / `project_tags`
Tag system for project categorization.

## Calendar Tables

### `project_assignments`
User assigned to a project.
- `id` (uuid, PK)
- `project_id` (uuid, FK → projects)
- `user_id` (uuid, FK → profiles)
- `booking_status` (text) - draft, tentative, pending_confirm, confirmed
- `notes` (text)

### `assignment_days`
Specific days within an assignment.
- `assignment_id` (uuid, FK → project_assignments)
- `date` (date)
- `start_time` / `end_time` (time)

### `user_availability`
PTO, training, sick leave tracking.
- `user_id` (uuid, FK → profiles)
- `date` (date)
- `type` (text) - pto, training, sick, other
- `note` (text)

### `booking_status_history`
Audit trail for booking status changes.

### `confirmation_requests` / `confirmation_request_assignments`
Customer schedule confirmation workflow.

## L10 Tables

### `l10_teams` / `l10_team_members`
Team structure for L10 meetings.

### `l10_rocks` / `l10_rock_milestones`
Quarterly goals (OKR-style) with milestone tracking.

### `l10_issues`
Team issues with IDS (Identify, Discuss, Solve) workflow.

### `l10_todos`
Action items with owner and due date.

### `l10_headlines`
Team updates with category and sentiment.

### `l10_scorecard_measurables` / `l10_scorecard_entries`
KPI tracking with goals and auto-populate sources.

### `l10_meetings` / `l10_meeting_attendees` / `l10_meeting_ratings`
Meeting lifecycle, attendance, and post-meeting ratings.

### `l10_comments`
Comments on rocks, todos, milestones, issues.

## File Tables

### `project_files` / `presales_files`
File metadata with Supabase storage references.

### `project_sharepoint_connections`
SharePoint site/folder links per project.

### `portal_file_uploads`
Customer-uploaded files via portal.

## Portal Tables

### `portal_email_templates`
Custom email templates for portal communications.

### `customer_approval_tasks`
Deliverable approval workflow.

### `delivery_address_confirmations`
Address confirmation responses from customers.

## Other Tables

### `status_history`
Project status change audit trail.

### `audit_logs`
General change tracking.

### `revenue_goals`
Monthly/yearly revenue targets.

### `app_settings`
Global application configuration (admin-only).

### `email_notification_preferences`
Per-user email opt-in/out.

### `calendar_connections`
Microsoft OAuth token storage (encrypted).

### `saved_filters`
User-saved dashboard filter presets.

## Migration History

| Range | Feature |
|-------|---------|
| 001-011 | Core schema, roles, project types, revenue goals |
| 012 | ActiveCampaign integration |
| 013-021 | Calendar system (assignments, availability, confirmations) |
| 022-028 | Outlook, dashboard, files, SharePoint |
| 029-030 | Cleanup (legacy categories, calendar subscriptions) |
| 031-037 | Internal status, VidPods, status colors |
| 038-046 | L10 meetings (teams, tools, scorecard, meetings, comments) |
| 047 | Odoo integration |
| 048-050 | Customer portal customization |

## Realtime-Enabled Tables
- `l10_meetings`
- `l10_meeting_attendees`
- `l10_meeting_ratings`
- `l10_issues`
- `l10_todos`
- `l10_headlines`

## Row Level Security Summary

| Table | Policy |
|-------|--------|
| `projects` | Staff: all authenticated. Customers: only where poc_email matches |
| `project_files` | All can view/upload. Edit/delete own or admin |
| `app_settings` | Admin only |
| `email_notification_preferences` | Own only, admin sees all |
| `portal_*` tables | Service client (portal routes bypass RLS) |
| `l10_*` tables | Team membership based |
| All others | Authenticated users |
