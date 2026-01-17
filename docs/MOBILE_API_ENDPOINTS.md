# Mobile API Endpoints for AmiDash Web App

The iOS app uses these API endpoints to enable SharePoint file uploads via the existing web app authentication.

## Required Endpoints

### 1. `POST /api/mobile/sharepoint/upload`

Upload a file to SharePoint via the backend.

**Authentication:** Bearer token (Supabase JWT) in Authorization header

**Request:**
- Content-Type: `multipart/form-data`
- Headers: `Authorization: Bearer <supabase-jwt>`
- Body fields:
  - `file` - The file to upload
  - `projectId` - Project database UUID (not sales order number)
  - `category` - File category (see valid values below)
  - `notes` (optional) - Notes about the file

**Valid Category Values:**
| Category | Description | SharePoint Folder |
|----------|-------------|-------------------|
| `schematics` | Technical drawings | Schematics |
| `sow` | Scope of work documents | SOW |
| `media` | Photos and videos | Photos & Videos |
| `other` | Miscellaneous files | Other |

> **Note:** Legacy values `photos` and `videos` are accepted but map to `media` internally.

**Response (200):**
```json
{
  "success": true,
  "file": {
    "id": "uuid-database-record-id",
    "project_id": "project-uuid",
    "file_name": "photo_001.jpg",
    "category": "media",
    "file_size": 1234567,
    "mime_type": "image/jpeg",
    "file_extension": "jpg",
    "web_url": "https://yourtenant.sharepoint.com/sites/.../photo_001.jpg",
    "download_url": "https://...",
    "thumbnail_url": "https://...",
    "sharepoint_item_id": "sharepoint-internal-id",
    "created_at": "2024-01-16T12:00:00Z",
    "uploaded_by": "user-uuid"
  }
}
```

**Errors:**
| Status | Response | Cause |
|--------|----------|-------|
| `400` | `{"error": "File is required"}` | Missing file in form data |
| `400` | `{"error": "Project ID is required"}` | Missing projectId field |
| `400` | `{"error": "Category is required"}` | Missing category field |
| `401` | `{"error": "Authentication required"}` | Invalid/expired Supabase token |
| `403` | `{"error": "Please connect your Microsoft account"}` | User hasn't connected Microsoft in web app |
| `404` | `{"error": "Project not found"}` | Invalid projectId |
| `500` | `{"error": "<message>"}` | Server error (retry with backoff) |

**Implementation Notes:**
```typescript
// src/app/api/mobile/sharepoint/upload/route.ts
import { createClient } from '@supabase/supabase-js';
import { uploadFile } from '@/app/(dashboard)/projects/[salesOrder]/files/actions';
import type { FileCategory } from '@/types';

export async function POST(request: Request) {
  // 1. Extract Bearer token from Authorization header
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  // 2. Verify token with Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  // 3. Parse multipart form data
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const projectId = formData.get('projectId') as string | null;
  const category = formData.get('category') as FileCategory | null;
  const notes = formData.get('notes') as string | null;

  // 4. Validate required fields
  if (!file) {
    return Response.json({ error: 'File is required' }, { status: 400 });
  }
  if (!projectId) {
    return Response.json({ error: 'Project ID is required' }, { status: 400 });
  }
  if (!category) {
    return Response.json({ error: 'Category is required' }, { status: 400 });
  }

  // 5. Convert file to ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  // 6. Upload using existing server action
  // Note: The uploadFile action handles:
  // - Getting the user's Microsoft connection
  // - Auto-creating project SharePoint folder if needed
  // - Creating category subfolders
  // - Token refresh if Microsoft token is expired
  const result = await uploadFile({
    projectId,
    fileName: file.name,
    fileContent: arrayBuffer,
    contentType: file.type,
    category,
    notes: notes || undefined,
    capturedOnDevice: 'ios',
  });

  if (!result.success) {
    // Map error messages to appropriate status codes
    if (result.error?.includes('Microsoft account')) {
      return Response.json({ error: result.error }, { status: 403 });
    }
    if (result.error?.includes('not found')) {
      return Response.json({ error: result.error }, { status: 404 });
    }
    return Response.json({ error: result.error || 'Upload failed' }, { status: 500 });
  }

  return Response.json({
    success: true,
    file: result.file,
  });
}
```

**Key Implementation Details:**
- The `uploadFile` server action automatically handles SharePoint folder creation
- Token refresh for Microsoft Graph API is handled internally
- Project folders are auto-created on first upload if global SharePoint is configured
- Category subfolders (Schematics, SOW, Photos & Videos, Other) are created automatically

---

### 2. `GET /api/mobile/microsoft/status`

Check if user has connected their Microsoft account.

**Authentication:** Bearer token (Supabase JWT)

**Response (200):**
```json
{
  "connected": true,
  "email": "user@company.com",
  "expires_at": "2024-01-17T00:00:00Z"
}
```

Or if not connected:
```json
{
  "connected": false,
  "email": null,
  "expires_at": null
}
```

**Implementation:**
```typescript
// src/app/api/mobile/microsoft/status/route.ts
import { createClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  // 1. Extract and verify Bearer token
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  // 2. Check for Microsoft connection
  const serviceClient = await createServiceClient();
  const { data: connection } = await serviceClient
    .from('calendar_connections')
    .select('email, token_expires_at')
    .eq('user_id', user.id)
    .eq('provider', 'microsoft')
    .maybeSingle();

  return Response.json({
    connected: !!connection,
    email: connection?.email ?? null,
    expires_at: connection?.token_expires_at ?? null,
  });
}
```

---

### 3. `GET /api/mobile/projects` (Recommended)

List projects the user can upload files to.

**Authentication:** Bearer token (Supabase JWT)

**Response (200):**
```json
{
  "projects": [
    {
      "id": "project-uuid",
      "sales_order": "SO-12345",
      "client_name": "Acme Corp",
      "status": "active"
    }
  ]
}
```

> **Note:** This endpoint is recommended so the iOS app can get valid `projectId` values.

---

## Authentication Flow

```
+------------------------------------------------------------------+
|                     iOS App -> Web API Flow                       |
+------------------------------------------------------------------+
|                                                                   |
|  1. iOS App signs in via Supabase                                 |
|     +-- Gets Supabase JWT token                                   |
|                                                                   |
|  2. iOS App calls /api/mobile/microsoft/status                    |
|     +-- Checks if Microsoft account is connected                  |
|     +-- If not connected: prompt user to connect in web app       |
|                                                                   |
|  3. iOS App calls /api/mobile/sharepoint/upload                   |
|     +-- Sends: Authorization: Bearer <supabase-jwt>               |
|     +-- Sends: multipart form with file, projectId, category      |
|                                                                   |
|  4. Web API validates Supabase JWT                                |
|     +-- Extracts token from Authorization header                  |
|     +-- Verifies with supabase.auth.getUser(token)                |
|                                                                   |
|  5. Web API gets Microsoft connection from database               |
|     +-- Looks up calendar_connections for user                    |
|     +-- Auto-refreshes token if expired                           |
|                                                                   |
|  6. Web API ensures project folder exists                         |
|     +-- Creates SharePoint folder if first upload                 |
|     +-- Creates category subfolders automatically                 |
|                                                                   |
|  7. Web API uploads to SharePoint                                 |
|     +-- Uses Microsoft Graph API                                  |
|     +-- Handles small (<4MB) and large files differently          |
|                                                                   |
|  8. Web API saves record to database                              |
|     +-- Stores in project_files table                             |
|     +-- Gets thumbnail URL if image/video                         |
|                                                                   |
|  9. Returns file record to iOS app                                |
|                                                                   |
+------------------------------------------------------------------+
```

---

## Folder Structure

Files are organized in SharePoint as:
```
SharePoint Drive/
+-- {ProjectBasePath}/
    +-- {ProjectName}/
        +-- Schematics/
        |   +-- drawing.pdf
        +-- SOW/
        |   +-- scope.docx
        +-- Photos & Videos/
        |   +-- photo_001.jpg
        |   +-- video_001.mp4
        +-- Other/
            +-- misc.pdf
```

> **Note:** Project folders and category subfolders are created automatically on first upload.

---

## Error Handling

### iOS Error Handling Guide

| HTTP Status | Response | iOS Behavior |
|-------------|----------|--------------|
| `401` | `{"error": "Authentication required"}` | Re-authenticate with Supabase, get new JWT |
| `403` | `{"error": "Please connect your Microsoft account"}` | Show "Connect Microsoft account in web app" |
| `400` | `{"error": "..."}` | Show validation error to user |
| `404` | `{"error": "Project not found"}` | Remove project from local cache, show error |
| `500` | `{"error": "..."}` | Retry with exponential backoff (max 3 attempts) |

### Retry Strategy
```swift
// Recommended iOS retry logic
func uploadWithRetry(maxAttempts: Int = 3) async throws {
    var attempt = 0
    var lastError: Error?

    while attempt < maxAttempts {
        do {
            return try await uploadFile()
        } catch let error as APIError where error.statusCode >= 500 {
            attempt += 1
            lastError = error
            try await Task.sleep(nanoseconds: UInt64(pow(2.0, Double(attempt))) * 1_000_000_000)
        } catch {
            throw error  // Don't retry 4xx errors
        }
    }

    throw lastError ?? APIError.unknown
}
```

---

## Testing

### Test from Command Line

```bash
# Get your Supabase JWT (from browser dev tools or iOS app)
TOKEN="your-supabase-jwt"

# 1. Check Microsoft connection status
curl -H "Authorization: Bearer $TOKEN" \
  https://dash.amitrace.com/api/mobile/microsoft/status

# 2. Upload a file (replace PROJECT_UUID with actual project ID)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.jpg" \
  -F "projectId=PROJECT_UUID" \
  -F "category=media" \
  https://dash.amitrace.com/api/mobile/sharepoint/upload
```

### Getting a Test Token

1. Open AmiDash web app in browser
2. Open Developer Tools (F12)
3. Go to Application > Local Storage
4. Find the Supabase auth token (key starts with `sb-`)
5. Parse the JSON and extract `access_token`

---

## iOS App Migration Guide

If updating from an older API spec, make these changes:

### 1. Category Values

**Before:**
```swift
enum FileCategory: String {
    case photos
    case videos
    case schematics
}
```

**After:**
```swift
enum FileCategory: String {
    case schematics
    case sow
    case media      // Use this for photos AND videos
    case other
}
```

### 2. Response Parsing

**Before:**
```swift
struct UploadResponse: Codable {
    let success: Bool
    let fileUrl: String?
    let sharePointPath: String?
    let fileId: String?
}
```

**After:**
```swift
struct UploadResponse: Codable {
    let success: Bool
    let file: ProjectFile?
    let error: String?
}

struct ProjectFile: Codable {
    let id: String              // Database UUID
    let projectId: String
    let fileName: String
    let category: String
    let fileSize: Int
    let mimeType: String
    let webUrl: String          // Was "fileUrl"
    let downloadUrl: String?
    let thumbnailUrl: String?
    let sharepointItemId: String
    let createdAt: String
    let uploadedBy: String

    enum CodingKeys: String, CodingKey {
        case id
        case projectId = "project_id"
        case fileName = "file_name"
        case category
        case fileSize = "file_size"
        case mimeType = "mime_type"
        case webUrl = "web_url"
        case downloadUrl = "download_url"
        case thumbnailUrl = "thumbnail_url"
        case sharepointItemId = "sharepoint_item_id"
        case createdAt = "created_at"
        case uploadedBy = "uploaded_by"
    }
}
```

### 3. Field Mapping

| Old Field | New Field |
|-----------|-----------|
| `fileUrl` | `file.webUrl` |
| `sharePointPath` | Not needed (derive from `webUrl` if required) |
| `fileId` | `file.id` (database) or `file.sharepointItemId` (SharePoint) |

### 4. Project ID

Use the database UUID for `projectId`, not the sales order number.

**How to get project IDs:**
- From the projects list endpoint (recommended)
- From project detail screens in the web app
- The `id` field in any project response

---

## Endpoints Not Yet Implemented

The following endpoints from the original spec are optional and not yet implemented:

### `GET /api/mobile/sharepoint/token` (Optional)

Returns SharePoint access token for direct uploads. **Not recommended** - prefer server-side uploads via `/upload` endpoint for security.

### `GET /api/mobile/sharepoint/config` (Optional)

Returns SharePoint site/drive configuration. Not needed if using the `/upload` endpoint which handles this automatically.
