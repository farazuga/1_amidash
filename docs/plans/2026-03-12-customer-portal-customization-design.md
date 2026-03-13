# Customer Portal Customization — Design Document

**Date:** 2026-03-12
**Branch:** feature/customer_portal_customization
**Approach:** Single migration (050) with incremental feature builds

---

## 1. Database Schema (Migration 050)

### New Tables

#### `portal_email_templates`
Per-portal email branding overrides.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | default gen_random_uuid() |
| portal_template_id | uuid FK → portal_templates | UNIQUE, ON DELETE CASCADE |
| primary_color | text | Default `#023A2D` |
| logo_url | text | Default Amitrace logo URL |
| footer_text | text | Custom footer text |
| button_color | text | Default `#023A2D` |
| button_text_color | text | Default `#ffffff` |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

#### `portal_file_uploads`
Tracks file upload requests and submissions from the customer portal.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | default gen_random_uuid() |
| project_id | uuid FK → projects | ON DELETE CASCADE |
| block_id | text NOT NULL | Links to portal block config ID |
| file_label | text NOT NULL | e.g. "Signed SOW" |
| file_description | text | Instructions for customer |
| slot_index | smallint NOT NULL | 0 or 1 (max 2 files per block) |
| original_filename | text | NULL until uploaded |
| stored_filename | text | Sanitized name in SharePoint |
| file_size_bytes | integer | |
| mime_type | text | |
| sharepoint_item_id | text | Graph API item ID |
| sharepoint_web_url | text | Direct link |
| upload_status | text NOT NULL | CHECK: pending, uploaded, approved, rejected |
| rejection_note | text | NULL unless rejected |
| uploaded_at | timestamptz | |
| reviewed_by | uuid FK → profiles | |
| reviewed_at | timestamptz | |
| created_at | timestamptz | default now() |

#### `customer_approval_tasks`
Approval queue for the designated approver.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | default gen_random_uuid() |
| file_upload_id | uuid FK → portal_file_uploads | ON DELETE CASCADE |
| assigned_to | uuid FK → profiles | The "Customer Approval" user |
| status | text NOT NULL | CHECK: pending, approved, rejected |
| note | text | Rejection reason |
| created_at | timestamptz | default now() |
| completed_at | timestamptz | |

#### `delivery_address_confirmations`
Tracks customer address confirmations on the portal.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | default gen_random_uuid() |
| project_id | uuid FK → projects | UNIQUE (one confirmation per project) |
| confirmed_by_email | text NOT NULL | Must match POC email |
| confirmed_at | timestamptz NOT NULL | default now() |
| address_snapshot | jsonb NOT NULL | Frozen copy of address at confirmation time |

### Altered Tables

#### `projects` — New columns
| Column | Type | Notes |
|---|---|---|
| is_draft | boolean NOT NULL | Default false |
| delivery_street | text | |
| delivery_city | text | |
| delivery_state | text | |
| delivery_zip | text | |
| delivery_country | text | Default 'US' |

#### `statuses` — New seed row
- name: "Draft", color: "#9ca3af" (grey), is_internal_only: true, display_order: 0, is_active: true

#### `app_settings` — New row
- key: `customer_approval_user_id`, value: null (admin sets this)

### New Portal Block Types
Added to TypeScript union and portal builder:
- `file_upload`
- `delivery_address_confirmation`

---

## 2. Draft Projects & Delivery Address

### Draft Project Behavior
- "Save as Draft" button alongside "Create Project" in the project form
- Drafts require only `client_name` — all other fields optional
- `is_draft = true`, `current_status_id` → grey "Draft" status
- No SharePoint folder, no welcome email, no Outlook sync, no portal token
- Greyed-out rows in the projects table
- Excluded from ALL dashboard metrics (WHERE is_draft = false)
- Excluded from calendar views

### Publishing a Draft
- Edit draft → fill required fields (including delivery address) → click "Create Project"
- Transitions: is_draft = false, assigns first real status, creates status history, triggers SharePoint folder, sends welcome email

### Delivery Address
- New "Delivery Address" button in project form opens a dialog
- Structured fields: Street, City, State, ZIP, Country (default US)
- Required for non-draft project creation
- Existing projects grandfathered (NULL address allowed)
- Compact summary line in form after entry

---

## 3. Email Template Customization

### Per-Portal Email Styling
- Each portal template gets an "Email Branding" section in the portal builder
- Customizable: primary color, logo URL, button color, button text color, footer text
- Stored in `portal_email_templates` (1:1 with portal_templates)
- Applied to all emails sent for projects using that portal template
- Fallback to default brand colors if no custom style exists

### Admin UI
- Collapsible "Email Branding" section below block list in portal builder
- Color pickers, text inputs for logo URL and footer
- Live preview panel showing sample email
- "Send Test Email" button sends sample to admin's email

### Template Rendering Changes
- `baseTemplate()` accepts optional `EmailStyleOverrides` parameter
- All email functions pass overrides through
- API routes resolve: project → portal template → email style → defaults

---

## 4. File Upload Block

### Portal Builder Config
- New block type `file_upload` in drag-and-drop list
- Config: File Label 1 (required), Description 1 (required), File Label 2 (optional), Description 2 (conditional)
- Stored as `config.files: [{ label, description }, ...]`

### Customer Portal Rendering
- Card with file slots showing label, description, upload area
- Accepted: .pdf, .png, .jpg, .eps
- Max 3MB (client + server enforced)
- States: empty → uploading → uploaded (pending review) → approved / rejected
- Rejected: shows note + re-upload button
- Approved: green checkmark, filename, locked

### Upload Server Flow
1. POST /api/portal/upload (multipart/form-data + token)
2. Validate: token, file type (magic bytes via `file-type`), size, rate limit (10/hr/token)
3. Sanitize filename (strip traversal, special chars, prefix timestamp, limit 100 chars)
4. Upload to SharePoint: {ProjectFolder}/client_uploads/{filename}
5. Insert portal_file_uploads row (status: uploaded)
6. Create customer_approval_tasks row
7. Email approval user

### Security Layers
| Layer | Check |
|---|---|
| Client | Extension allowlist, 3MB limit |
| Server - format | Magic byte validation (file-type package) |
| Server - size | Re-check ≤ 3MB |
| Server - filename | Strip ../, null bytes, control chars; truncate 100 chars; timestamp prefix |
| Server - rate limit | 10 uploads/hour per portal token |
| Server - auth | Valid portal token, project not draft |
| Server - content | Strip EXIF (sharp), reject macro-embedded Office docs |
| SharePoint | Isolated client_uploads subfolder |

---

## 5. Customer Approval Workflow

### Admin Settings
- New "Customer Approvals" section in /admin/settings
- Dropdown to select approval user (admin/editor profiles)
- Stored in app_settings as customer_approval_user_id

### Approval Dashboard
- New page: /approvals (dashboard sidebar, visible to approval user + admins)
- Table: Project Name, Filename, Uploaded At, Status
- Filter tabs: Pending | Approved | Rejected
- Row click → detail panel with file preview, download link, project link
- Approve button / Reject button (requires note textarea)
- Sidebar badge showing pending count

### Approve Flow
1. customer_approval_tasks.status → approved, set completed_at
2. portal_file_uploads.upload_status → approved, set reviewed_by/at
3. Email customer (poc_email): file approved, link to portal

### Reject Flow
1. Require rejection note (UI + server enforced)
2. customer_approval_tasks.status → rejected, set note, completed_at
3. portal_file_uploads.upload_status → rejected, set rejection_note, reviewed_by/at
4. Email customer: file requires attention + note + portal link
5. Portal shows rejection note + re-upload button
6. Re-upload creates NEW rows (old preserved for audit)

---

## 6. Delivery Address Confirmation Block

### Portal Builder
- New block type `delivery_address_confirmation` — no config needed
- Automatically pulls project's delivery address

### Customer Portal Rendering
- Card: "Confirm Delivery Address"
- Shows full address (street, city, state, zip, country)
- No address: "Delivery address not yet available"
- Email input: "Enter your email to confirm"
- Match poc_email (case-insensitive) → confirmed, snapshot saved
- Mismatch → "Email does not match our records. Please try again."
- Already confirmed → "Address confirmed on {date}" + checkmark
- Note: "If this address is incorrect, please contact jason@amitrace.com"

### Server Action
- POST /api/portal/confirm-address { token, email }
- Validates token, email match, not already confirmed
- Inserts delivery_address_confirmations with address_snapshot (frozen JSON)

### Address Snapshot Rationale
Frozen copy prevents disputes if PM edits address after customer confirmation.

---

## 7. Testing Strategy (Puppeteer)

### Framework
- Puppeteer added as parallel E2E runner alongside existing Playwright tests
- Config: e2e/puppeteer/jest-puppeteer.config.ts → localhost:3000
- NPM script: test:e2e:puppeteer

### Test Files
| File | Covers |
|---|---|
| draft-projects.test.ts | Draft creation, greyed display, publish flow, metrics exclusion |
| delivery-address.test.ts | Address dialog, validation, structured fields, draft bypass |
| email-templates.test.ts | Portal builder email tab, color pickers, test email, preview |
| file-upload-block.test.ts | Block config, portal upload, type rejection, size limit, re-upload |
| customer-approvals.test.ts | Settings user select, dashboard, approve/reject, emails |
| address-confirmation.test.ts | Block render, email match/mismatch, confirmed state |

### Key Edge Cases
- Draft: save with only client_name, excluded from metrics, publish requires all fields
- Upload: .exe renamed to .pdf rejected, 4MB rejected, valid PDF succeeds
- Upload: no approval user configured → graceful error
- Upload: re-upload after rejection creates new task, preserves old
- Approval: reject without note → validation error
- Approval: non-approval user can't access dashboard
- Address: wrong email → retry allowed, correct email → locked, already confirmed → shows state

### Test Helpers
- e2e/puppeteer/helpers/setup.ts — browser launch, auth cookie injection
- e2e/puppeteer/helpers/portal.ts — test project creation, portal navigation

---

## Build Order

1. **Migration 050** — all schema changes
2. **Draft Projects + Delivery Address** — foundation, changes project creation
3. **Email Template Customization** — independent, needed by later features for styled notifications
4. **File Upload Block** — portal block + SharePoint integration
5. **Customer Approval Workflow** — depends on file uploads + email
6. **Delivery Address Confirmation Block** — depends on delivery address field
7. **Puppeteer E2E Tests** — covers all features
