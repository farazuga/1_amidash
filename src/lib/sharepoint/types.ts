/**
 * Types for Microsoft SharePoint integration via Graph API
 */

import type { FileCategory } from '@/types';

// SharePoint connection stored in database
export interface SharePointConnection {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  site_id: string | null;
  site_url: string | null;
  created_at: string;
  updated_at: string;
}

// Microsoft Graph API response types
export interface SharePointSite {
  id: string;
  name: string;
  displayName: string;
  webUrl: string;
  siteCollection?: {
    hostname: string;
  };
}

export interface SharePointDrive {
  id: string;
  name: string;
  driveType: 'personal' | 'business' | 'documentLibrary';
  webUrl: string;
  owner?: {
    user?: {
      displayName: string;
      email: string;
    };
  };
}

export interface SharePointDriveItem {
  id: string;
  name: string;
  size: number;
  webUrl: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  createdBy?: {
    user?: {
      displayName: string;
      email: string;
    };
  };
  lastModifiedBy?: {
    user?: {
      displayName: string;
      email: string;
    };
  };
  file?: {
    mimeType: string;
    hashes?: {
      quickXorHash?: string;
      sha1Hash?: string;
      sha256Hash?: string;
    };
  };
  folder?: {
    childCount: number;
  };
  image?: {
    height: number;
    width: number;
  };
  video?: {
    duration: number;
    height: number;
    width: number;
  };
  thumbnails?: SharePointThumbnail[];
  '@microsoft.graph.downloadUrl'?: string;
  parentReference?: {
    driveId: string;
    id: string;
    path: string;
  };
}

export interface SharePointThumbnail {
  id: string;
  large?: { url: string; width: number; height: number };
  medium?: { url: string; width: number; height: number };
  small?: { url: string; width: number; height: number };
}

export interface SharePointListResponse<T> {
  '@odata.context'?: string;
  '@odata.nextLink'?: string;
  value: T[];
}

// Upload session for large files
export interface SharePointUploadSession {
  uploadUrl: string;
  expirationDateTime: string;
  nextExpectedRanges: string[];
}

// Folder creation request
export interface CreateFolderRequest {
  name: string;
  folder: Record<string, never>;  // Empty object for folder marker
  '@microsoft.graph.conflictBehavior': 'rename' | 'replace' | 'fail';
}

// File upload result
export interface FileUploadResult {
  success: boolean;
  item?: SharePointDriveItem;
  error?: string;
}

// Folder structure for project
export interface ProjectFolderStructure {
  projectId: string;
  projectName: string;
  siteId: string;
  driveId: string;
  rootFolderId: string;
  rootFolderPath: string;
  categoryFolders: Record<FileCategory, {
    folderId: string;
    folderPath: string;
  }>;
}

// SharePoint configuration
export interface SharePointConfig {
  siteUrl: string;  // e.g., "contoso.sharepoint.com"
  sitePath: string; // e.g., "/sites/AmiDash"
  documentLibrary: string; // e.g., "Documents"
  projectsFolder: string;  // e.g., "Projects"
  presalesFolder: string;  // e.g., "PreSales"
}

// Sync status for tracking
export interface SharePointSyncStatus {
  lastSyncAt: string | null;
  filesCount: number;
  pendingUploads: number;
  syncErrors: string[];
}

// Search result
export interface SharePointSearchResult {
  items: SharePointDriveItem[];
  totalCount: number;
  hasMore: boolean;
  nextLink?: string;
}

// Permission types
export interface SharePointPermission {
  id: string;
  roles: ('read' | 'write' | 'owner')[];
  grantedTo?: {
    user?: {
      displayName: string;
      email: string;
    };
  };
  link?: {
    type: 'view' | 'edit';
    webUrl: string;
    scope: 'anonymous' | 'organization';
  };
}

// Share link creation
export interface CreateShareLinkRequest {
  type: 'view' | 'edit';
  scope: 'anonymous' | 'organization';
  expirationDateTime?: string;
}

export interface ShareLinkResult {
  id: string;
  link: {
    type: string;
    webUrl: string;
    scope: string;
  };
}
