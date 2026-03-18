# AmiDash Field iOS - Complete Codebase Reference

**Bundle ID:** `com.amitrace.amidashfield`
**iOS Target:** 17.0+ | **Language:** Swift 5.0 / SwiftUI | **Local DB:** SwiftData
**Repo:** `/Users/faraz/Desktop/AmiDashField-iOS/`
**Xcode Project:** `AmiDashField.xcodeproj` (the only active project — old duplicates archived to `_archived_projects/`)
**Project Generation:** XcodeGen (`project.yml`)
**CI/CD:** GitHub Actions (build, test, SwiftLint, Codecov)

---

## Architecture

```
AmiDash Field (iOS)
├── App Layer         RootView → MainTabView (auth gate)
├── Features          Home, Dashboard, Calendar, Projects, Camera, Media, Scope Builder, Files, Auth
├── Core              Auth, Networking (4 clients), Sync (3 managers), Storage, Notifications
├── Models            SwiftData entities (8 models)
└── Utilities         Theme, Toast, Location, Network Monitor, Image Cache
        │
        ├── Supabase (Auth, DB, Storage) ── direct REST
        └── AmiDash Web API (/api/mobile/*) ── SharePoint uploads
```

---

## Project Structure

```
AmiDashField-iOS/
├── AmiDashField/
│   ├── App/
│   │   ├── AmiDashFieldApp.swift          # @main, SwiftData container init
│   │   └── RootView.swift                 # Auth gate → MainTabView, sync coordination
│   ├── Core/
│   │   ├── Authentication/
│   │   │   ├── AuthManager.swift          # Auth state, token refresh, biometric trigger
│   │   │   ├── BiometricAuth.swift        # Face ID / Touch ID
│   │   │   └── KeychainManager.swift      # Secure credential storage
│   │   ├── Networking/
│   │   │   ├── AmiDashAPI.swift           # Web app REST client (SharePoint uploads, AC deals)
│   │   │   ├── SupabaseClient.swift       # Supabase REST wrapper (projects, statuses, profiles)
│   │   │   ├── ClaudeAPIClient.swift      # Claude AI (placeholder/minimal)
│   │   │   └── SharePointClient.swift     # MS Graph API (large file uploads, chunked)
│   │   ├── Sync/
│   │   │   ├── SyncManager.swift          # Main orchestrator: statuses → projects → invoiced dates → files → queue
│   │   │   ├── MediaSyncManager.swift     # Media upload queue via AmiDashAPI → SharePoint
│   │   │   └── BackgroundSyncManager.swift# BGTaskScheduler (refresh + processing tasks)
│   │   ├── Storage/
│   │   │   └── OfflineMediaStorage.swift  # Local file persistence (Documents/Media/)
│   │   ├── Notifications/
│   │   │   └── PushNotificationManager.swift
│   │   ├── UI/
│   │   │   ├── Theme.swift                # Design system (colors, spacing, fonts)
│   │   │   ├── ToastManager.swift         # Toast notifications
│   │   │   └── LoadingStateView.swift     # Generic loading UI
│   │   └── Config.swift                   # Global config & feature flags
│   ├── Features/
│   │   ├── Auth/LoginView.swift
│   │   ├── Home/HomeView.swift, ProfileView.swift, SettingsView.swift
│   │   ├── Dashboard/DashboardView.swift, DashboardViewModel.swift, AllProjectsListView.swift,
│   │   │   DashboardProjectDetailView.swift, Components/(MetricCard, ProjectStatusBadge, DashboardProjectRow)
│   │   ├── Calendar/CalendarView.swift, WeekCalendarView.swift
│   │   ├── Projects/ProjectListView.swift, ProjectDetailView.swift
│   │   ├── Camera/CameraManager.swift, CameraView.swift, PhotoReviewView.swift, PresalesCameraView.swift
│   │   ├── Media/MediaCaptureManager.swift, MediaCaptureView.swift, MediaGalleryView.swift, PhotoMarkupView.swift
│   │   ├── Files/FilesView.swift, FileUploadProgressView.swift
│   │   └── ScopeBuilder/ScopeBuilderView.swift, ScopeViewModel.swift, ScopeConversationView.swift,
│   │       ScopeListView.swift, ScopeReviewView.swift, VoiceInputManager.swift, VoiceOutputManager.swift
│   ├── Models/
│   │   ├── SwiftData/Project.swift, ProjectFile.swift, ProjectAssignment.swift, AssignmentDay.swift,
│   │   │   ProjectStatus.swift, ScopeOfWork.swift, MediaItem.swift, SyncQueueItem.swift, UserProfile.swift
│   │   ├── Enums.swift
│   │   └── DTOs/DashboardDTOs.swift
│   ├── Utilities/AppError.swift, NetworkMonitor.swift, LocationManager.swift, ImageCache.swift,
│   │   AccessibilityHelper.swift, HapticFeedback.swift
│   ├── Config/Debug.xcconfig, Release.xcconfig, Secrets.xcconfig (git-ignored)
│   └── Resources/Assets.xcassets, LaunchScreen.storyboard, Localizable.strings
├── AmiDashFieldTests/
│   ├── Core/AuthManagerTests, ClaudeAPIClientTests, KeychainManagerTests,
│   │   MediaSyncManagerTests, ProjectDTOTests, SyncManagerNetworkTests, SyncManagerTests
│   ├── Utilities/AppErrorTests
│   └── TestHelpers/BaseTestCase, MockServices, MockURLProtocol
├── docs/
│   ├── IPHONE_APP_INSTRUCTIONS.md, MOBILE_API_ENDPOINTS.md, amitrace_brandguide.pdf
└── project.yml
```

---

## SwiftData Models

### Project (main entity)
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | @unique |
| salesOrderNumber | String | S1XXXX format |
| clientName | String | |
| startDate, endDate | Date? | |
| scheduleStatus | String | BookingStatus raw value |
| currentStatusId | UUID? | FK to ProjectStatus |
| currentStatusName | String? | Denormalized |
| pocName, pocEmail, pocPhone | String? | Point of contact |
| address, city, state, zipCode | String? | Delivery address |
| salesAmount | Decimal? | |
| poNumber | String? | |
| goalCompletionDate | Date? | |
| invoicedDate | Date? | Set from status_history sync |
| scopeLink | String? | |
| salesOrderUrl | String? | Odoo link |
| createdAt, updatedAt | Date | |
| lastSyncedAt | Date? | |
| **Relationships** | | |
| assignments | [ProjectAssignment] | cascade delete |
| files | [ProjectFile] | cascade delete |

### MediaItem (photo/video capture)
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | @unique |
| projectId | UUID? | |
| userId | String | |
| fileName | String | Auto-generated |
| mediaTypeRaw | String | "photo" or "video" |
| categoryRaw | String | FileCategory raw |
| mimeType | String | |
| fileSize | Int64 | |
| localPath | String? | Device path while pending |
| remoteUrl | String? | SharePoint URL after sync |
| sharePointPath | String? | |
| capturedAt | Date | |
| latitude, longitude | Double? | GPS |
| durationSeconds | Double? | For videos |
| thumbnailData | Data? | |
| syncStatusRaw | String | pending/syncing/synced/failed |
| syncAttempts | Int | Retry counter |
| lastSyncError | String? | Error message |
| capturedOffline | Bool | |
| hasMarkup | Bool | |
| markupData | Data? | Serialized annotations |

### ProjectFile (file attachments)
Same pattern as MediaItem but simpler — no duration, no markup, no syncAttempts tracking.

### Other Models
- **ProjectAssignment** — userId, projectId, bookingStatus, notes; has child `AssignmentDay` records
- **ProjectStatus** — name, displayOrder, progressPercent, isActive (reference data)
- **ScopeOfWork** — conversationHistory (JSON Data), extractedData (JSON Data), generatedDocument, status
- **SyncQueueItem** — entityType, entityId, actionType, payload, status, retryCount
- **UserProfile** — email, firstName, lastName, role, avatarUrl

### Enums
- **BookingStatus:** draft, tentative, pending_confirm, confirmed
- **FileCategory:** schematics, sow, media, other (legacy: photos, videos → media)
- **SyncStatus:** pending, syncing, synced, failed
- **MediaType:** photo, video
- **UserRole:** admin, project_manager, technician, sales

---

## Networking Clients

### 1. SupabaseClient — Direct database access
- Auth: email/password → JWT tokens
- Tables: `projects` (with status join), `statuses`, `status_history`, `profiles`, `project_files`
- Storage: file uploads to Supabase Storage buckets

### 2. AmiDashAPI — Web app REST API
- Base URL: `Config.apiBaseURL` (default: `https://dash.amitrace.com`)
- Auth: Bearer token (Supabase JWT)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/mobile/sharepoint/upload` | Upload file to SharePoint (multipart) |
| POST | `/api/mobile/presales/upload` | Upload presales file (multipart) |
| GET | `/api/mobile/sharepoint/token` | Get SharePoint access token |
| GET | `/api/mobile/sharepoint/config` | Get SharePoint site/drive config |
| GET | `/api/mobile/activecampaign/deals` | Fetch AC deals |

Response types: `SharePointUploadResponse`, `PresalesUploadResponse`, `ACDealsResponse`

### 3. SharePointClient — Microsoft Graph API (direct, for large files)
- Chunked uploads > 4MB
- Path: `/app data/{userFolder}/{dateFolder}/{fileName}`

### 4. ClaudeAPIClient — AI scope generation (placeholder/minimal)

---

## Sync System

### Flow
```
App Launch / Network Reconnect
    │
    ├── SyncManager.syncAll()                    [Supabase REST]
    │   ├── syncStatuses()                       statuses table
    │   ├── syncProjects()                       projects + status join
    │   ├── syncInvoicedDates()                  status_history table
    │   ├── syncProfile()                        profiles table
    │   ├── syncPendingFiles()                   Supabase Storage uploads
    │   └── processSyncQueue()                   Retry failed SyncQueueItems
    │
    └── MediaSyncManager.syncPendingMedia()      [AmiDash API → SharePoint]
        └── For each pending/failed MediaItem:
            1. Read file from localPath
            2. POST to /api/mobile/sharepoint/upload
            3. Update remoteUrl, set synced
            4. Save to SwiftData
```

### SyncManager (main orchestrator)
- `@MainActor`, `ObservableObject`
- Published: `isSyncing`, `isOnline`, `lastSyncDate`, `syncError`
- Network-aware: auto-syncs on reconnect via NWPathMonitor
- ProjectDTO includes: all project fields + nested StatusDTO
- Date parsing via `SupabaseDateParser` (handles ISO8601 with fractional seconds)

### MediaSyncManager (file uploads)
- `@MainActor`, singleton (`MediaSyncManager.shared`)
- Published: `isSyncing`, `syncProgress`, `pendingCount`, `syncError`, `wifiOnlySync`
- WiFi-only mode (default: true, persisted to UserDefaults)
- Manual sync bypasses WiFi-only restriction
- Fetches MediaItems with `syncStatusRaw == "pending" || "failed"`, ordered by capturedAt
- Each item: read local file → POST to AmiDashAPI → update SwiftData
- On failure: sets `.failed` status, increments `syncAttempts`, saves `lastSyncError`

### BackgroundSyncManager
- `BGAppRefreshTask` — light refresh every 15min
- `BGProcessingTask` — requires network, for upload backlog
- Registered in `RootView.onAppear`

### OfflineMediaStorage
- Saves to `~/Documents/Media/{Photos|Videos}/{userId}/{yyyy-MM-dd}/`
- File protection: `.completeFileProtection`
- Retention: synced media cleaned up after 7 days
- Generates thumbnails for gallery view

---

## Authentication

### Flow
1. LoginView → email/password → SupabaseClient.signIn()
2. Tokens stored in Keychain (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`)
3. Token auto-refresh scheduled 5min before expiry
4. Biometric (Face ID/Touch ID) available after first login
5. All API calls inject `Bearer <accessToken>` via `AuthManager.shared.accessToken`

### Keychain Keys
- `accessToken` — Supabase JWT
- `refreshToken` — For token renewal
- `userId` — Current user UUID

---

## Config & Feature Flags

```swift
// Sync
syncRetryMaxAttempts = 5
syncRetryBaseDelay = 1.0s
syncBatchSize = 10
wifiOnlySyncDefault = true
syncedMediaRetentionDays = 7

// Media
targetPhotoSizeBytes = 1_000_000  // 1MB compression target
maxVideoDurationSeconds = 300     // 5 min
maxVideoLength = 120              // 2 min (capture UI limit)

// Features
enableOfflineMode = true
enableBiometricAuth = true
```

### Environment (xcconfig)
| Variable | Required | Description |
|----------|----------|-------------|
| SUPABASE_URL | Yes | Supabase project URL |
| SUPABASE_ANON_KEY | Yes | Public anon key |
| API_BASE_URL | No | AmiDash web URL (default: dash.amitrace.com) |
| SHAREPOINT_SITE_ID | No | SharePoint site ID |
| SHAREPOINT_DRIVE_ID | No | SharePoint drive ID |
| SHAREPOINT_CLIENT_ID | No | SharePoint OAuth client |
| SHAREPOINT_TENANT_ID | No | SharePoint tenant |

---

## Known Issues

### Media Sync Silent Failure (CRITICAL)

Media sync can fail without any user-visible error. All errors are caught in a try/catch loop and only logged in DEBUG builds. The `syncError` state is set but never displayed as a toast.

**Failure modes:**
1. `localPath` is nil → throws `noLocalFile`, caught silently
2. File deleted between capture and sync → throws `noLocalFile`, caught silently
3. API response has neither `file` nor `error` → no error thrown, item left in limbo
4. After 5 failed attempts, items stay in "failed" status with no user notification
5. No way to manually retry individual failed items from the UI

**Where to fix:**
- `MediaSyncManager.syncPendingMedia()` — add toast notification on failure
- `MediaSyncManager.uploadMediaItem()` — validate API response completeness
- UI layer — show failed items with retry button

### Other Issues
- **createdAt bug** — `Project.createdAt` set to device time at sync, not server's `created_at` (fix planned in `docs/plans/2026-03-15-ios-dashboard-and-address-fixes.md`)
- **Address fields never populated** — ProjectDTO doesn't decode `delivery_*` columns (fix planned)
- **FileCategory mismatch** — iOS uses legacy `photos`/`videos`, web consolidated to `media` (accepted but should update)
- **No photo gallery import** — CameraView and MediaCaptureView have TODO for gallery access
- **ClaudeAPIClient** — minimal/placeholder, scope builder AI integration incomplete
- **No conflict resolution** — no handling for concurrent project updates
- **No E2E or UI tests** — only unit tests exist

---

## Tests

**65+ unit tests** across 8 test files:

| Suite | Tests | Covers |
|-------|-------|--------|
| MediaSyncManagerTests | 60+ | Sync flow, models, SwiftData queries, status transitions |
| SyncManagerTests | 15 | Data sync, DTO parsing |
| SyncManagerNetworkTests | 15 | Network integration |
| AuthManagerTests | 14 | Auth state, JWT parsing, token expiry |
| ClaudeAPIClientTests | 16 | API encoding/decoding |
| KeychainManagerTests | 12 | Keychain CRUD |
| ProjectDTOTests | 10 | DTO parsing, date conversion |
| AppErrorTests | 20 | Error enums |

### Test Infrastructure
- `BaseTestCase` — in-memory SwiftData container, factory helpers
- `MockURLProtocol` — network request interception
- `MockServices` — service mocks for DI

### Run Tests
```bash
cd /Users/faraz/Desktop/AmiDashField-iOS
xcodegen generate
xcodebuild -project AmiDashField.xcodeproj -scheme AmiDashField \
  -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 16' test
```

### Backend Contract Tests (web repo)
```bash
cd /Users/faraz/Desktop/1_amidash-wt3
npm test -- src/app/api/mobile
```

---

## Web Backend Mobile Endpoints

These live in the AmiDash web repo at `src/app/api/mobile/`:

| Method | Endpoint | File | Purpose |
|--------|----------|------|---------|
| POST | `/api/mobile/sharepoint/upload` | `sharepoint/upload/route.ts` | Upload file to SharePoint (auto-creates project folder) |
| POST | `/api/mobile/presales/upload` | `presales/upload/route.ts` | Upload presales file to _PRESALES folder |
| GET | `/api/mobile/projects` | `projects/route.ts` | List projects (sold/active/on_hold) |
| GET | `/api/mobile/microsoft/status` | `microsoft/status/route.ts` | Check Microsoft account connection |
| GET | `/api/mobile/activecampaign/deals` | `activecampaign/deals/route.ts` | Fetch AC deals |

All endpoints use Bearer token auth (Supabase JWT), excluded from cookie-based middleware.
