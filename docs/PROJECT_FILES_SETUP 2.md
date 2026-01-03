# Project Files & Documents Management System - Setup Guide

This document outlines the steps needed to complete the setup of the Project Files feature with SharePoint integration and offline capture support.

## Overview

The Project Files feature enables:
- Storing and managing project files in SharePoint
- Capturing photos/videos directly from iOS devices
- Offline file capture with automatic sync when online
- Pre-sales file tracking linked to ActiveCampaign deals
- File categorization (Schematics, SOW, Photos, Videos, Other)

---

## 1. Database Migration

Run the database migration to create the required tables:

```bash
# Using Supabase CLI
npx supabase db push

# Or run the migration directly
npx supabase migration up
```

This creates:
- `project_sharepoint_connections` - Links projects to SharePoint folders
- `project_files` - Tracks files for active projects
- `presales_files` - Tracks pre-PO files (linked to ActiveCampaign Deal ID)
- `project_file_access_logs` - Audit trail

---

## 2. Microsoft Azure App Configuration

### Add SharePoint Permissions

1. Go to [Azure Portal](https://portal.azure.com) → Azure Active Directory → App registrations
2. Select your app (the one used for calendar integration)
3. Go to **API permissions** → **Add a permission**
4. Select **Microsoft Graph** → **Delegated permissions**
5. Add these permissions:
   - `Sites.Read.All` - Read SharePoint sites
   - `Files.ReadWrite.All` - Read/write files in OneDrive and SharePoint
6. Click **Grant admin consent** (requires admin)

### Verify Redirect URIs

Ensure your redirect URIs are configured:
- `https://your-domain.com/api/auth/microsoft/callback`
- `http://localhost:3000/api/auth/microsoft/callback` (for development)

---

## 3. Re-authenticate Microsoft Connection

Users need to re-authenticate to get tokens with the new SharePoint scopes:

1. Go to the app's calendar settings
2. Click "Disconnect Microsoft Account"
3. Click "Connect Microsoft Account" again
4. Approve the new SharePoint permissions in the consent screen

---

## 4. PWA Icons

Add PWA icons to the `/public` folder:

```
public/
├── icon-192x192.png   (192x192 pixels)
├── icon-512x512.png   (512x512 pixels)
└── manifest.json      (already created)
```

You can generate icons from your logo using:
- [PWA Asset Generator](https://github.com/nicnocquee/pwa-asset-generator)
- [Favicon.io](https://favicon.io/)
- [Real Favicon Generator](https://realfavicongenerator.net/)

---

## 5. Environment Variables

Ensure these environment variables are set:

```env
# Microsoft OAuth (already configured for calendar)
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_REDIRECT_URI=https://your-domain.com/api/auth/microsoft/callback
MICROSOFT_TENANT_ID=your-tenant-id  # or 'common' for multi-tenant
```

---

## 6. SharePoint Folder Structure

When a project is connected to SharePoint, the system creates this folder structure:

```
/Projects/[ProjectName]/
├── Schematics/     # Engineering drawings, CAD files
├── SOW/            # Scope of work documents
├── Photos/         # Site photos
├── Videos/         # Site videos
└── Other/          # Miscellaneous files
```

### Recommended SharePoint Setup

1. Create a dedicated SharePoint site or document library for projects
2. Create a root "Projects" folder
3. Users can then select this folder when connecting a project

---

## 7. Testing the Feature

### Test SharePoint Connection

1. Navigate to a project → Files
2. Click "Connect SharePoint"
3. Browse and select a folder
4. Verify subfolders are created

### Test File Upload

1. Upload a file using the upload button
2. Verify it appears in SharePoint
3. Verify thumbnail is displayed (for images)

### Test Offline Capture (iOS)

1. Open the app on an iPhone/iPad
2. Add to Home Screen (for PWA experience)
3. Turn on Airplane Mode
4. Capture a photo using the camera button
5. Turn off Airplane Mode
6. Verify the file syncs automatically

### Test Pre-sales Files

1. Create a file linked to an ActiveCampaign Deal ID
2. Create a project from that deal
3. Migrate the presales files to the project

---

## 8. API Endpoints

### SharePoint Browsing

```
GET /api/sharepoint/sites                    # List SharePoint sites
GET /api/sharepoint/sites/[siteId]/drives    # List drives in a site
GET /api/sharepoint/drives/[driveId]/folders/[folderId]  # List folder contents
```

### File Upload API (for offline sync)

Create these endpoints for the background sync to work:

```typescript
// src/app/api/files/upload/route.ts
POST /api/files/upload
- FormData: file, projectId, category, phase, notes, capturedOffline, capturedOnDevice

// src/app/api/files/presales/upload/route.ts
POST /api/files/presales/upload
- FormData: file, dealId, category, notes, capturedOffline, capturedOnDevice
```

---

## 9. Troubleshooting

### "Please connect your Microsoft account first"

- User needs to connect their Microsoft account in calendar settings
- Ensure the Microsoft app has SharePoint permissions

### Files not syncing offline

- Check if Service Worker is registered (DevTools → Application → Service Workers)
- Verify IndexedDB has data (DevTools → Application → IndexedDB → amidash-offline)
- Check console for sync errors

### SharePoint permission errors

- Verify `Sites.Read.All` and `Files.ReadWrite.All` permissions in Azure
- Ensure admin consent was granted
- Re-authenticate to get new token

### PWA not installable

- Check manifest.json is accessible at `/manifest.json`
- Verify icons exist at specified paths
- Must be served over HTTPS (except localhost)

---

## 10. Future Enhancements

### Planned Features

- [ ] File version history
- [ ] Bulk file operations (delete, move, download)
- [ ] File search across projects
- [ ] Integration with Odoo for SOW documents
- [ ] ActiveCampaign webhook for automatic presales file association
- [ ] File previews (PDF, Office documents)
- [ ] Geolocation tagging for photos
- [ ] File annotations/comments

### Performance Optimizations

- [ ] Lazy loading for large file lists
- [ ] Virtual scrolling for grid view
- [ ] Image compression before upload
- [ ] Progressive image loading

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Browser/PWA)                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  FileBrowser │  │CameraCapture│  │   Offline IndexedDB    │  │
│  │  Component   │  │  Component  │  │   (file queue)         │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                      │                │
│         ▼                ▼                      ▼                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Server Actions                            ││
│  │  (uploadFile, syncFiles, deleteFile, etc.)                  ││
│  └──────────────────────────┬──────────────────────────────────┘│
└─────────────────────────────┼───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Backend                                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐           ┌──────────────────────────────┐ │
│  │   Supabase      │           │   Microsoft Graph API        │ │
│  │   (metadata)    │◄─────────►│   (SharePoint files)         │ │
│  │                 │           │                              │ │
│  │ - project_files │           │ - Upload/Download            │ │
│  │ - presales_files│           │ - Thumbnails                 │ │
│  │ - connections   │           │ - Share links                │ │
│  └─────────────────┘           └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Locations

| Component | Location |
|-----------|----------|
| Database Migration | `supabase/migrations/023_project_files.sql` |
| TypeScript Types | `src/types/index.ts` |
| SharePoint Client | `src/lib/sharepoint/` |
| UI Components | `src/components/files/` |
| Server Actions | `src/app/(dashboard)/projects/[id]/files/actions.ts` |
| Files Page | `src/app/(dashboard)/projects/[id]/files/` |
| API Routes | `src/app/api/sharepoint/` |
| Offline Storage | `src/lib/offline/` |
| Offline Hook | `src/hooks/use-offline-files.ts` |
| PWA Config | `next.config.ts`, `public/manifest.json` |
