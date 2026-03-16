# AmiDash Field iOS — Bug Testing System

A structured system for finding, tracking, and preventing bugs in the AmiDash Field iOS app.

---

## Table of Contents

1. [Test Matrix](#1-test-matrix)
2. [Manual Test Checklists](#2-manual-test-checklists)
3. [Bug Report Template](#3-bug-report-template)
4. [Automated Test Expansion Plan](#4-automated-test-expansion-plan)
5. [Backend API Contract Tests](#5-backend-api-contract-tests)
6. [Regression Test Suite](#6-regression-test-suite)
7. [Device & OS Matrix](#7-device--os-matrix)

---

## 1. Test Matrix

### Feature Coverage Map

| Feature | Unit Tests | UI Tests | Manual QA | API Contract | Notes |
|---------|:----------:|:--------:|:---------:|:------------:|-------|
| **Auth — Login** | 14 tests | None | Required | — | JWT parsing covered |
| **Auth — Biometric** | None | None | Required | — | Needs device testing |
| **Auth — Token refresh** | None | None | Required | — | Background refresh |
| **Sync — Projects** | 15 tests | None | Required | Needed | SwiftData CRUD covered |
| **Sync — Statuses** | Partial | None | Required | Needed | |
| **Sync — Files** | Partial | None | Required | Needed | |
| **Sync — Offline queue** | None | None | Required | — | Critical path |
| **Dashboard — Metrics** | None | None | Required | — | |
| **Calendar — Monthly** | None | None | Required | — | |
| **Projects — List** | None | None | Required | — | |
| **Projects — Detail** | None | None | Required | — | |
| **Camera — Capture** | None | None | Required | — | Device only |
| **Camera — GPS tag** | None | None | Required | — | Device only |
| **Media — Gallery** | None | None | Required | — | |
| **Media — Markup** | None | None | Required | — | |
| **Media — Sync** | None | None | Required | Needed | |
| **Scope — Voice input** | None | None | Required | — | Speech framework |
| **Scope — AI chat** | 16 tests | None | Required | Needed | Encoding/decoding covered |
| **Scope — Doc gen** | None | None | Required | — | |
| **Files — Upload** | None | None | Required | Needed | SharePoint integration |
| **Files — View** | None | None | Required | — | |
| **Settings** | None | None | Required | — | |
| **Network — Monitor** | None | None | Required | — | |
| **Error handling** | 20 tests | None | Required | — | Enum coverage |

### Priority Levels

- **P0 (Critical):** Auth, Sync, Offline queue, File upload — app is unusable without these
- **P1 (High):** Camera capture, GPS, Media sync, AI scope — core field workflows
- **P2 (Medium):** Dashboard, Calendar, Projects list/detail — read-only views
- **P3 (Low):** Settings, Profile, UI polish — non-blocking

---

## 2. Manual Test Checklists

### 2.1 Authentication Flow

```
[ ] Fresh install → login screen appears
[ ] Valid credentials → successful login → Home screen
[ ] Invalid credentials → error message displayed
[ ] Network offline during login → appropriate error
[ ] Token expiry → auto-refresh works silently
[ ] Token expiry + refresh failure → redirects to login
[ ] Biometric (Face ID) → prompt appears after first login
[ ] Biometric cancel → falls back to email/password
[ ] Keychain persistence → kill app → reopen → still logged in
[ ] Logout → clears keychain → shows login screen
[ ] Logout → clears local SwiftData → fresh state on re-login
```

### 2.2 Sync & Offline

```
[ ] App launch (online) → syncs projects, statuses, invoiced dates
[ ] Sync indicator visible during sync
[ ] Sync completes → lastSyncDate updates
[ ] Airplane mode ON → app shows offline indicator
[ ] Airplane mode ON → can browse cached projects
[ ] Airplane mode ON → can capture photos (saved locally)
[ ] Airplane mode OFF → auto-sync triggers
[ ] Pending uploads counter shows correct count
[ ] Failed sync item → retries up to 5 times with backoff
[ ] Failed sync after max retries → marked as failed, visible to user
[ ] Switch from WiFi to cellular → sync respects wifiOnlySync setting
[ ] Kill app during sync → resumes on next launch
[ ] Large project list (50+) → sync completes without crash
```

### 2.3 Camera & Media Capture

```
[ ] Camera permission prompt on first use
[ ] Camera denied → shows settings redirect
[ ] Take photo → review screen appears
[ ] Photo review → save → file appears in pending uploads
[ ] Photo includes GPS metadata (check in photo review)
[ ] Photo includes timestamp metadata
[ ] Category selection works (schematics, SOW, media, other)
[ ] Video capture → respects maxVideoLength (120s)
[ ] Video over limit → recording stops automatically
[ ] Photos compressed to ~1MB target size
[ ] Multiple rapid captures → all saved correctly
[ ] Gallery view shows all captured media
[ ] Photo markup → draw annotations → save
[ ] Delete captured media before sync → removed from queue
[ ] Low storage warning when device space is low
```

### 2.4 AI Scope Builder

```
[ ] Scope builder opens from Home quick action
[ ] Voice input → microphone permission prompt
[ ] Voice input → speech recognized and sent to Claude
[ ] Claude responds with scope questions
[ ] Multi-turn conversation works correctly
[ ] Attach photo to scope conversation
[ ] Voice output toggle → AI speaks response aloud
[ ] Generate document from conversation → formatted output
[ ] Save scope → appears in scope list
[ ] Resume incomplete scope from list
[ ] Offline → scope builder shows appropriate message
[ ] Long conversation (10+ turns) → no performance degradation
[ ] Special characters in voice input handled correctly
```

### 2.5 SharePoint File Upload

```
[ ] Microsoft account connected (check via status endpoint)
[ ] Microsoft not connected → shows "connect in web app" message
[ ] Upload photo → success response with file record
[ ] Upload schematic PDF → correct category assigned
[ ] Upload large file (>4MB) → handled correctly
[ ] Upload progress indicator visible
[ ] Upload fails (500) → retries with exponential backoff
[ ] Upload fails (401) → re-authenticates and retries
[ ] Upload fails (403) → shows Microsoft connection message
[ ] Multiple files queued → upload sequentially
[ ] Cancel upload in progress → file returns to pending
[ ] Upload while on cellular → respects WiFi-only setting
```

### 2.6 Projects & Dashboard

```
[ ] Project list loads all projects
[ ] Search by client name → filters correctly
[ ] Search by SO# → filters correctly
[ ] Search by POC → filters correctly
[ ] Filter by booking status → correct results
[ ] Project detail → all fields populated
[ ] Project detail → files tab shows attached files
[ ] Dashboard metrics → numbers match web app
[ ] Dashboard period filter → metrics update
[ ] Overdue projects highlighted
[ ] Pull-to-refresh → re-syncs data
```

### 2.7 Calendar

```
[ ] Monthly view renders correctly
[ ] Projects shown as colored indicators on dates
[ ] Status colors match: gray=draft, yellow=tentative, orange=pending, green=confirmed
[ ] Tap date → shows scheduled projects for that day
[ ] Navigate months → correct data loads
[ ] Today highlighted
[ ] Weekends displayed (unlike web app which hides them)
```

---

## 3. Bug Report Template

Use this template for all bugs found:

```markdown
### Bug Title
[Short descriptive title]

**Severity:** P0 / P1 / P2 / P3
**Feature Area:** Auth | Sync | Camera | Scope | Files | Dashboard | Calendar | Projects | Settings
**Found By:** [Name]
**Date:** [YYYY-MM-DD]
**Build:** [Version/commit hash]

**Device:** [iPhone model]
**iOS Version:** [e.g., 17.4]
**Network:** WiFi / Cellular / Offline

#### Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Step 3]

#### Expected Behavior
[What should happen]

#### Actual Behavior
[What actually happens]

#### Screenshots/Video
[Attach if applicable]

#### Logs
[Paste relevant console output or crash logs]

#### Additional Context
[Any other info — did it happen once or consistently? Related to specific data?]
```

---

## 4. Automated Test Expansion Plan

### Phase 1: Critical Path Unit Tests (Priority: P0)

These tests should be added to `AmiDashFieldTests/` immediately:

#### `SyncManagerNetworkTests.swift` (new)
```
- testSyncAll_WhenOffline_DoesNotAttemptSync
- testSyncAll_WhenAlreadySyncing_SkipsSync
- testSyncAll_WhenOnline_CompletesFullSync
- testSyncAll_OnFailure_SetsSyncError
- testAutoSync_WhenComingBackOnline_TriggersSyncAll
- testSyncRetry_RespectsMaxAttempts
- testSyncRetry_ExponentialBackoff
```

#### `ProjectDTOTests.swift` (new)
```
- testProjectDTO_DecodesFromValidJSON
- testProjectDTO_HandlesNullOptionals
- testProjectDTO_ParsesISO8601Dates
- testProjectDTO_ParsesSimpleDates
- testProjectDTO_ConvertsSalesAmountToDecimal
- testProjectDTO_HandlesNullSalesAmount
- testProjectDTO_ParsesNestedStatusDTO
```

#### `MediaSyncManagerTests.swift` (new)
```
- testMediaSync_PendingItems_UploadedInOrder
- testMediaSync_FailedUpload_MarkedAsFailed
- testMediaSync_WiFiOnly_SkipsOnCellular
- testMediaSync_BackgroundTask_CompletesBeforeExpiry
- testMediaSync_DuplicateFile_Skipped
```

#### `KeychainManagerTests.swift` (new)
```
- testKeychain_SaveAndRetrieve
- testKeychain_DeleteClearsValue
- testKeychain_OverwriteExistingValue
- testKeychain_RetrieveNonExistent_ReturnsNil
```

### Phase 2: UI Tests with XCUITest (Priority: P1)

Create `AmiDashFieldUITests/` target:

#### `LoginUITests.swift`
```
- testLoginScreen_FieldsVisible
- testLoginScreen_EmptySubmit_ShowsError
- testLoginScreen_ValidLogin_NavigatesToHome
- testLoginScreen_BiometricPrompt_Shown (device only)
```

#### `HomeUITests.swift`
```
- testHomeScreen_TabsVisible
- testHomeScreen_QuickActions_NavigateCorrectly
- testHomeScreen_PendingUploads_ShowsCount
```

#### `ProjectsUITests.swift`
```
- testProjectList_DisplaysProjects
- testProjectList_SearchFilters
- testProjectDetail_ShowsAllFields
```

### Phase 3: Integration Tests (Priority: P1)

#### `APIContractTests.swift` (new)
Tests that verify the iOS app's expected API request/response format matches the web backend. These should run against a test/staging environment.

```
- testMicrosoftStatus_ResponseShape
- testProjectsList_ResponseShape
- testSharePointUpload_RequestFormat
- testSharePointUpload_ResponseShape
- testSOWConfig_ResponseShape
- testAIScope_RequestFormat
- testAIScope_ResponseShape
```

### Phase 4: Performance Tests (Priority: P2)

```
- testProjectSync_100Projects_CompletesUnder5Seconds
- testSwiftData_FetchAll_Under100ms
- testImageCompression_1MB_Under2Seconds
- testAppLaunch_ColdStart_Under3Seconds
```

---

## 5. Backend API Contract Tests

These tests run in the **AmiDash web repo** (vitest) to ensure the mobile endpoints don't break:

### Add to `src/app/api/mobile/__tests__/`

#### `projects.test.ts`
```typescript
// Test GET /api/mobile/projects
- returns 401 without auth header
- returns 401 with invalid token
- returns project list with correct shape
- returns only active projects
- includes id, sales_order, client_name, status fields
```

#### `microsoft-status.test.ts`
```typescript
// Test GET /api/mobile/microsoft/status
- returns 401 without auth header
- returns { connected: false } when no Microsoft connection
- returns { connected: true, email, expires_at } when connected
```

#### `sharepoint-upload.test.ts`
```typescript
// Test POST /api/mobile/sharepoint/upload
- returns 401 without auth header
- returns 400 when file missing
- returns 400 when projectId missing
- returns 400 when category missing
- accepts legacy category values (photos → media)
- returns file record on success
```

#### `sow-config.test.ts`
```typescript
// Test GET /api/sow/config
- returns SOW templates
- returns equipment options
- includes cache headers for offline support
```

---

## 6. Regression Test Suite

Run this checklist before every release:

### Pre-Release Regression (30 minutes)

```
AUTHENTICATION
[ ] Fresh login with valid credentials
[ ] Biometric unlock after app restart
[ ] Token refresh (set clock forward or wait)

SYNC
[ ] Full sync on launch (check project count matches web)
[ ] Offline mode → capture photo → go online → photo syncs

CAMERA
[ ] Take 3 photos, assign categories, verify in gallery
[ ] Video capture (30 seconds), verify playback

SCOPE BUILDER
[ ] Create new scope via voice → generate document

FILE UPLOAD
[ ] Upload 1 photo to SharePoint → verify in web app files tab

PROJECTS
[ ] Search by client name
[ ] Open project detail → verify data matches web

DASHBOARD
[ ] Verify financial metrics match web dashboard

CALENDAR
[ ] Verify today's projects match web calendar

EDGE CASES
[ ] Kill app during sync → reopen → no crash, sync resumes
[ ] Rotate device → no layout issues
[ ] Background app for 5 min → resume → still authenticated
[ ] Low battery mode → sync still works
```

---

## 7. Device & OS Matrix

### Minimum Test Devices

| Device | Screen Size | iOS Version | Priority |
|--------|------------|-------------|----------|
| iPhone 16 | 6.1" | 18.x | Primary (CI default) |
| iPhone 16 Pro Max | 6.9" | 18.x | Large screen |
| iPhone SE (3rd gen) | 4.7" | 17.x | Small screen / min OS |
| iPhone 15 | 6.1" | 17.x | Previous gen |
| iPad (10th gen) | 10.9" | 17.x | Tablet layout (if supported) |

### Test Conditions

| Condition | How to Test |
|-----------|------------|
| Airplane mode | Settings → Airplane Mode |
| Slow network | Network Link Conditioner (Xcode) |
| No GPS | Simulator → Features → Location → None |
| Low storage | Fill device storage, attempt captures |
| Background/foreground | Switch apps during sync |
| Memory pressure | Xcode → Debug → Simulate Memory Warning |
| Dark mode | Settings → Display → Dark |
| Dynamic type (large) | Settings → Display → Text Size → max |
| VoiceOver | Settings → Accessibility → VoiceOver |

---

## Quick Start: Running the Testing System

### 1. Run existing unit tests
```bash
cd /Users/faraz/Desktop/AmiDashField-iOS
xcodegen generate
xcodebuild -project AmiDashField.xcodeproj -scheme AmiDashField \
  -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 16' \
  test
```

### 2. Run backend contract tests (from web repo)
```bash
cd /Users/faraz/Desktop/1_amidash-wt3
npm test -- src/app/api/mobile
```

### 3. Manual QA
- Open this document
- Work through the relevant checklist section
- File bugs using the template in Section 3
- Track in GitHub Issues with label `ios-bug`

### 4. Add new automated tests
- Unit tests → `AmiDashFieldTests/` (match existing pattern)
- UI tests → create `AmiDashFieldUITests/` target
- Backend contract tests → `src/app/api/mobile/__tests__/`
