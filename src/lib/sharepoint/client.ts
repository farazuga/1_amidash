/**
 * SharePoint client using Microsoft Graph API
 * Handles file operations: upload, download, list, create folders
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { refreshAccessToken, isTokenExpired, calculateExpiresAt } from '../microsoft-graph/auth';
import { createServiceClient } from '@/lib/supabase/server';
import type { CalendarConnection } from '../microsoft-graph/types';
import type {
  SharePointSite,
  SharePointDrive,
  SharePointDriveItem,
  SharePointListResponse,
  SharePointUploadSession,
  FileUploadResult,
  CreateFolderRequest,
  ShareLinkResult,
  CreateShareLinkRequest,
} from './types';
import type { FileCategory } from '@/types';

// Re-use the calendar connection for SharePoint (same Microsoft OAuth)
type MicrosoftConnection = CalendarConnection;

/**
 * Get a Microsoft Graph client with valid access token
 * Reuses the pattern from calendar integration
 */
export async function getSharePointClient(
  connection: MicrosoftConnection
): Promise<{ client: Client; connection: MicrosoftConnection }> {
  let currentConnection = connection;

  // Check if token needs refresh
  if (isTokenExpired(connection.token_expires_at)) {
    console.log('[SharePoint] Access token expired, refreshing...');

    try {
      const newTokens = await refreshAccessToken(connection.refresh_token);

      // Update tokens in database
      const supabase = await createServiceClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('calendar_connections')
        .update({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          token_expires_at: calculateExpiresAt(newTokens.expires_in).toISOString(),
        })
        .eq('id', connection.id);

      if (error) {
        console.error('[SharePoint] Failed to update tokens:', error);
        throw new Error('Failed to update refreshed tokens');
      }

      currentConnection = {
        ...connection,
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        token_expires_at: calculateExpiresAt(newTokens.expires_in).toISOString(),
      };
    } catch (error) {
      console.error('[SharePoint] Token refresh failed:', error);
      throw new Error('Failed to refresh access token. User may need to reconnect.');
    }
  }

  const client = Client.init({
    authProvider: (done) => {
      done(null, currentConnection.access_token);
    },
  });

  return { client, connection: currentConnection };
}

/**
 * Get the user's default SharePoint site
 */
export async function getDefaultSite(
  connection: MicrosoftConnection
): Promise<SharePointSite> {
  const { client } = await getSharePointClient(connection);

  // Get the root SharePoint site for the organization
  const site = await client.api('/sites/root').get();

  return site;
}

/**
 * Get a specific SharePoint site by URL
 */
export async function getSiteByUrl(
  connection: MicrosoftConnection,
  hostname: string,
  sitePath: string
): Promise<SharePointSite> {
  const { client } = await getSharePointClient(connection);

  // Format: /sites/{hostname}:/{site-path}
  const site = await client.api(`/sites/${hostname}:${sitePath}`).get();

  return site;
}

/**
 * List available SharePoint sites the user has access to
 */
export async function listSites(
  connection: MicrosoftConnection
): Promise<SharePointSite[]> {
  const { client } = await getSharePointClient(connection);

  const response: SharePointListResponse<SharePointSite> = await client
    .api('/sites')
    .query({ search: '*' })  // Search for all sites
    .top(50)
    .get();

  return response.value;
}

/**
 * Get the default document library drive for a site
 */
export async function getDefaultDrive(
  connection: MicrosoftConnection,
  siteId: string
): Promise<SharePointDrive> {
  const { client } = await getSharePointClient(connection);

  const drive = await client.api(`/sites/${siteId}/drive`).get();

  return drive;
}

/**
 * List all drives (document libraries) in a site
 */
export async function listDrives(
  connection: MicrosoftConnection,
  siteId: string
): Promise<SharePointDrive[]> {
  const { client } = await getSharePointClient(connection);

  const response: SharePointListResponse<SharePointDrive> = await client
    .api(`/sites/${siteId}/drives`)
    .get();

  return response.value;
}

/**
 * List items (files and folders) in a drive folder
 */
export async function listFolderContents(
  connection: MicrosoftConnection,
  driveId: string,
  folderId: string = 'root'
): Promise<SharePointDriveItem[]> {
  const { client } = await getSharePointClient(connection);

  const response: SharePointListResponse<SharePointDriveItem> = await client
    .api(`/drives/${driveId}/items/${folderId}/children`)
    .expand('thumbnails')
    .top(100)
    .get();

  return response.value;
}

/**
 * List items by folder path
 */
export async function listFolderContentsByPath(
  connection: MicrosoftConnection,
  driveId: string,
  folderPath: string
): Promise<SharePointDriveItem[]> {
  const { client } = await getSharePointClient(connection);

  // Encode the path properly
  const encodedPath = folderPath.startsWith('/') ? folderPath : `/${folderPath}`;

  const response: SharePointListResponse<SharePointDriveItem> = await client
    .api(`/drives/${driveId}/root:${encodedPath}:/children`)
    .expand('thumbnails')
    .top(100)
    .get();

  return response.value;
}

/**
 * Get a specific item by ID
 */
export async function getItem(
  connection: MicrosoftConnection,
  driveId: string,
  itemId: string
): Promise<SharePointDriveItem> {
  const { client } = await getSharePointClient(connection);

  const item = await client
    .api(`/drives/${driveId}/items/${itemId}`)
    .expand('thumbnails')
    .get();

  return item;
}

/**
 * Get item by path
 */
export async function getItemByPath(
  connection: MicrosoftConnection,
  driveId: string,
  itemPath: string
): Promise<SharePointDriveItem | null> {
  const { client } = await getSharePointClient(connection);

  try {
    const encodedPath = itemPath.startsWith('/') ? itemPath : `/${itemPath}`;
    const item = await client
      .api(`/drives/${driveId}/root:${encodedPath}`)
      .expand('thumbnails')
      .get();

    return item;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Create a folder in a drive
 */
export async function createFolder(
  connection: MicrosoftConnection,
  driveId: string,
  parentFolderId: string,
  folderName: string
): Promise<SharePointDriveItem> {
  const { client } = await getSharePointClient(connection);

  const folderData: CreateFolderRequest = {
    name: folderName,
    folder: {},
    '@microsoft.graph.conflictBehavior': 'rename',
  };

  const folder = await client
    .api(`/drives/${driveId}/items/${parentFolderId}/children`)
    .post(folderData);

  return folder;
}

/**
 * Create a folder by path (creates parent folders if needed)
 */
export async function createFolderByPath(
  connection: MicrosoftConnection,
  driveId: string,
  folderPath: string
): Promise<SharePointDriveItem> {
  const { client } = await getSharePointClient(connection);

  const encodedPath = folderPath.startsWith('/') ? folderPath : `/${folderPath}`;

  const folderData: CreateFolderRequest = {
    name: folderPath.split('/').pop() || 'New Folder',
    folder: {},
    '@microsoft.graph.conflictBehavior': 'rename',
  };

  // Get parent path
  const parentPath = encodedPath.substring(0, encodedPath.lastIndexOf('/')) || '/';

  const folder = await client
    .api(`/drives/${driveId}/root:${parentPath}:/children`)
    .post(folderData);

  return folder;
}

/**
 * Create the standard folder structure for a project
 */
export async function createProjectFolderStructure(
  connection: MicrosoftConnection,
  driveId: string,
  baseFolderId: string,
  projectName: string,
  categories: FileCategory[] = ['schematics', 'sow', 'photos', 'videos', 'other']
): Promise<Record<FileCategory, SharePointDriveItem>> {
  // Create main project folder
  const projectFolder = await createFolder(connection, driveId, baseFolderId, projectName);

  // Create category subfolders
  const categoryFolders: Partial<Record<FileCategory, SharePointDriveItem>> = {};

  for (const category of categories) {
    const categoryName = getCategoryFolderName(category);
    const folder = await createFolder(connection, driveId, projectFolder.id, categoryName);
    categoryFolders[category] = folder;
  }

  return categoryFolders as Record<FileCategory, SharePointDriveItem>;
}

/**
 * Upload a small file (< 4MB) directly
 */
export async function uploadSmallFile(
  connection: MicrosoftConnection,
  driveId: string,
  folderId: string,
  fileName: string,
  fileContent: ArrayBuffer | Blob,
  contentType: string
): Promise<FileUploadResult> {
  const { client } = await getSharePointClient(connection);

  try {
    // Convert Blob to ArrayBuffer if needed
    const content = fileContent instanceof Blob
      ? await fileContent.arrayBuffer()
      : fileContent;

    const item = await client
      .api(`/drives/${driveId}/items/${folderId}:/${fileName}:/content`)
      .header('Content-Type', contentType)
      .put(content);

    return { success: true, item };
  } catch (error) {
    console.error('[SharePoint] Upload failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
}

/**
 * Create an upload session for large files (> 4MB)
 */
export async function createUploadSession(
  connection: MicrosoftConnection,
  driveId: string,
  folderId: string,
  fileName: string
): Promise<SharePointUploadSession> {
  const { client } = await getSharePointClient(connection);

  const session = await client
    .api(`/drives/${driveId}/items/${folderId}:/${fileName}:/createUploadSession`)
    .post({
      item: {
        '@microsoft.graph.conflictBehavior': 'rename',
      },
    });

  return session;
}

/**
 * Upload a large file in chunks using upload session
 */
export async function uploadLargeFile(
  connection: MicrosoftConnection,
  driveId: string,
  folderId: string,
  fileName: string,
  fileContent: Blob,
  onProgress?: (progress: number) => void
): Promise<FileUploadResult> {
  try {
    const session = await createUploadSession(connection, driveId, folderId, fileName);

    const chunkSize = 320 * 1024 * 10; // 3.2MB chunks (must be multiple of 320KB)
    const fileSize = fileContent.size;
    let uploadedBytes = 0;

    while (uploadedBytes < fileSize) {
      const chunkEnd = Math.min(uploadedBytes + chunkSize, fileSize);
      const chunk = fileContent.slice(uploadedBytes, chunkEnd);
      const chunkBuffer = await chunk.arrayBuffer();

      const response = await fetch(session.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': String(chunkEnd - uploadedBytes),
          'Content-Range': `bytes ${uploadedBytes}-${chunkEnd - 1}/${fileSize}`,
        },
        body: chunkBuffer,
      });

      if (!response.ok) {
        throw new Error(`Chunk upload failed: ${response.statusText}`);
      }

      uploadedBytes = chunkEnd;

      if (onProgress) {
        onProgress(Math.round((uploadedBytes / fileSize) * 100));
      }

      // Check if upload is complete
      if (response.status === 201 || response.status === 200) {
        const item = await response.json();
        return { success: true, item };
      }
    }

    return { success: false, error: 'Upload did not complete' };
  } catch (error) {
    console.error('[SharePoint] Large file upload failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Upload a file (automatically chooses small or large file method)
 */
export async function uploadFile(
  connection: MicrosoftConnection,
  driveId: string,
  folderId: string,
  fileName: string,
  fileContent: Blob,
  contentType: string,
  onProgress?: (progress: number) => void
): Promise<FileUploadResult> {
  const SMALL_FILE_THRESHOLD = 4 * 1024 * 1024; // 4MB

  if (fileContent.size < SMALL_FILE_THRESHOLD) {
    return uploadSmallFile(connection, driveId, folderId, fileName, fileContent, contentType);
  } else {
    return uploadLargeFile(connection, driveId, folderId, fileName, fileContent, onProgress);
  }
}

/**
 * Delete an item (file or folder)
 */
export async function deleteItem(
  connection: MicrosoftConnection,
  driveId: string,
  itemId: string
): Promise<void> {
  const { client } = await getSharePointClient(connection);

  await client.api(`/drives/${driveId}/items/${itemId}`).delete();
}

/**
 * Get a download URL for a file
 */
export async function getDownloadUrl(
  connection: MicrosoftConnection,
  driveId: string,
  itemId: string
): Promise<string> {
  const { client } = await getSharePointClient(connection);

  const item = await client
    .api(`/drives/${driveId}/items/${itemId}`)
    .select('@microsoft.graph.downloadUrl')
    .get();

  return item['@microsoft.graph.downloadUrl'];
}

/**
 * Create a sharing link for a file
 */
export async function createShareLink(
  connection: MicrosoftConnection,
  driveId: string,
  itemId: string,
  options: CreateShareLinkRequest
): Promise<ShareLinkResult> {
  const { client } = await getSharePointClient(connection);

  const result = await client
    .api(`/drives/${driveId}/items/${itemId}/createLink`)
    .post(options);

  return result;
}

/**
 * Search for files in a drive
 */
export async function searchFiles(
  connection: MicrosoftConnection,
  driveId: string,
  query: string
): Promise<SharePointDriveItem[]> {
  const { client } = await getSharePointClient(connection);

  const response: SharePointListResponse<SharePointDriveItem> = await client
    .api(`/drives/${driveId}/root/search(q='${encodeURIComponent(query)}')`)
    .top(50)
    .get();

  return response.value;
}

/**
 * Move an item to a different folder
 */
export async function moveItem(
  connection: MicrosoftConnection,
  driveId: string,
  itemId: string,
  newParentFolderId: string,
  newName?: string
): Promise<SharePointDriveItem> {
  const { client } = await getSharePointClient(connection);

  const updateData: { parentReference: { id: string }; name?: string } = {
    parentReference: { id: newParentFolderId },
  };

  if (newName) {
    updateData.name = newName;
  }

  const item = await client
    .api(`/drives/${driveId}/items/${itemId}`)
    .patch(updateData);

  return item;
}

/**
 * Copy an item to a different folder
 */
export async function copyItem(
  connection: MicrosoftConnection,
  driveId: string,
  itemId: string,
  newParentFolderId: string,
  newName?: string
): Promise<void> {
  const { client } = await getSharePointClient(connection);

  const copyData: { parentReference: { driveId: string; id: string }; name?: string } = {
    parentReference: {
      driveId,
      id: newParentFolderId,
    },
  };

  if (newName) {
    copyData.name = newName;
  }

  // Copy is async, returns a monitor URL
  await client
    .api(`/drives/${driveId}/items/${itemId}/copy`)
    .post(copyData);
}

/**
 * Get thumbnail URLs for an image/video item
 */
export async function getThumbnails(
  connection: MicrosoftConnection,
  driveId: string,
  itemId: string
): Promise<SharePointDriveItem['thumbnails']> {
  const { client } = await getSharePointClient(connection);

  const response = await client
    .api(`/drives/${driveId}/items/${itemId}/thumbnails`)
    .get();

  return response.value;
}

// Helper function to map category to folder name
function getCategoryFolderName(category: FileCategory): string {
  const names: Record<FileCategory, string> = {
    schematics: 'Schematics',
    sow: 'SOW',
    photos: 'Photos',
    videos: 'Videos',
    other: 'Other',
  };
  return names[category];
}

// Export folder name helper for use elsewhere
export { getCategoryFolderName };
