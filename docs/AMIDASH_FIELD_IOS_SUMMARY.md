# AmiDash Field — iOS App Summary

## Overview

**AmiDash Field** is a native iOS companion app for field technicians at Amitrace. It connects to the AmiDash web dashboard (Next.js) via a shared Supabase backend, enabling technicians to access projects, capture media, and create scope-of-work documents while on-site — including offline.

- **Bundle ID:** `com.amitrace.amidashfield`
- **Minimum iOS:** 17.0
- **Language:** Swift 5.0 / SwiftUI
- **Local DB:** SwiftData (in-memory for tests, persistent for production)
- **Project Generation:** XcodeGen (`project.yml`)
- **CI/CD:** GitHub Actions (build, test, SwiftLint, coverage via Codecov)

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              AmiDash Field (iOS)             │
├─────────────────────────────────────────────┤
│  App Layer         RootView → MainTabView   │
│  Features          Home, Dashboard, Calendar│
│                    Projects, Camera, Scope   │
│                    Media, Files, Auth        │
│  Core              Auth, Networking, Sync    │
│  Models            SwiftData entities        │
│  UI                Theme, Reusable views     │
└──────────────┬──────────────────────────────┘
               │
      ┌────────┴────────┐
      ▼                 ▼
  Supabase          AmiDash Web API
  (Auth, DB,        /api/mobile/*
   Storage)         /api/sow/config
                    /api/ai/scope
```

### Authentication
- **Supabase Auth** (email/password) — shared credentials with web app
- **Bearer token** (Supabase JWT) for all API calls
- **Keychain** storage for credentials
- **Biometric** login (Face ID / Touch ID)
- **Auto token refresh** in background

### Networking Clients
| Client | Purpose |
|--------|---------|
| `SupabaseClient` | DB queries, file storage, auth |
| `AmiDashAPI` | Mobile API endpoints on web backend |
| `ClaudeAPIClient` | AI scope-of-work via `/api/ai/scope` proxy |
| `SharePointClient` | File uploads via `/api/mobile/sharepoint/upload` |

### Offline & Sync
- **NetworkMonitor** watches connectivity via `NWPathMonitor`
- **SyncManager** runs on app launch + when connectivity returns
- **Sync order:** Statuses → Projects → Invoiced dates → Pending files → Sync queue
- **MediaSyncManager** handles photo/video upload queue separately
- **BackgroundSyncManager** for iOS background task scheduling
- **OfflineMediaStorage** persists captured media locally until synced
- Failed items retry with exponential backoff (max 5 attempts)

---

## Features (Tab Bar)

### 1. Home
- Today's scheduled projects
- Quick-action buttons (camera, scope builder)
- Pending upload count
- Project search (client, SO#, POC, date, location)

### 2. Dashboard
- Financial metrics: POs received, invoiced, pipeline value
- Project analytics: active count, completion rate, overdue tracking
- Period filters: week / month / quarter / year
- Overdue project alerts

### 3. Calendar
- Monthly view with project indicators
- Tap day → see scheduled projects
- Color-coded by booking status (draft/tentative/pending/confirmed)

### 4. Projects
- Searchable, filterable list of all projects
- Detail view: POC info, dates, status, attached files
- Visual progress indicator tied to status pipeline

### 5. Camera & Media Capture
- Native camera for photo and video
- Auto GPS tagging
- Category assignment (schematics, SOW, media, other)
- Photo markup/annotation
- Offline storage with sync queue
- Gallery view for captured media

### 6. AI Scope Builder
- Voice input via Apple Speech framework
- Conversational AI (Claude) gathers scope details
- Attach reference photos
- Generates formatted scope-of-work documents
- Voice output (AVSpeechSynthesizer) for hands-free use
- Scope list view to manage saved scopes

### 7. Settings & Profile
- User profile view
- App settings
- Microsoft account connection status

---

## Data Models (SwiftData)

| Model | Key Fields |
|-------|------------|
| `Project` | id, salesOrderNumber, clientName, startDate, endDate, scheduleStatus, pocName/Email/Phone, salesAmount, goalCompletionDate, invoicedDate, address/city/state/zip |
| `ProjectAssignment` | projectId, userId, bookingStatus, notes, days[] |
| `AssignmentDay` | assignmentId, workDate, startTime, endTime |
| `ProjectFile` | projectId, fileName, category, mimeType, fileSize, localPath, remoteUrl, syncStatus, latitude, longitude |
| `ScopeOfWork` | clientName, conversationHistory[], generatedDocument, attachedPhotos[], status |
| `ProjectStatus` | name, displayOrder, progressPercent, isActive |
| `MediaItem` | (captured media with sync tracking) |
| `UserProfile` | (user info) |
| `SyncQueueItem` | entityType, status, retryCount, errorMessage |

### Enums
- **BookingStatus:** draft, tentative, pending_confirm, confirmed
- **FileCategory:** schematics, sow, photos, videos, other
- **SyncStatus:** pending, syncing, synced, failed
- **UserRole:** admin, project_manager, technician, sales

---

## Backend API Endpoints Used

### AmiDash Web Mobile APIs
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/mobile/microsoft/status` | Check Microsoft account connection |
| GET | `/api/mobile/projects` | List projects for file uploads |
| POST | `/api/mobile/sharepoint/upload` | Upload files to SharePoint |

### AI / SOW APIs
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/sow/config` | SOW templates + equipment options (cacheable) |
| POST | `/api/ai/scope` | Claude API proxy for voice-based scope creation |

### Supabase Direct
| Table | Operations |
|-------|-----------|
| `projects` | Read (with status join) |
| `statuses` | Read |
| `status_history` | Read (for invoiced dates) |
| `project_files` | Read/Write |

---

## Configuration

### Environment / xcconfig
| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `CLAUDE_API_KEY` | No | Anthropic API key (AI features) |
| `API_BASE_URL` | No | AmiDash web URL (default: dash.amitrace.com) |
| `SHAREPOINT_SITE_ID` | No | SharePoint site ID |
| `SHAREPOINT_DRIVE_ID` | No | SharePoint drive ID |
| `SHAREPOINT_CLIENT_ID` | No | SharePoint OAuth client |
| `SHAREPOINT_TENANT_ID` | No | SharePoint tenant |

### Feature Flags (Config.swift)
- `enableOfflineMode = true`
- `enableBiometricAuth = true`
- `maxVideoLength = 120s`
- `syncRetryMaxAttempts = 5`
- `syncBatchSize = 10`
- `wifiOnlySyncDefault = true`
- `syncedMediaRetentionDays = 7`
- `targetPhotoSizeBytes = 1MB`
- `maxVideoDurationSeconds = 300s`

---

## Current Test Coverage

**65 unit tests** across 4 suites:

| Suite | Tests | Covers |
|-------|-------|--------|
| `AuthManagerTests` | 14 | JWT parsing, token expiry, base64 padding, error types, auth models |
| `SyncManagerTests` | 15 | SwiftData CRUD, model creation, filtering, batch processing, data integrity |
| `ClaudeAPIClientTests` | 16 | API request encoding/decoding |
| `AppErrorTests` | 20 | Error enum types, descriptions |

### Test Infrastructure
- `BaseTestCase` — in-memory SwiftData container, helper factories, async utilities
- `MockURLProtocol` — network request interception
- `MockServices` — service mocks for dependency injection

### CI Pipeline (GitHub Actions)
- Triggers on push to main/develop and PRs to main
- XcodeGen → Build → Test (with coverage) → SwiftLint
- Coverage uploaded to Codecov
- Test results stored as artifacts (14-day retention)

---

## Key Gaps / Notes

1. **FileCategory mismatch:** iOS uses `photos`/`videos` but web API consolidated to `media` — legacy values accepted but should be updated
2. **No UI/integration tests** — only unit tests exist currently
3. **SharePoint upload** goes through web backend (not direct) for security
4. **SOW config endpoint** supports offline caching headers
5. **Middleware exclusion** — mobile API routes use Bearer auth, excluded from cookie-based middleware
