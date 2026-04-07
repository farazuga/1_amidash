# Customer Portal Customization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add email template customization, file upload with approvals, draft projects with delivery addresses, and address confirmation to the customer portal.

**Architecture:** Single migration (050) creates all schema. Features built incrementally in dependency order: schema → draft projects → email customization → file upload → approval workflow → address confirmation → E2E tests. Each feature follows the existing patterns: server actions with `ActionResult`, TanStack Query hooks, shadcn/ui components, Resend for email.

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL), TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Resend (email), Microsoft Graph (SharePoint), Puppeteer (E2E), Vitest (unit), `file-type` + `sharp` (file security)

---

## Task 1: Database Migration 050

**Files:**
- Create: `supabase/migrations/050_customer_portal_customization.sql`

**Step 1: Write the migration**

```sql
-- Migration 050: Customer Portal Customization
-- Adds: draft projects, delivery address, email templates, file uploads, approvals, address confirmation

-- ============================================
-- 1. Projects: Draft + Delivery Address
-- ============================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_street text,
  ADD COLUMN IF NOT EXISTS delivery_city text,
  ADD COLUMN IF NOT EXISTS delivery_state text,
  ADD COLUMN IF NOT EXISTS delivery_zip text,
  ADD COLUMN IF NOT EXISTS delivery_country text DEFAULT 'US';

-- Insert Draft status (grey, internal-only, display_order 0)
INSERT INTO statuses (name, color, display_order, is_active, is_internal_only, require_note, is_exception)
VALUES ('Draft', '#9ca3af', 0, true, true, false, false)
ON CONFLICT DO NOTHING;

-- ============================================
-- 2. Portal Email Templates
-- ============================================
CREATE TABLE IF NOT EXISTS portal_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_template_id uuid NOT NULL UNIQUE REFERENCES portal_templates(id) ON DELETE CASCADE,
  primary_color text DEFAULT '#023A2D',
  logo_url text DEFAULT 'https://dash.amitrace.com/new_logo.png',
  footer_text text DEFAULT '',
  button_color text DEFAULT '#023A2D',
  button_text_color text DEFAULT '#ffffff',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE portal_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email templates"
  ON portal_email_templates FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Editors can view email templates"
  ON portal_email_templates FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
  );

-- ============================================
-- 3. Portal File Uploads
-- ============================================
CREATE TABLE IF NOT EXISTS portal_file_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  block_id text NOT NULL,
  file_label text NOT NULL,
  file_description text,
  slot_index smallint NOT NULL CHECK (slot_index IN (0, 1)),
  original_filename text,
  stored_filename text,
  file_size_bytes integer,
  mime_type text,
  sharepoint_item_id text,
  sharepoint_web_url text,
  upload_status text NOT NULL DEFAULT 'pending' CHECK (upload_status IN ('pending', 'uploaded', 'approved', 'rejected')),
  rejection_note text,
  uploaded_at timestamptz,
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE portal_file_uploads ENABLE ROW LEVEL SECURITY;

-- Admins/editors can manage all uploads
CREATE POLICY "Staff can manage file uploads"
  ON portal_file_uploads FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
  );

-- Public read for portal (via service role key in API routes)
-- No direct customer RLS needed - portal API routes use service client

-- ============================================
-- 4. Customer Approval Tasks
-- ============================================
CREATE TABLE IF NOT EXISTS customer_approval_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_upload_id uuid NOT NULL REFERENCES portal_file_uploads(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  note text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE customer_approval_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Assigned user and admins can manage approval tasks"
  ON customer_approval_tasks FOR ALL
  USING (
    assigned_to = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 5. Delivery Address Confirmations
-- ============================================
CREATE TABLE IF NOT EXISTS delivery_address_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  confirmed_by_email text NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  address_snapshot jsonb NOT NULL
);

ALTER TABLE delivery_address_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view address confirmations"
  ON delivery_address_confirmations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
  );

-- Public insert handled via service role in API route (portal)

-- ============================================
-- 6. App Settings: Customer Approval User
-- ============================================
INSERT INTO app_settings (key, value)
VALUES ('customer_approval_user_id', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;
```

**Step 2: Verify migration file exists and SQL is valid**

Run: `cat supabase/migrations/050_customer_portal_customization.sql | head -5`
Expected: First lines of the migration visible

**Step 3: Commit**

```bash
git add supabase/migrations/050_customer_portal_customization.sql
git commit -m "feat: add migration 050 for customer portal customization schema"
```

---

## Task 2: TypeScript Types Update

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add new types and extend existing ones**

Add after the existing `PortalBlockType` definition at line 54:

```typescript
// Update PortalBlockType union to include new block types
export type PortalBlockType = 'current_status' | 'poc_info' | 'status_history' | 'customer_schedule' | 'custom_html' | 'file_upload' | 'delivery_address_confirmation';

// Extend PortalBlockConfig for file upload blocks
export interface PortalBlockConfig {
  content?: string;
  title?: string;
  files?: Array<{ label: string; description: string }>;
}

// Email template overrides per portal template
export interface PortalEmailTemplate {
  id: string;
  portal_template_id: string;
  primary_color: string;
  logo_url: string;
  footer_text: string;
  button_color: string;
  button_text_color: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface EmailStyleOverrides {
  primaryColor: string;
  logoUrl: string;
  footerText: string;
  buttonColor: string;
  buttonTextColor: string;
}

// File upload tracking
export type FileUploadStatus = 'pending' | 'uploaded' | 'approved' | 'rejected';

export interface PortalFileUpload {
  id: string;
  project_id: string;
  block_id: string;
  file_label: string;
  file_description: string | null;
  slot_index: number;
  original_filename: string | null;
  stored_filename: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  sharepoint_item_id: string | null;
  sharepoint_web_url: string | null;
  upload_status: FileUploadStatus;
  rejection_note: string | null;
  uploaded_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

// Customer approval tasks
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface CustomerApprovalTask {
  id: string;
  file_upload_id: string;
  assigned_to: string;
  status: ApprovalStatus;
  note: string | null;
  created_at: string;
  completed_at: string | null;
  // Joined relations
  file_upload?: PortalFileUpload;
  assigned_to_profile?: Profile;
  project?: Project;
}

// Delivery address confirmation
export interface DeliveryAddressConfirmation {
  id: string;
  project_id: string;
  confirmed_by_email: string;
  confirmed_at: string;
  address_snapshot: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

// Delivery address on project
export interface DeliveryAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}
```

Add to `Project` interface (after `project_description` at line ~138):

```typescript
  // Draft & Delivery
  is_draft: boolean;
  delivery_street: string | null;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_zip: string | null;
  delivery_country: string | null;
```

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add TypeScript types for portal customization features"
```

---

## Task 3: Draft Projects — Server Actions

**Files:**
- Modify: `src/app/(dashboard)/projects/actions.ts`
- Modify: `src/lib/projects/utils.ts`

**Step 1: Update CreateProjectData to include draft + delivery fields**

In `src/app/(dashboard)/projects/actions.ts`, update `CreateProjectData` interface (line ~20):

```typescript
export interface CreateProjectData {
  // ... existing fields ...
  // Draft & Delivery
  is_draft?: boolean;
  delivery_street?: string | null;
  delivery_city?: string | null;
  delivery_state?: string | null;
  delivery_zip?: string | null;
  delivery_country?: string | null;
}
```

**Step 2: Update createProject() to handle drafts**

In the `createProject` function (line ~57), add draft logic:

- If `data.is_draft` is true:
  - Skip sales order uniqueness check (sales_order_number may be null)
  - Look up the "Draft" status instead of the project type's first status
  - Set `is_draft: true` on insert
  - Skip SharePoint folder creation
  - Skip welcome email
  - Skip Outlook sync
  - Do NOT generate `client_token`
- If `data.is_draft` is false (normal creation):
  - Validate delivery address is present (street, city, state, zip required)
  - Proceed with existing logic

**Step 3: Add publishDraft server action**

```typescript
export async function publishDraft(projectId: string, data: CreateProjectData): Promise<CreateProjectResult> {
  // 1. Validate all required fields including delivery address
  // 2. Get first status for project type
  // 3. Update project: is_draft = false, set all fields, current_status_id = first status
  // 4. Generate client_token
  // 5. Create status_history entry
  // 6. Create SharePoint folder (background)
  // 7. Send welcome email if enabled
  // 8. Revalidate paths
}
```

**Step 4: Update validateProjectForm in utils.ts**

Add `validateDraftProjectForm()` that only requires `client_name`.
Update `validateProjectForm()` to also require delivery address fields.

**Step 5: Write unit test**

Create: `src/lib/projects/__tests__/utils.test.ts` (extend existing if present)
- Test `validateDraftProjectForm` accepts only client_name
- Test `validateProjectForm` rejects missing delivery address
- Test `validateProjectForm` accepts full form with delivery address

**Step 6: Commit**

```bash
git add src/app/(dashboard)/projects/actions.ts src/lib/projects/utils.ts src/lib/projects/__tests__/
git commit -m "feat: add draft project creation and delivery address validation"
```

---

## Task 4: Draft Projects — UI Changes

**Files:**
- Modify: `src/components/projects/project-form.tsx`
- Create: `src/components/projects/delivery-address-dialog.tsx`

**Step 1: Create delivery address dialog component**

```typescript
// Dialog with structured fields: Street, City, State, ZIP, Country (default US)
// Props: address (DeliveryAddress | null), onSave, onCancel
// US state dropdown using Select component
// All fields required when saving
// Returns DeliveryAddress object
```

**Step 2: Update project form**

In `src/components/projects/project-form.tsx`:
- Add delivery address state: `const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress | null>(null)`
- Add "Delivery Address" button that opens the dialog
- Show compact address summary after entry (e.g., "123 Main St, Atlanta, GA 30301")
- Add "Save as Draft" button next to existing "Create Project" button
- "Save as Draft" calls `createProject({ ...formData, is_draft: true })` with minimal validation
- "Create Project" validates delivery address is present, then calls `createProject({ ...formData, is_draft: false, delivery_street: ..., etc. })`
- When editing a draft project, show "Create Project" button (publishes the draft) instead of "Save as Draft"

**Step 3: Commit**

```bash
git add src/components/projects/delivery-address-dialog.tsx src/components/projects/project-form.tsx
git commit -m "feat: add delivery address dialog and draft project support to form"
```

---

## Task 5: Draft Projects — Table & Metrics Exclusion

**Files:**
- Modify: `src/components/projects/projects-table.tsx` (greyed-out rows)
- Modify: `src/app/actions/dashboard.ts` (exclude drafts from metrics)
- Modify: `src/components/projects/filter-popover.tsx` (draft filter toggle)

**Step 1: Grey out draft rows in projects table**

In `src/components/projects/projects-table.tsx`, add conditional class:
```typescript
className={cn(
  'cursor-pointer',
  project.is_draft && 'opacity-50'
)}
```

Add a "Draft" badge next to the project name for draft projects.

**Step 2: Exclude drafts from dashboard metrics**

In `src/app/actions/dashboard.ts` line ~56, update the projects query:
```typescript
supabase.from('projects').select(`*, current_status:statuses(*)`).eq('is_draft', false),
```

Also exclude drafts from status_history query by joining through projects.

**Step 3: Add draft filter to filter popover**

Add a "Show Drafts" toggle in the filter popover. Default: off (hide drafts). When on: show all projects including drafts.

**Step 4: Commit**

```bash
git add src/components/projects/projects-table.tsx src/app/actions/dashboard.ts src/components/projects/filter-popover.tsx
git commit -m "feat: grey out draft projects in table and exclude from metrics"
```

---

## Task 6: Email Template Customization — Types & Server Actions

**Files:**
- Create: `src/app/(dashboard)/admin/portal-builder/email-actions.ts`
- Modify: `src/hooks/queries/use-portal-templates.ts`

**Step 1: Create email template server actions**

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import type { PortalEmailTemplate, EmailStyleOverrides } from '@/types';

export async function getEmailTemplate(portalTemplateId: string): Promise<PortalEmailTemplate | null> {
  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from('portal_email_templates')
    .select('*')
    .eq('portal_template_id', portalTemplateId)
    .maybeSingle();
  return data;
}

export async function upsertEmailTemplate(
  portalTemplateId: string,
  updates: Partial<Omit<PortalEmailTemplate, 'id' | 'portal_template_id' | 'created_at' | 'updated_at'>>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from('portal_email_templates')
    .upsert({
      portal_template_id: portalTemplateId,
      ...updates,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'portal_template_id' });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function getEmailStyleForProject(projectId: string): Promise<EmailStyleOverrides | null> {
  // Resolve: project → project_type → portal_template → portal_email_templates
  // Returns null if no custom style (use defaults)
}

export async function sendTestEmail(portalTemplateId: string): Promise<{ success: boolean; error?: string }> {
  // Get current user email
  // Build a sample status change email with the template's overrides
  // Send via sendEmail()
}
```

**Step 2: Add TanStack Query hooks**

In `src/hooks/queries/use-portal-templates.ts`, add:
```typescript
export function useEmailTemplate(portalTemplateId: string | null) { ... }
export function useUpsertEmailTemplate() { ... }
export function useSendTestEmail() { ... }
```

**Step 3: Commit**

```bash
git add src/app/(dashboard)/admin/portal-builder/email-actions.ts src/hooks/queries/use-portal-templates.ts
git commit -m "feat: add email template server actions and hooks"
```

---

## Task 7: Email Template Customization — UI

**Files:**
- Modify: `src/app/(dashboard)/admin/portal-builder/page.tsx`
- Create: `src/components/admin/email-branding-section.tsx`
- Create: `src/components/admin/email-preview.tsx`

**Step 1: Create email branding section component**

```typescript
// EmailBrandingSection: Collapsible card in portal builder
// Props: portalTemplateId
// Fields: primary_color (color picker), button_color (color picker),
//         button_text_color (color picker), logo_url (text input), footer_text (textarea)
// Uses useEmailTemplate() hook to load, useUpsertEmailTemplate() to save
// Auto-saves on change (debounced) or explicit "Save" button
```

**Step 2: Create email preview component**

```typescript
// EmailPreview: iframe rendering a sample email
// Props: EmailStyleOverrides
// Renders a sample statusChangeEmail with the overrides in an iframe
// Updates live as colors/text change
```

**Step 3: Add "Send Test Email" button**

In the email branding section, add a button that calls `sendTestEmail(portalTemplateId)`.
Shows toast on success/failure.

**Step 4: Wire into portal builder page**

In `src/app/(dashboard)/admin/portal-builder/page.tsx`, add the `EmailBrandingSection` below the block list in Section 2 (Template Builder), inside the `CollapsibleContent` after the Save/Discard buttons. Only visible when a template is selected.

**Step 5: Commit**

```bash
git add src/components/admin/email-branding-section.tsx src/components/admin/email-preview.tsx src/app/(dashboard)/admin/portal-builder/page.tsx
git commit -m "feat: add email branding UI with live preview and test email"
```

---

## Task 8: Email Template Rendering Changes

**Files:**
- Modify: `src/lib/email/templates.ts`

**Step 1: Update baseTemplate to accept style overrides**

```typescript
interface BaseTemplateOptions {
  previewText?: string;
  style?: EmailStyleOverrides;  // NEW
}

function baseTemplate(content: string, options: BaseTemplateOptions = {}): string {
  const colors = {
    primary: options.style?.primaryColor || BRAND_COLORS.primary,
    background: BRAND_COLORS.background,
    text: BRAND_COLORS.text,
    muted: BRAND_COLORS.muted,
  };
  const logoUrl = options.style?.logoUrl || LOGO_URL;
  const footerText = options.style?.footerText || '';
  const buttonColor = options.style?.buttonColor || colors.primary;
  const buttonTextColor = options.style?.buttonTextColor || '#ffffff';

  // Use these variables in the template HTML instead of hardcoded values
  // ...
}
```

**Step 2: Update button() to accept colors**

```typescript
function button(text: string, url: string, style?: EmailStyleOverrides): string {
  const bgColor = style?.buttonColor || BRAND_COLORS.primary;
  const textColor = style?.buttonTextColor || '#ffffff';
  // ... use in template
}
```

**Step 3: Update all email template functions**

Add optional `style?: EmailStyleOverrides` parameter to:
- `statusChangeEmail`
- `welcomeEmail`
- `assignmentCreatedEmail`
- `assignmentStatusChangedEmail`
- `assignmentReminderEmail`
- `confirmationEmailTemplate`
- `pmConfirmationResponseEmailTemplate`

Pass `style` through to `baseTemplate()` and `button()`.

**Step 4: Add new email templates for file upload notifications**

```typescript
export function fileUploadNotificationEmail(options: {
  projectName: string;
  fileName: string;
  uploaderInfo: string;
  approvalDashboardUrl: string;
  style?: EmailStyleOverrides;
}): string { ... }

export function fileApprovedEmail(options: {
  clientName: string;
  fileName: string;
  portalUrl: string;
  style?: EmailStyleOverrides;
}): string { ... }

export function fileRejectedEmail(options: {
  clientName: string;
  fileName: string;
  rejectionNote: string;
  portalUrl: string;
  style?: EmailStyleOverrides;
}): string { ... }
```

**Step 5: Write unit tests for email templates**

Create: `src/lib/email/__tests__/templates.test.ts`
- Test baseTemplate with no overrides uses default brand colors
- Test baseTemplate with overrides uses custom colors
- Test button() with custom colors
- Test fileApprovedEmail generates correct HTML
- Test fileRejectedEmail includes rejection note
- Test all HTML escaping still works with overrides

**Step 6: Commit**

```bash
git add src/lib/email/templates.ts src/lib/email/__tests__/templates.test.ts
git commit -m "feat: email templates support per-portal style overrides"
```

---

## Task 9: File Upload — Security Utilities

**Files:**
- Create: `src/lib/portal/file-security.ts`
- Create: `src/lib/portal/__tests__/file-security.test.ts`

**Step 1: Install dependencies**

```bash
npm install file-type sharp
npm install -D @types/sharp
```

**Step 2: Write failing tests first**

```typescript
// src/lib/portal/__tests__/file-security.test.ts
import { describe, it, expect } from 'vitest';
import {
  validateFileType,
  sanitizeFilename,
  validateFileSize,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '../file-security';

describe('validateFileType', () => {
  it('accepts PDF files with correct magic bytes', async () => { ... });
  it('rejects .exe renamed to .pdf', async () => { ... });
  it('accepts PNG files', async () => { ... });
  it('accepts JPG files', async () => { ... });
  it('accepts EPS files', async () => { ... });
  it('rejects .js files', async () => { ... });
});

describe('sanitizeFilename', () => {
  it('strips path traversal attempts', () => {
    expect(sanitizeFilename('../../../etc/passwd')).not.toContain('..');
  });
  it('strips null bytes', () => {
    expect(sanitizeFilename('file\x00.pdf')).not.toContain('\x00');
  });
  it('truncates to 100 chars', () => {
    const long = 'a'.repeat(200) + '.pdf';
    expect(sanitizeFilename(long).length).toBeLessThanOrEqual(104); // 100 + .pdf
  });
  it('prefixes with timestamp', () => {
    expect(sanitizeFilename('test.pdf')).toMatch(/^\d+_test\.pdf$/);
  });
  it('strips special characters', () => {
    expect(sanitizeFilename('file<>:"|?*.pdf')).toBe(expect.stringContaining('file'));
  });
});

describe('validateFileSize', () => {
  it('accepts 3MB file', () => {
    expect(validateFileSize(3 * 1024 * 1024)).toBe(true);
  });
  it('rejects 4MB file', () => {
    expect(validateFileSize(4 * 1024 * 1024)).toBe(false);
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `npm test -- src/lib/portal/__tests__/file-security.test.ts`
Expected: FAIL (module not found)

**Step 4: Implement file security module**

```typescript
// src/lib/portal/file-security.ts
import { fileTypeFromBuffer } from 'file-type';

export const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024; // 3MB

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/postscript', // EPS
  'image/x-eps',
] as const;

export const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.eps'] as const;

export async function validateFileType(buffer: Buffer, filename: string): Promise<{
  valid: boolean;
  mimeType?: string;
  error?: string;
}> {
  // 1. Check extension
  const ext = filename.toLowerCase().split('.').pop();
  if (!ALLOWED_EXTENSIONS.some(e => e === `.${ext}`)) {
    return { valid: false, error: `File type .${ext} is not allowed` };
  }

  // 2. Check magic bytes
  const type = await fileTypeFromBuffer(buffer);
  if (!type) {
    // EPS files may not have detectable magic bytes — check for %!PS header
    if (ext === 'eps' && buffer.toString('ascii', 0, 4) === '%!PS') {
      return { valid: true, mimeType: 'application/postscript' };
    }
    return { valid: false, error: 'Could not determine file type from content' };
  }

  if (!ALLOWED_MIME_TYPES.includes(type.mime as any)) {
    return { valid: false, error: `File content is ${type.mime}, which is not allowed` };
  }

  return { valid: true, mimeType: type.mime };
}

export function sanitizeFilename(filename: string): string {
  // Strip path components
  let clean = filename.replace(/^.*[\\/]/, '');
  // Strip null bytes and control chars
  clean = clean.replace(/[\x00-\x1f\x80-\x9f]/g, '');
  // Strip special chars
  clean = clean.replace(/[<>:"|?*]/g, '');
  // Strip path traversal
  clean = clean.replace(/\.\./g, '');
  // Get extension
  const lastDot = clean.lastIndexOf('.');
  const ext = lastDot > 0 ? clean.substring(lastDot) : '';
  const name = lastDot > 0 ? clean.substring(0, lastDot) : clean;
  // Truncate name to 100 chars
  const truncated = name.substring(0, 100);
  // Prefix with timestamp
  return `${Date.now()}_${truncated}${ext}`;
}

export function validateFileSize(sizeBytes: number): boolean {
  return sizeBytes <= MAX_FILE_SIZE_BYTES;
}

export async function stripExifData(buffer: Buffer, mimeType: string): Promise<Buffer> {
  if (mimeType === 'image/jpeg' || mimeType === 'image/png') {
    const sharp = (await import('sharp')).default;
    return sharp(buffer).rotate().toBuffer(); // rotate() strips EXIF
  }
  return buffer;
}
```

**Step 5: Run tests**

Run: `npm test -- src/lib/portal/__tests__/file-security.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/portal/ package.json package-lock.json
git commit -m "feat: add file security utilities (type validation, sanitization, EXIF stripping)"
```

---

## Task 10: File Upload — API Route

**Files:**
- Create: `src/app/api/portal/upload/route.ts`
- Create: `src/lib/portal/rate-limit.ts`

**Step 1: Create rate limiter**

```typescript
// src/lib/portal/rate-limit.ts
// In-memory rate limiter: 10 uploads per hour per portal token
// Same pattern as existing rate limiter in src/app/status/[token]/page.tsx
const uploadRateLimitMap = new Map<string, { count: number; resetTime: number }>();
const UPLOAD_RATE_LIMIT = 10;
const UPLOAD_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function checkUploadRateLimit(token: string): boolean { ... }
```

**Step 2: Create upload API route**

```typescript
// src/app/api/portal/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { validateFileType, sanitizeFilename, validateFileSize, stripExifData } from '@/lib/portal/file-security';
import { checkUploadRateLimit } from '@/lib/portal/rate-limit';
import { getSharePointClient } from '@/lib/sharepoint/client';
import { getGlobalSharePointConfig, getMicrosoftConnection } from '@/app/(dashboard)/projects/[salesOrder]/files/actions';
import { sendEmail } from '@/lib/email/send';
import { fileUploadNotificationEmail } from '@/lib/email/templates';

export async function POST(request: NextRequest) {
  // 1. Parse multipart form data: token, blockId, slotIndex, file
  // 2. Validate token → get project (must not be draft)
  // 3. Rate limit check
  // 4. Validate file size
  // 5. Read file buffer, validate file type (magic bytes)
  // 6. Strip EXIF if image
  // 7. Sanitize filename
  // 8. Get SharePoint client (admin's Microsoft connection)
  // 9. Upload to SharePoint: {project_folder}/client_uploads/{filename}
  // 10. Insert portal_file_uploads row
  // 11. Get customer_approval_user_id from app_settings
  // 12. Create customer_approval_tasks row
  // 13. Send notification email to approval user
  // 14. Return success with upload ID
}
```

**Step 3: Commit**

```bash
git add src/app/api/portal/upload/route.ts src/lib/portal/rate-limit.ts
git commit -m "feat: add portal file upload API route with security checks"
```

---

## Task 11: File Upload — Portal Block Components

**Files:**
- Create: `src/components/portal/blocks/file-upload-block.tsx`
- Modify: `src/components/portal/blocks/block-renderer.tsx`
- Modify: `src/app/status/[token]/page.tsx`

**Step 1: Create file upload block component**

```typescript
// FileUploadBlock: Client component for the public portal
// Props: blockConfig (files array), projectToken, projectId, blockId
// For each file slot:
//   - Shows label + description
//   - If status=pending: drag-and-drop upload zone
//   - If status=uploaded: "Pending review" badge + filename
//   - If status=approved: green checkmark + filename (locked)
//   - If status=rejected: rejection note + re-upload button
// Client-side validation: extension allowlist, 3MB limit
// Upload via fetch() to /api/portal/upload
```

**Step 2: Update block renderer**

In `src/components/portal/blocks/block-renderer.tsx`:
- Import `FileUploadBlock`
- Add case `'file_upload'` to the switch
- Pass `block.config?.files`, token, projectId, blockId

**Step 3: Update portal page data fetching**

In `src/app/status/[token]/page.tsx`:
- Fetch `portal_file_uploads` for this project
- Pass file upload data to `BlockRenderer` via `PortalProjectData`
- Add `token` to data so `FileUploadBlock` can use it for API calls

**Step 4: Commit**

```bash
git add src/components/portal/blocks/file-upload-block.tsx src/components/portal/blocks/block-renderer.tsx src/app/status/[token]/page.tsx
git commit -m "feat: add file upload block to portal with drag-and-drop upload"
```

---

## Task 12: File Upload — Portal Builder Integration

**Files:**
- Modify: `src/app/(dashboard)/admin/portal-builder/page.tsx`

**Step 1: Add file_upload and delivery_address_confirmation to BLOCK_TYPE_CONFIG**

```typescript
import { Upload, MapPin } from 'lucide-react';

// Add to BLOCK_TYPE_CONFIG:
file_upload: {
  label: 'File Upload',
  icon: Upload,
  description: 'Request files from customer',
},
delivery_address_confirmation: {
  label: 'Address Confirmation',
  icon: MapPin,
  description: 'Customer confirms delivery address',
},
```

**Step 2: Add expandable config for file_upload blocks**

In `SortableBlockRow`, add config UI for `file_upload` type (similar to `custom_html`):
- File Label 1 (Input, required)
- Description 1 (Textarea, required)
- File Label 2 (Input, optional)
- Description 2 (Textarea, conditional on label 2)

**Step 3: Commit**

```bash
git add src/app/(dashboard)/admin/portal-builder/page.tsx
git commit -m "feat: add file upload and address confirmation blocks to portal builder"
```

---

## Task 13: Customer Approval — Admin Settings

**Files:**
- Modify: `src/app/(dashboard)/admin/settings/page.tsx`
- Create: `src/app/(dashboard)/admin/settings/approval-actions.ts`

**Step 1: Create approval settings server actions**

```typescript
'use server';

export async function getApprovalUserId(): Promise<string | null> {
  // Query app_settings where key = 'customer_approval_user_id'
  // Return the user ID or null
}

export async function setApprovalUserId(userId: string): Promise<{ success: boolean; error?: string }> {
  // Upsert app_settings key 'customer_approval_user_id'
}

export async function getApprovalCandidates(): Promise<Profile[]> {
  // Return profiles where role IN ('admin', 'editor')
}
```

**Step 2: Add "Customer Approvals" section to admin settings page**

After the existing SharePoint section, add a new Card:
- Title: "Customer Approvals"
- Description: "Select the user responsible for reviewing customer-uploaded files"
- Select dropdown populated with admin/editor profiles
- Current selection loaded from `getApprovalUserId()`
- On change: call `setApprovalUserId()`

**Step 3: Commit**

```bash
git add src/app/(dashboard)/admin/settings/page.tsx src/app/(dashboard)/admin/settings/approval-actions.ts
git commit -m "feat: add customer approval user setting in admin panel"
```

---

## Task 14: Customer Approval — Dashboard Page

**Files:**
- Create: `src/app/(dashboard)/approvals/page.tsx`
- Create: `src/app/(dashboard)/approvals/actions.ts`
- Create: `src/hooks/queries/use-approval-tasks.ts`
- Modify: `src/components/layout/sidebar.tsx`

**Step 1: Create approval server actions**

```typescript
'use server';

export async function getApprovalTasks(filter: 'pending' | 'approved' | 'rejected' | 'all'): Promise<CustomerApprovalTask[]> {
  // Join: customer_approval_tasks → portal_file_uploads → projects
  // Filter by status if not 'all'
  // Order by created_at desc
}

export async function getPendingApprovalCount(): Promise<number> {
  // Count where status = 'pending' and assigned_to = current user
}

export async function approveFile(taskId: string): Promise<{ success: boolean; error?: string }> {
  // 1. Update customer_approval_tasks: status=approved, completed_at=now
  // 2. Update portal_file_uploads: upload_status=approved, reviewed_by, reviewed_at
  // 3. Get project + email style overrides
  // 4. Send approval email to customer (poc_email)
  // 5. Revalidate /approvals
}

export async function rejectFile(taskId: string, note: string): Promise<{ success: boolean; error?: string }> {
  // 1. Validate note is not empty
  // 2. Update customer_approval_tasks: status=rejected, note, completed_at=now
  // 3. Update portal_file_uploads: upload_status=rejected, rejection_note, reviewed_by, reviewed_at
  // 4. Get project + email style overrides
  // 5. Send rejection email to customer with note
  // 6. Revalidate /approvals
}
```

**Step 2: Create TanStack Query hooks**

```typescript
// src/hooks/queries/use-approval-tasks.ts
export function useApprovalTasks(filter: string) { ... }
export function usePendingApprovalCount() { ... }
export function useApproveFile() { ... }
export function useRejectFile() { ... }
```

**Step 3: Create approvals page**

```typescript
// src/app/(dashboard)/approvals/page.tsx
// Tabs: Pending | Approved | Rejected
// Table: Project Name, Filename, Uploaded At, Status
// Click row → detail dialog:
//   - File preview (img tag for PNG/JPG, PDF icon for PDF/EPS)
//   - Download link (sharepoint_web_url)
//   - Project link (/projects/{salesOrder})
//   - Approve button (green)
//   - Reject button (red) → shows textarea for note (required)
// Access: only visible if current user is approval user or admin
```

**Step 4: Add to sidebar**

In `src/components/layout/sidebar.tsx`:

Add to `adminNavItems` array:
```typescript
{
  title: 'Approvals',
  href: '/approvals',
  icon: CheckSquare, // from lucide-react
},
```

Add pending count badge (same pattern as overdue todo count):
```typescript
const { data: pendingApprovalCount } = usePendingApprovalCount();
// Pass as badge prop to the Approvals nav item
```

**Step 5: Commit**

```bash
git add src/app/(dashboard)/approvals/ src/hooks/queries/use-approval-tasks.ts src/components/layout/sidebar.tsx
git commit -m "feat: add customer approval dashboard with approve/reject workflow"
```

---

## Task 15: Delivery Address Confirmation — API Route

**Files:**
- Create: `src/app/api/portal/confirm-address/route.ts`

**Step 1: Create the confirmation API route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const { token, email } = await request.json();

  // 1. Validate token → get project
  const supabase = createServiceClient();
  const { data: project } = await supabase
    .from('projects')
    .select('id, poc_email, delivery_street, delivery_city, delivery_state, delivery_zip, delivery_country')
    .eq('client_token', token)
    .single();

  if (!project) return NextResponse.json({ error: 'Invalid token' }, { status: 404 });

  // 2. Check email matches poc_email (case-insensitive)
  if (email.toLowerCase().trim() !== project.poc_email?.toLowerCase().trim()) {
    return NextResponse.json({ error: 'Email does not match our records. Please try again.' }, { status: 403 });
  }

  // 3. Check not already confirmed
  const { data: existing } = await supabase
    .from('delivery_address_confirmations')
    .select('id')
    .eq('project_id', project.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ success: true, alreadyConfirmed: true });
  }

  // 4. Check address exists
  if (!project.delivery_street) {
    return NextResponse.json({ error: 'Delivery address not yet available' }, { status: 400 });
  }

  // 5. Insert confirmation with address snapshot
  const { error } = await supabase
    .from('delivery_address_confirmations')
    .insert({
      project_id: project.id,
      confirmed_by_email: email.toLowerCase().trim(),
      address_snapshot: {
        street: project.delivery_street,
        city: project.delivery_city,
        state: project.delivery_state,
        zip: project.delivery_zip,
        country: project.delivery_country,
      },
    });

  if (error) return NextResponse.json({ error: 'Failed to confirm' }, { status: 500 });

  return NextResponse.json({ success: true });
}
```

**Step 2: Commit**

```bash
git add src/app/api/portal/confirm-address/route.ts
git commit -m "feat: add delivery address confirmation API route"
```

---

## Task 16: Delivery Address Confirmation — Portal Block

**Files:**
- Create: `src/components/portal/blocks/delivery-address-confirmation-block.tsx`
- Modify: `src/components/portal/blocks/block-renderer.tsx`
- Modify: `src/app/status/[token]/page.tsx`

**Step 1: Create the block component**

```typescript
'use client';

// DeliveryAddressConfirmationBlock
// Props: project (with delivery address fields), token, confirmation (existing or null)
//
// States:
// 1. No address: "Delivery address not yet available"
// 2. Not confirmed: Show address + email input + "Confirm" button
// 3. Confirming: Loading state
// 4. Email mismatch: Error message + retry
// 5. Confirmed: Green checkmark + "Address confirmed on {date}"
//    + "If this address is incorrect, please contact jason@amitrace.com"
```

**Step 2: Update block renderer**

Add `'delivery_address_confirmation'` case to the switch in `block-renderer.tsx`.
Pass project, token, and confirmation data.

**Step 3: Update portal page data fetching**

In `src/app/status/[token]/page.tsx`:
- Fetch `delivery_address_confirmations` for this project
- Pass to `PortalProjectData`

**Step 4: Commit**

```bash
git add src/components/portal/blocks/delivery-address-confirmation-block.tsx src/components/portal/blocks/block-renderer.tsx src/app/status/[token]/page.tsx
git commit -m "feat: add delivery address confirmation block to portal"
```

---

## Task 17: Puppeteer E2E Test Setup

**Files:**
- Create: `e2e/puppeteer/jest.config.ts`
- Create: `e2e/puppeteer/jest-puppeteer.config.ts`
- Create: `e2e/puppeteer/helpers/setup.ts`
- Create: `e2e/puppeteer/helpers/portal.ts`
- Modify: `package.json` (add script + devDependencies)

**Step 1: Install Puppeteer + Jest dependencies**

```bash
npm install -D puppeteer jest @types/jest ts-jest jest-puppeteer @types/jest-puppeteer
```

**Step 2: Create Jest config**

```typescript
// e2e/puppeteer/jest.config.ts
export default {
  preset: 'jest-puppeteer',
  transform: { '^.+\\.tsx?$': 'ts-jest' },
  testMatch: ['<rootDir>/e2e/puppeteer/**/*.test.ts'],
  globalSetup: './e2e/puppeteer/helpers/setup.ts',
  testTimeout: 30000,
};
```

**Step 3: Create jest-puppeteer config**

```typescript
// e2e/puppeteer/jest-puppeteer.config.ts
export default {
  launch: { headless: true, args: ['--no-sandbox'] },
  server: { command: 'npm run dev', port: 3000, launchTimeout: 60000, usedPortAction: 'ignore' },
};
```

**Step 4: Create test helpers**

```typescript
// e2e/puppeteer/helpers/setup.ts
// Global setup: ensure dev server is running, create test data in Supabase

// e2e/puppeteer/helpers/portal.ts
// Helper: createTestProject() → returns { projectId, token }
// Helper: navigateToPortal(page, token)
// Helper: loginAsAdmin(page)
// Helper: loginAsApprovalUser(page)
```

**Step 5: Add npm script**

In `package.json`:
```json
"test:e2e:puppeteer": "jest --config e2e/puppeteer/jest.config.ts"
```

**Step 6: Commit**

```bash
git add e2e/puppeteer/ package.json package-lock.json
git commit -m "feat: add Puppeteer E2E test infrastructure"
```

---

## Task 18: E2E Tests — Draft Projects

**Files:**
- Create: `e2e/puppeteer/draft-projects.test.ts`

**Step 1: Write tests**

```typescript
describe('Draft Projects', () => {
  it('creates a draft with only client name', async () => {
    // Navigate to /projects/new
    // Fill only client_name
    // Click "Save as Draft"
    // Verify redirect to projects list
    // Verify project appears greyed out
  });

  it('rejects creating non-draft without delivery address', async () => {
    // Fill form without delivery address
    // Click "Create Project"
    // Verify validation error for delivery address
  });

  it('publishes a draft with all required fields', async () => {
    // Navigate to draft project edit
    // Fill all required fields including delivery address
    // Click "Create Project"
    // Verify is_draft = false
    // Verify status changed from Draft
  });

  it('excludes drafts from dashboard metrics', async () => {
    // Create draft with sales_amount
    // Navigate to dashboard
    // Verify pipeline value does NOT include draft amount
  });
});
```

**Step 2: Commit**

```bash
git add e2e/puppeteer/draft-projects.test.ts
git commit -m "test: add Puppeteer E2E tests for draft projects"
```

---

## Task 19: E2E Tests — Delivery Address

**Files:**
- Create: `e2e/puppeteer/delivery-address.test.ts`

**Step 1: Write tests**

```typescript
describe('Delivery Address', () => {
  it('opens address dialog and saves structured address', async () => {
    // Click "Delivery Address" in form
    // Fill street, city, state, zip
    // Save
    // Verify compact summary shown
  });

  it('allows draft without address', async () => {
    // Save as draft without address
    // Verify success
  });

  it('requires address for non-draft creation', async () => {
    // Fill all fields except address
    // Click "Create Project"
    // Verify error about delivery address
  });
});
```

**Step 2: Commit**

```bash
git add e2e/puppeteer/delivery-address.test.ts
git commit -m "test: add Puppeteer E2E tests for delivery address"
```

---

## Task 20: E2E Tests — Email Templates

**Files:**
- Create: `e2e/puppeteer/email-templates.test.ts`

**Step 1: Write tests**

```typescript
describe('Email Template Customization', () => {
  it('shows email branding section in portal builder', async () => {
    // Login as admin
    // Navigate to /admin/portal-builder
    // Select a template
    // Verify "Email Branding" section visible
  });

  it('updates colors and shows preview', async () => {
    // Change primary color
    // Verify preview iframe updates
  });

  it('sends test email', async () => {
    // Click "Send Test Email"
    // Verify success toast
  });
});
```

**Step 2: Commit**

```bash
git add e2e/puppeteer/email-templates.test.ts
git commit -m "test: add Puppeteer E2E tests for email template customization"
```

---

## Task 21: E2E Tests — File Upload

**Files:**
- Create: `e2e/puppeteer/file-upload-block.test.ts`

**Step 1: Write tests**

```typescript
describe('File Upload Block', () => {
  it('configures file upload block in portal builder', async () => {
    // Add file_upload block
    // Set label and description
    // Save template
  });

  it('uploads a valid PDF on the portal', async () => {
    // Navigate to portal with file upload block
    // Upload a test PDF file
    // Verify "Pending review" state shown
  });

  it('rejects a file over 3MB', async () => {
    // Try to upload 4MB file
    // Verify client-side error message
  });

  it('rejects invalid file type', async () => {
    // Upload a .txt file
    // Verify error message
  });

  it('allows re-upload after rejection', async () => {
    // Setup: reject a file via API
    // Navigate to portal
    // Verify rejection note shown
    // Re-upload new file
    // Verify new "Pending review" state
  });
});
```

**Step 2: Commit**

```bash
git add e2e/puppeteer/file-upload-block.test.ts
git commit -m "test: add Puppeteer E2E tests for file upload block"
```

---

## Task 22: E2E Tests — Customer Approvals

**Files:**
- Create: `e2e/puppeteer/customer-approvals.test.ts`

**Step 1: Write tests**

```typescript
describe('Customer Approvals', () => {
  it('sets approval user in admin settings', async () => {
    // Login as admin
    // Navigate to /admin/settings
    // Select user from dropdown
    // Verify saved
  });

  it('shows pending tasks on approval dashboard', async () => {
    // Setup: upload file via API
    // Login as approval user
    // Navigate to /approvals
    // Verify pending task visible
  });

  it('approves a file', async () => {
    // Click row → approve
    // Verify status changes to approved
  });

  it('rejects without note shows error', async () => {
    // Click reject → submit without note
    // Verify required note error
  });

  it('rejects with note', async () => {
    // Click reject → enter note → submit
    // Verify status changes to rejected
    // Verify note saved
  });
});
```

**Step 2: Commit**

```bash
git add e2e/puppeteer/customer-approvals.test.ts
git commit -m "test: add Puppeteer E2E tests for customer approval workflow"
```

---

## Task 23: E2E Tests — Address Confirmation

**Files:**
- Create: `e2e/puppeteer/address-confirmation.test.ts`

**Step 1: Write tests**

```typescript
describe('Address Confirmation Block', () => {
  it('shows address on portal', async () => {
    // Create project with delivery address
    // Navigate to portal with address confirmation block
    // Verify address displayed
  });

  it('rejects wrong email', async () => {
    // Enter wrong email
    // Click confirm
    // Verify error: "Email does not match our records"
  });

  it('confirms with correct email', async () => {
    // Enter correct poc_email
    // Click confirm
    // Verify green checkmark + confirmed date
  });

  it('shows confirmed state on revisit', async () => {
    // After confirmation, navigate away and back
    // Verify still shows confirmed state
    // Verify no re-confirm option
    // Verify contact message for wrong address
  });

  it('shows not available when no address set', async () => {
    // Create project without address (draft)
    // Navigate to portal
    // Verify "Delivery address not yet available"
  });
});
```

**Step 2: Commit**

```bash
git add e2e/puppeteer/address-confirmation.test.ts
git commit -m "test: add Puppeteer E2E tests for address confirmation block"
```

---

## Task 24: Final Integration & Verification

**Step 1: Run all unit tests**

```bash
npm test
```

Expected: All existing + new tests pass.

**Step 2: Run linter**

```bash
npm run lint
```

Expected: No new lint errors.

**Step 3: Build check**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

**Step 4: Final commit**

If any fixes were needed:
```bash
git add -A
git commit -m "fix: resolve integration issues from portal customization features"
```
