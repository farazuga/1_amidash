# Features

## Project Management

### Project Lifecycle
Projects flow through configurable statuses: PO Received → Engineering Review → In Procurement → Pending Scheduling → Scheduled → IP (In Progress) → Hold → Invoiced.

### Project Creation
- Manual entry or auto-populate from Odoo sales order (S1XXXX format)
- Auto-detection of project type from line items:
  - Contains "install" → **Solution**
  - Contains "ami_vidpod" (no install) → **VidPod** (quantity auto-filled)
  - Neither → **Box Sale**
- AI-generated project description from line items (Claude API)
- Draft mode for work-in-progress projects (not visible in default filters)

### Project Detail
- Inline editing for all fields
- Status history timeline
- Quick info panel (sales amount, PO number, invoice status, Odoo link)
- Delivery address management
- Contact selector (primary + secondary POC)
- File management tab
- Project-specific calendar view

### Project List
- Filterable by status, type, salesperson, tags, date range
- Searchable by client name, sales order number
- Sortable columns
- Draft/active toggle

## Calendar & Scheduling

### Master Calendar
- Weekday-only grid (Mon-Fri)
- Resource rows per team member
- Booking statuses: Draft → Tentative → Pending Confirmation → Confirmed
- Today indicator (vertical red line)

### Interactions
- **Drag & drop**: Move assignments between days/users
- **Cmd+drag**: Copy assignment to new day
- **Option+click**: Delete assignment day
- **Cmd+Z**: Undo last action (10-action stack)
- Bulk assignment dialog for multiple users
- Date exclusion (skip specific dates in a range)

### Gantt View
- Project-level timeline bars
- Color-coded by booking status
- Navigation between weeks/months
- Filter by status, project type

### My Schedule
- Personal view of current user's assignments
- Week view with time blocks

### Status Cascade
When changing a project's schedule status, optionally cascade to all assignment booking statuses.

### Confirmation Requests
Send email to customer with link to confirm project schedule. Customer sees dates and can confirm or request changes.

## L10 Meetings (EOS)

### Meeting Runner
Timed 90-minute meeting with 7 segments:
1. **Segue** (5 min) - Personal/professional good news
2. **Scorecard Review** (5 min) - KPI metrics review
3. **Rock Review** (5 min) - Quarterly goal progress
4. **Headlines** (5 min) - Customer/employee updates
5. **To-Do Review** (5 min) - Action item follow-up
6. **IDS** (60 min) - Identify, Discuss, Solve issues
7. **Conclude** (5 min) - Recap and rating

### Scorecard
- Custom measurables with goals (above/below/exact targets)
- Auto-populate sources: PO revenue, invoiced revenue, open projects, Odoo account balance, Odoo open quotes
- Weekly/monthly tracking with trend visualization
- Units: number, currency, percentage

### Rocks (Quarterly Goals)
- Track on/off track status
- Milestones with due dates and completion
- Owner assignment
- Comments thread

### Issues (IDS)
- Priority ranking (drag to reorder)
- Move between Short-term, Long-term, and Solved columns
- Create from any context (project, rock, scorecard)
- Source metadata linking

### Todos
- Owner + due date
- Created from meetings or standalone
- My Todos page for personal view
- Comment threads

### Headlines
- Category: Customer, Employee, Industry
- Sentiment: Positive, Neutral, Negative
- Surfaced in meeting segue segment

### Teams
- Multiple L10 teams per organization
- Team member roles
- Team-scoped data (rocks, issues, todos, scorecard)

### Realtime Collaboration
- Supabase Realtime subscriptions on all L10 tables
- Automatic query invalidation when data changes
- Multi-user meeting participation

## Customer Portal

### Public Portal Page (`/status/[token]`)
Token-based access (no login required). Configurable block layout:

- **Current Status Block** - Animated status display with progress
- **Status History Block** - Timeline of status changes
- **Customer Schedule Block** - View scheduled dates
- **Delivery Address Confirmation Block** - Confirm/update delivery address
- **File Upload Block** - Upload photos/documents (rate limited, EXIF stripped)
- **POC Info Block** - Contact information display
- **Custom HTML Block** - Admin-defined content

### Portal Builder (Admin)
- Drag-and-drop block ordering
- Enable/disable individual blocks
- Custom email templates (welcome, status change)
- Background image configuration
- Per-project portal customization

### Customer Authentication
- Separate customer role with email/password login
- Can view own projects only (RLS enforced)
- Email notification preferences (opt in/out)

## File Management

### Project Files
- Upload to Supabase storage or SharePoint
- Categories: Schematics, SOW, Media, Other
- Camera capture with custom UI (mobile)
- Thumbnail generation
- File browser with category tabs

### SharePoint Integration
- Connect project to SharePoint site/folder
- Browse SharePoint folders from dashboard
- Upload directly to SharePoint
- Admin configurable default site

### Offline Support (PWA)
- Service worker registration
- IndexedDB for offline file capture
- Sync manager for upload queue
- Offline indicator page

## Dashboard

### Overview
- Project count by status (pie chart)
- Revenue tracking (monthly bar chart)
- Overdue project alerts
- Lazy-loaded charts for performance

### Revenue Goals
- Monthly/yearly targets
- PO received vs invoiced tracking
- Progress indicators

## Email Notifications

### Templates
- Welcome email (new customer onboarding)
- Status change notification (project updates)
- Custom branding (logo, colors, support contact)
- Portal link with token

### Controls
- Global enable/disable
- Per-project enable/disable
- Per-recipient opt-out
- Email preview in admin

## Admin

### User Management
- Create/edit/delete users
- Role assignment (admin, editor, viewer, customer)
- Password reset

### Settings
- Approval workflow rules
- SharePoint default configuration
- Email branding
- Portal builder

### Audit Log
- Track all project changes
- User attribution
- Timestamp history

## Approvals
- Customer approval tasks for deliverables
- Approve/reject workflow
- Admin queue view

## Digital Signage
- Separate `signage-engine/` Next.js app
- Lobby display for project status
- Auto-refresh with configurable intervals
- 4K readability optimized
