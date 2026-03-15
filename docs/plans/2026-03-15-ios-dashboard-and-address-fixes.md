# iOS Dashboard Period Filters & Project Address Navigation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix dashboard metrics not filtering by period correctly, and add delivery address display with Apple Maps navigation in project detail views.

**Architecture:** Two independent bugs. Bug 1: `createdAt` on Project is set to local device time at sync, not the server's `created_at` — so period filters compare against wrong dates. Fix by syncing `created_at` from the DTO. Bug 2: Address fields (`address`, `city`, `state`, `zipCode`) are never synced from Supabase. The web DB uses `delivery_street`, `delivery_city`, `delivery_state`, `delivery_zip`. Fix by adding these to the DTO and syncing them. The `ProjectDetailView` already has a location card with Maps integration — it just needs data. The `DashboardProjectDetailView` needs a Maps button added to its address section.

**Tech Stack:** Swift/SwiftUI, SwiftData, Supabase REST API

---

## Root Cause Analysis

### Bug 1: Dashboard period filters don't work
- `DashboardViewModel.loadMetrics()` line 39: `period.contains(project.createdAt)`
- `Project.init()` line 84: `self.createdAt = Date()` — set to **device time at sync**, not server time
- `SyncManager.syncProjects()`: never maps `dto.created_at` → `project.createdAt`
- Result: all projects appear created "today" (when they were first synced), so only "This Week"/"This Month" ever show data

### Bug 2: Address fields never populated
- `Project` model has `address`, `city`, `state`, `zipCode` fields
- `ProjectDTO` doesn't decode `delivery_street`, `delivery_city`, `delivery_state`, `delivery_zip`
- `syncProjects()` never maps address fields
- Result: `project.fullAddress` is always `nil`, location card never shows

---

## Task 1: Fix `createdAt` sync from server

**Files:**
- Modify: `/Users/faraz/Desktop/AmiDashField-iOS/AmiDashField/Core/Sync/SyncManager.swift`

**Step 1: Add `createdAt` mapping in the "Update existing" block (line ~147)**

In `syncProjects()`, after `existing.lastSyncedAt = Date()` (line 148), add:

```swift
// Sync server-side created_at (only set once, don't overwrite with nil)
if let serverCreatedAt = dto.createdAtParsed {
    existing.createdAt = serverCreatedAt
}
```

**Step 2: Add `createdAt` mapping in the "Create new" block (line ~169)**

After `project.lastSyncedAt = Date()` (line 169), add:

```swift
// Use server-side created_at instead of local Date()
if let serverCreatedAt = dto.createdAtParsed {
    project.createdAt = serverCreatedAt
}
```

**Step 3: Build and verify**

Run: `xcodebuild -project AmiDashField.xcodeproj -scheme AmiDashField -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 16' build`
Expected: BUILD SUCCEEDED

---

## Task 2: Add delivery address fields to ProjectDTO and sync

**Files:**
- Modify: `/Users/faraz/Desktop/AmiDashField-iOS/AmiDashField/Core/Sync/SyncManager.swift`

**Step 1: Add delivery address fields to `ProjectDTO` struct (~line 332)**

Add these fields to the `ProjectDTO` struct:

```swift
let delivery_street: String?
let delivery_city: String?
let delivery_state: String?
let delivery_zip: String?
```

**Step 2: Add address mapping in the "Update existing" block**

After the `existing.scopeLink = dto.scope_link` line (~137), add:

```swift
// Address fields (from delivery_ columns in web DB)
existing.address = dto.delivery_street
existing.city = dto.delivery_city
existing.state = dto.delivery_state
existing.zipCode = dto.delivery_zip
```

**Step 3: Add address mapping in the "Create new" block**

In the `Project(...)` initializer call (~line 151-167), add the address parameters:

```swift
address: dto.delivery_street,
city: dto.delivery_city,
state: dto.delivery_state,
zipCode: dto.delivery_zip,
```

**Step 4: Update the Supabase select query to include delivery fields**

The current select is `"*, current_status:statuses(*)"` (line 111). The `*` already includes all columns, so delivery fields are already fetched. No change needed.

**Step 5: Build and verify**

Run: `xcodebuild -project AmiDashField.xcodeproj -scheme AmiDashField -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 16' build`
Expected: BUILD SUCCEEDED

---

## Task 3: Add Maps navigation to DashboardProjectDetailView

**Files:**
- Modify: `/Users/faraz/Desktop/AmiDashField-iOS/AmiDashField/Features/Dashboard/DashboardProjectDetailView.swift`

The `ProjectDetailView` already has Maps navigation via `MapSheet` and `openInMaps()`. The `DashboardProjectDetailView` shows the address but doesn't let you navigate. Fix this.

**Step 1: Replace the static `addressSection` with a tappable Maps button**

Replace the current `addressSection` method (~line 233-250) with:

```swift
private func addressSection(_ address: String) -> some View {
    VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
        Text("Location")
            .font(.caption)
            .fontWeight(.medium)
            .foregroundStyle(.secondary)
            .textCase(.uppercase)

        Button {
            openInMaps(address: address)
        } label: {
            HStack {
                Image(systemName: "mappin.circle.fill")
                    .foregroundStyle(.red)
                Text(address)
                    .font(.subheadline)
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.leading)
                Spacer()
                Image(systemName: "arrow.up.forward.square")
                    .foregroundStyle(Theme.Brand.darkGreen)
            }
        }
        .buttonStyle(.plain)
    }
    .cardStyle()
}
```

**Step 2: Add the `openInMaps` helper method**

Add this method to `DashboardProjectDetailView` (after the `formatDate` helper):

```swift
private func openInMaps(address: String) {
    let encodedAddress = address.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
    if let url = URL(string: "maps://?q=\(encodedAddress)") {
        UIApplication.shared.open(url)
    }
}
```

**Step 3: Build and verify**

Run: `xcodebuild -project AmiDashField.xcodeproj -scheme AmiDashField -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 16' build`
Expected: BUILD SUCCEEDED

---

## Task 4: Run full test suite

Run: `xcodebuild -project AmiDashField.xcodeproj -scheme AmiDashField -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 16' test`
Expected: All tests pass, 0 failures

---

## Task 5: Commit

```bash
cd /Users/faraz/Desktop/AmiDashField-iOS
git add -A
git commit -m "fix: sync createdAt and delivery address from server, add Maps navigation

- Sync server-side created_at to fix dashboard period filter calculations
- Sync delivery_street/city/state/zip from web DB to populate address fields
- Add Apple Maps navigation button to DashboardProjectDetailView"
```

---

## Verification Checklist

After implementation, verify in the simulator:

1. **Dashboard period filters:** Switch between This Week / This Month / This Quarter / This Year — PO Received and Invoiced amounts should change based on actual server creation/invoice dates
2. **Project detail address:** Open a project that has a delivery address in the web app — should show the LOCATION card with the address
3. **Maps navigation (ProjectDetailView):** Tap the address — should open Maps sheet with "Open in Maps" button
4. **Maps navigation (DashboardProjectDetailView):** Tap the address in dashboard detail — should open Apple Maps directly
5. **Projects without address:** Should NOT show any location card (graceful nil handling)
