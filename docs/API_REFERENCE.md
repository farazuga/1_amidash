# API Reference

All endpoints require authentication unless noted. Authentication is via Supabase session cookies (browser) or Bearer token (mobile).

## ActiveCampaign

### `POST /api/activecampaign/accounts`
Search ActiveCampaign accounts by name.
- **Auth**: Required
- **Body**: `{ name: string }`
- **Returns**: `{ accounts: ACAccount[] }`

### `GET /api/activecampaign/accounts`
List accounts with optional search.
- **Auth**: Required
- **Query**: `?search=name`
- **Returns**: `{ accounts: ACAccount[] }`

### `GET /api/activecampaign/accounts/[accountId]/contacts`
Get contacts for a specific account.
- **Auth**: Required
- **Returns**: `{ contacts: ACContact[] }`

### `GET /api/activecampaign/contacts`
Search contacts.
- **Auth**: Required
- **Query**: `?search=email`
- **Returns**: `{ contacts: ACContact[] }`

## Admin

### `GET /api/admin/token-status`
Check Microsoft OAuth token status.
- **Auth**: Required (admin)
- **Returns**: `{ connected: boolean, email: string, expiresAt: string }`

### `GET /api/admin/users`
List all users.
- **Auth**: Required (admin)
- **Returns**: `{ users: Profile[] }`

### `POST /api/admin/users`
Create new user. Requires password for customer role.
- **Auth**: Required (admin)
- **Body**: `{ email, full_name, role, password? }`
- **Returns**: `{ user: Profile }`

### `PATCH /api/admin/users/[id]`
Update user.
- **Auth**: Required (admin)
- **Body**: Partial `{ email, full_name, role }`
- **Returns**: `{ user: Profile }`

### `DELETE /api/admin/users/[id]`
Delete user.
- **Auth**: Required (admin)
- **Returns**: `{ success: true }`

### `POST /api/admin/users/[id]/reset-password`
Reset user password.
- **Auth**: Required (admin)
- **Body**: `{ password: string }`
- **Returns**: `{ success: true }`

## AI

### `POST /api/ai/scope`
Generate scope of work summary using Claude API.
- **Auth**: Required
- **Body**: `{ lineItems: LineItem[], clientName: string }`
- **Returns**: `{ summary: string }`

## Microsoft OAuth

### `GET /api/auth/microsoft`
Initiate OAuth flow. Generates CSRF state, redirects to Microsoft login.
- **Auth**: Required
- **Query**: `?return_url=/path`
- **Redirects**: To Microsoft login page

### `GET /api/auth/microsoft/callback`
Handle OAuth callback. Exchanges code for tokens, encrypts and stores them.
- **Auth**: Required (via CSRF state cookie)
- **Redirects**: To return_url from initiating request

### `POST /api/auth/microsoft/disconnect`
Disconnect Microsoft account.
- **Auth**: Required
- **Returns**: `{ success: true }`

### `GET /api/auth/microsoft/errors`
OAuth error handler page.

### `POST /api/auth/microsoft/retry`
Retry OAuth sync. Rate limited to 10s cooldown per user+assignment.
- **Auth**: Required
- **Returns**: `{ success: true }` or `429` with wait time

### `POST /api/auth/microsoft/sync`
Sync Microsoft calendar data.
- **Auth**: Required
- **Returns**: `{ synced: number }`

## Customer

### `GET /api/customer/email-preferences`
Get customer email notification preferences.
- **Auth**: Required (customer)
- **Returns**: `{ preferences: EmailPreferences }`

### `PUT /api/customer/email-preferences`
Update email preferences.
- **Auth**: Required (customer)
- **Body**: `{ statusUpdates: boolean, welcomeEmails: boolean }`
- **Returns**: `{ success: true }`

## Email

### `POST /api/email/welcome`
Send welcome email to customer. CSRF-protected via origin check.
- **Auth**: Required
- **Body**: `{ to, clientName, pocName, clientToken, projectType?, initialStatus? }`
- **Returns**: `{ success: true, data: { id } }`

### `POST /api/email/status-change`
Send status change notification. CSRF-protected via origin check.
- **Auth**: Required
- **Body**: `{ to, clientName, newStatus, previousStatus?, clientToken?, note? }`
- **Returns**: `{ success: true, data: { id } }`

## Files

### `POST /api/files/upload`
Upload project files. Supports multipart form data.
- **Auth**: Required
- **Body**: FormData with file, projectId, category
- **Returns**: `{ file: ProjectFile }`

### `POST /api/files/presales/upload`
Upload presales files.
- **Auth**: Required
- **Body**: FormData with file, projectId
- **Returns**: `{ file: PresalesFile }`

## Mobile

Bearer token authentication (not cookies).

### `GET /api/mobile/projects`
Get projects for mobile app.
- **Auth**: Bearer token
- **Returns**: `{ projects: Project[] }`

### `GET /api/mobile/microsoft/status`
Check Microsoft sync status.
- **Auth**: Bearer token
- **Returns**: `{ connected: boolean }`

### `POST /api/mobile/sharepoint/upload`
Upload files to SharePoint from mobile.
- **Auth**: Bearer token
- **Body**: FormData with file, projectId, category
- **Returns**: `{ success: true, url: string }`

## Odoo 18

### `POST /api/odoo/pull`
Pull sales order data from Odoo by order number.
- **Auth**: Required
- **Body**: `{ salesOrderNumber: "S1XXXX" }`
- **Returns**: `{ salesOrder, client, salesperson, lineItems }`
- **Errors**: 400 (invalid format), 404 (not found), 200 with error (Odoo not configured)

### `POST /api/odoo/invoice-status`
Refresh invoice status for existing project.
- **Auth**: Required
- **Body**: `{ projectId: string }`
- **Returns**: `{ invoiceStatus: string }`

### `POST /api/odoo/summarize`
Generate project description from line items using Claude AI.
- **Auth**: Required
- **Body**: `{ lineItems: LineItem[], clientName: string }`
- **Returns**: `{ summary: string }`
- **Requires**: `ANTHROPIC_API_KEY` env var

### `GET /api/odoo/activities`
Get Odoo activities related to sales orders.
- **Auth**: Required
- **Returns**: `{ activities: OdooActivity[] }`

## Portal (Public)

### `POST /api/portal/upload`
Upload files to customer portal. Rate limited (10/hour per token). EXIF stripped.
- **Auth**: Token-based (client_token in body)
- **Body**: FormData with file, token
- **Returns**: `{ file: PortalFileUpload }`

### `POST /api/portal/confirm-address`
Confirm delivery address on portal.
- **Auth**: Token-based
- **Body**: `{ token, address, confirmed: boolean }`
- **Returns**: `{ success: true }`

## SharePoint

### `GET /api/sharepoint/sites`
List SharePoint sites.
- **Auth**: Required (Microsoft connected)
- **Returns**: `{ sites: Site[] }`

### `GET /api/sharepoint/sites/[siteId]/drives`
Get drives in a SharePoint site.
- **Auth**: Required
- **Returns**: `{ drives: Drive[] }`

### `GET /api/sharepoint/drives/[driveId]/folders/[folderId]`
Browse folder contents.
- **Auth**: Required
- **Returns**: `{ items: DriveItem[] }`

## Other

### `GET /api/sow/config`
Get scope of work configuration.
- **Auth**: Required
- **Returns**: `{ config: SowConfig }`

### `GET /api/thumbnails`
Generate/retrieve file thumbnails.
- **Auth**: Required
- **Query**: `?fileId=xxx`
- **Returns**: Image binary

### `GET /api/user/preferences`
Get user preferences.
- **Auth**: Required
- **Returns**: `{ preferences: UserPreferences }`

### `PUT /api/user/preferences`
Update user preferences.
- **Auth**: Required
- **Body**: Partial preferences object
- **Returns**: `{ success: true }`
