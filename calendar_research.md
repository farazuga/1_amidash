# Engineering Resource Scheduling System
## Solution Specification Document

---

## 1. Overview

A scheduling system for a PM to allocate 6 engineers across ~50 projects, with customer confirmation workflow and engineer visibility.

### Key Characteristics

| Aspect | Specification |
|--------|---------------|
| Team Size | 1 PM, 6 Engineers |
| Projects | ~50 concurrent |
| Time Granularity | Hourly blocks |
| Working Hours | 7:00 AM - 4:00 PM (9 hours/day) |
| Scheduling Style | Specific start/end times |
| Minimum Booking | 1 hour |
| Multiple Engineers | Yes - same project, same time slot |

---

## 2. Status Workflow

### Five Booking Statuses

| Status | Color | Visibility | Description |
|--------|-------|------------|-------------|
| **Draft** | Blue | PM only | PM's private scratchpad for planning |
| **Tentative** | Yellow/Orange | PM + Engineers | Planned but not yet sent to customer |
| **Pending Confirmation** | Purple | PM + Engineers | Sent to customer, awaiting response |
| **Confirmed** | Green | PM + Engineers | Customer confirmed, locked in |
| **Complete** | Gray | PM + Engineers | Work finished |

### State Transitions

```
                              ┌─────────────────────────────────┐
                              │                                 │
                              ▼                                 │
┌────────┐    ┌───────────┐    ┌─────────────────┐    ┌───────────┐    ┌──────────┐
│ DRAFT  │───▶│ TENTATIVE │───▶│    PENDING      │───▶│ CONFIRMED │───▶│ COMPLETE │
│  Blue  │    │  Yellow   │    │     Purple      │    │   Green   │    │   Gray   │
└────────┘    └───────────┘    └─────────────────┘    └───────────┘    └──────────┘
   PM only       Visible to        Awaiting             Locked in         Done
                 engineers         customer
                      ▲                │
                      │                │ Customer declines
                      └────────────────┘ (with optional message)
```

### Allowed Transitions

- Draft → Tentative → Pending → Confirmed → Complete
- Pending → Tentative (if customer declines)
- PM can skip Draft and start at Tentative
- PM can move directly to Confirmed (if verbal confirmation received)

---

## 3. User Roles & Views

### 3.1 Project Manager (PM)

#### Primary View: Weekly Calendar

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ◀ Week of Dec 30, 2024 ▶                    [Day] [Week] [Month]       │
├─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────────┤
│  Time   │   Mon   │   Tue   │   Wed   │   Thu   │   Fri   │   Filters   │
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤─────────────┤
│  7:00   │░░░░░░░░░│         │░░░░░░░░░│         │         │ Engineers:  │
│         │ Jason   │         │ Jason   │         │         │ ☑ All       │
│         │ Proj A  │         │ Proj A  │         │         │ ☐ Jason     │
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤ ☐ Mike      │
│  8:00   │░░░░░░░░░│▓▓▓▓▓▓▓▓▓│░░░░░░░░░│▓▓▓▓▓▓▓▓▓│         │             │
│         │ Jason   │ Mike    │ Jason   │ Mike    │         │ Status:     │
│         │ Proj A  │ Proj B  │ Proj A  │ Proj B  │         │ ☑ Draft     │
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤ ☑ Tentative │
│  9:00   │         │▓▓▓▓▓▓▓▓▓│         │▓▓▓▓▓▓▓▓▓│███████ │ ☑ Pending   │
│         │         │ Mike    │         │ Mike    │ Sarah  │ ☑ Confirmed │
│         │         │ Proj B  │         │ Proj B  │ Proj C │             │
├─────────┴─────────┴─────────┴─────────┴─────────┴─────────┤ Projects:   │
│                                                           │ ☑ All       │
│  Legend:  ░░░ Draft  ▓▓▓ Tentative  ▒▒▒ Pending  ███ Confirmed        │
└───────────────────────────────────────────────────────────┴─────────────┘
```

#### Secondary View: Resource View (All Engineers)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Week of Dec 30, 2024                                                   │
├─────────┬───────────────────────────────────────────────────────────────┤
│ Jason   │ ░░Proj A░░│          │░░Proj A░░│           │                 │
│ 75%     │───────────┴──────────┴──────────┴───────────┴─────────────────│
├─────────┼───────────────────────────────────────────────────────────────┤
│ Mike    │           │▓▓▓Proj B▓▓▓▓▓▓▓▓▓▓▓▓│▓▓▓Proj B▓▓│                 │
│ 60%     │───────────┴──────────┴──────────┴───────────┴─────────────────│
├─────────┼───────────────────────────────────────────────────────────────┤
│ Sarah   │           │          │          │           │███Proj C███████│
│ 40%     │───────────┴──────────┴──────────┴───────────┴─────────────────│
├─────────┼───────────────────────────────────────────────────────────────┤
│ ...     │                                                               │
└─────────┴───────────────────────────────────────────────────────────────┘
         Mon        Tue        Wed        Thu         Fri

Utilization: ██████░░░░ 75%  (7am-4pm capacity per day)
```

#### PM Capabilities

- **Create bookings** via:
  - Click on empty time slot → opens booking modal
  - Drag from unassigned project list onto calendar
  - Drag existing booking to reschedule
  - Resize booking edges to change duration
- **Assign engineers**:
  - Select from dropdown in booking modal
  - Drag engineer name onto time slot
  - Assign multiple engineers to same project/time
- **Bulk actions**:
  - Select multiple bookings → change status
  - Copy week's schedule to next week
- **Conflict detection**:
  - Warning icon on overlapping bookings
  - Tooltip shows conflict details
  - Allowed but highlighted

### 3.2 Engineer View

#### Personal Calendar (Mobile-Friendly)

```
┌─────────────────────────────────────┐
│  My Schedule    [Toggle: Tentative ◉]│
├─────────────────────────────────────┤
│  ◀  This Week  ▶                    │
├─────────────────────────────────────┤
│  MONDAY, DEC 30                     │
│  ┌─────────────────────────────────┐│
│  │ 7:00 AM - 10:00 AM              ││
│  │ ▓▓ Project Alpha (Tentative)    ││
│  │ Customer: Acme Corp             ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ 1:00 PM - 4:00 PM               ││
│  │ ██ Project Beta (Confirmed)     ││
│  │ Customer: TechCo                ││
│  └─────────────────────────────────┘│
├─────────────────────────────────────┤
│  TUESDAY, DEC 31                    │
│  ┌─────────────────────────────────┐│
│  │ 9:00 AM - 12:00 PM              ││
│  │ ██ Project Beta (Confirmed)     ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

#### Engineer Capabilities

- View their schedule (day/week/month)
- Toggle tentative bookings on/off
- See project details (customer, POC, notes)
- **Read-only** - cannot modify schedule
- **iCal subscription link** (future feature)

---

## 4. Customer Confirmation Portal

### Email Configuration

- **Sender**: Generic address (e.g., scheduling@yourcompany.com)
- **Expiration**: 7 days

### Email to Customer

```
Subject: Please confirm your project dates - [Project Name]

Hi [Customer Name],

We've scheduled the following dates for [Project Name]:

┌─────────────────────────────────────┐
│  Scheduled Dates                    │
├─────────────────────────────────────┤
│  Monday, Jan 6      Jason Smith     │
│  7:00 AM - 12:00 PM                 │
│                                     │
│  Tuesday, Jan 7     Jason Smith     │
│  7:00 AM - 4:00 PM  Mike Johnson    │
│                                     │
│  Wednesday, Jan 8   Jason Smith     │
│  7:00 AM - 11:00 AM                 │
└─────────────────────────────────────┘

        [ ✓ CONFIRM DATES ]

        [ ✗ DECLINE ]

This link expires in 7 days.
```

### Confirmation Page (Magic Link)

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  Confirm Project Schedule                       │
│  ─────────────────────────                      │
│                                                 │
│  Project: Website Redesign                      │
│  Your Company: Acme Corp                        │
│                                                 │
│  Scheduled Dates:                               │
│  • Mon Jan 6, 7:00 AM - 12:00 PM               │
│    Engineers: Jason Smith, Mike Johnson         │
│  • Tue Jan 7, 7:00 AM - 4:00 PM                │
│    Engineer: Jason Smith                        │
│  • Wed Jan 8, 7:00 AM - 11:00 AM               │
│    Engineer: Jason Smith                        │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │  [ ✓ CONFIRM THESE DATES ]              │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │  [ ✗ DECLINE ]                          │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  If declining, please provide a reason:         │
│  ┌─────────────────────────────────────────┐   │
│  │                                         │   │
│  │                                         │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### After Customer Action

- **Confirm**: Status → Confirmed, PM notified via email + in-app
- **Decline**: Status → Tentative, PM notified with reason/message

---

## 5. Notifications

### PM Receives Notifications When:

| Event | Notification Type |
|-------|-------------------|
| Customer confirms | Email + In-app |
| Customer declines | Email + In-app (includes reason) |
| Booking conflict detected | In-app warning |
| Confirmation link expires | Email reminder |

---

## 6. Booking Modal (PM)

```
┌─────────────────────────────────────────────────┐
│  New Booking                              [ X ] │
├─────────────────────────────────────────────────┤
│                                                 │
│  Project:     [ Select Project...         ▼ ]  │
│                                                 │
│  Engineer(s): [ Select Engineer(s)...     ▼ ]  │
│               ☑ Jason Smith                     │
│               ☑ Mike Johnson                    │
│               ☐ Sarah Williams                  │
│                                                 │
│  Date:        [ Dec 30, 2024              📅 ] │
│                                                 │
│  Start Time:  [ 9:00 AM                   ▼ ]  │
│                                                 │
│  End Time:    [ 12:00 PM                  ▼ ]  │
│               (3 hours)                         │
│                                                 │
│  Status:      ◉ Draft                          │
│               ○ Tentative                       │
│               ○ Confirmed                       │
│                                                 │
│  ⚠️  Warning: Jason has another booking         │
│      9:00-10:00 AM (Project Beta)              │
│                                                 │
│  Notes:       ┌─────────────────────────────┐  │
│               │                             │  │
│               └─────────────────────────────┘  │
│                                                 │
│         [ Cancel ]           [ Save Booking ]  │
└─────────────────────────────────────────────────┘
```

---

## 7. History Tracking

Every booking maintains an audit log:

```
┌─────────────────────────────────────────────────┐
│  Booking History                                │
├─────────────────────────────────────────────────┤
│  Dec 28, 2:30 PM - Created as Draft            │
│                     by PM (Sarah Johnson)       │
│                                                 │
│  Dec 28, 4:00 PM - Changed to Tentative        │
│                     by PM (Sarah Johnson)       │
│                                                 │
│  Dec 29, 9:15 AM - Changed to Pending          │
│                     Confirmation sent to        │
│                     john@acme.com               │
│                                                 │
│  Dec 30, 11:42 AM - Customer Confirmed         │
│                      via portal                 │
│                                                 │
│  Jan 8, 4:00 PM - Marked Complete              │
│                    by PM (Sarah Johnson)        │
└─────────────────────────────────────────────────┘
```

---

## 8. Data Model

```
Project
├── id
├── name
├── customer_name
├── poc_name
├── poc_email
├── poc_phone
└── notes

Booking
├── id
├── project_id
├── engineer_id
├── date
├── start_time (7:00 AM - 4:00 PM range)
├── end_time
├── status (draft|tentative|pending|confirmed|complete)
├── notes
├── created_at
├── updated_at
└── created_by (PM user id)

BookingHistory
├── id
├── booking_id
├── previous_status
├── new_status
├── changed_by
├── changed_at
└── notes (e.g., "Customer declined: need different week")

ConfirmationRequest
├── id
├── project_id
├── booking_ids[] (all bookings for this confirmation)
├── token (unique magic link token)
├── sent_to_email
├── sent_at
├── expires_at
├── status (pending|confirmed|declined)
├── responded_at
└── decline_reason

Engineer
├── id
├── name
├── email
├── ical_token (for subscription URL)
└── working_hours (default 7am-4pm)
```

---

## 9. Color Palette

| Status | Background | Text/Border | Hex Codes |
|--------|------------|-------------|-----------|
| Draft | Light Blue | Dark Blue | `#DBEAFE` / `#1E40AF` |
| Tentative | Light Yellow | Amber | `#FEF3C7` / `#B45309` |
| Pending | Light Purple | Purple | `#E9D5FF` / `#7C3AED` |
| Confirmed | Light Green | Green | `#D1FAE5` / `#047857` |
| Complete | Light Gray | Gray | `#F3F4F6` / `#6B7280` |

---

## 10. Feature Summary

### For PM

| Feature | Description |
|---------|-------------|
| Weekly calendar view | Primary view, colored by status |
| Resource view | See all engineers side-by-side with utilization |
| Drag-and-drop scheduling | Click, drag, resize bookings |
| Multi-engineer booking | Multiple engineers on same project/time |
| Status workflow | Draft → Tentative → Pending → Confirmed → Complete |
| Conflict warnings | Visual warning for overlaps (allowed) |
| Customer confirmation | Send magic link email to POC |
| Notifications | Email + in-app when customer responds |
| History tracking | Full audit log per booking |
| Filters | By engineer, status, project |

### For Engineers

| Feature | Description |
|---------|-------------|
| Personal calendar | Day/week view of their schedule |
| Toggle tentative | Show/hide tentative bookings |
| Mobile-friendly | Responsive design |
| iCal subscription | Sync to personal calendar apps (future) |
| Read-only | Cannot modify, only view |

### For Customers

| Feature | Description |
|---------|-------------|
| Magic link email | One-click access, no login required |
| See dates + engineers | Full visibility of scheduled work |
| Confirm or Decline | Simple two-button choice |
| Decline reason | Optional message field for requesting changes |
| Link expiration | 7-day security timeout |

---

## 11. Future Features

### iCal Subscription (Engineers)

- Each engineer gets a unique iCal URL
- Syncs to Google Calendar, Outlook, Apple Calendar
- Shows only Confirmed + Tentative (based on preference)
- Read-only subscription (changes sync automatically)

---

## 12. Research Sources

- [Float.com - Resource Management](https://www.float.com/) - Capacity planning and utilization views
- [Teamup.com - Booking Status Visualization](https://www.teamup.com/learn/manage-availability/three-ways-to-visualize-booking-status/) - Visual patterns for tentative vs confirmed
- [Wrike - Calendar vs Gantt](https://www.wrike.com/blog/project-calendar-gantt-chart/) - View type comparison
- [Ganttic - Drag and Drop Scheduling](https://www.ganttic.com/blog/drag-and-drop-scheduling-done) - UI best practices
- [TicketingHub - Magic Links](https://help.ticketinghub.com/en/article/how-to-enable-and-set-up-the-magic-link-feature-19w9s32/) - Customer confirmation patterns
- [Acuity Scheduling](https://acuityscheduling.com/features/appointment-reminders) - Appointment confirmation workflows
- [GOV.UK Design System](https://design-system.service.gov.uk/patterns/confirmation-pages/) - Confirmation page patterns
