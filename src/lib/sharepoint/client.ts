/**
 * SharePoint client using Microsoft Graph API
 * Handles file operations: upload, download, list, create folders
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { getAppAccessToken } from '../microsoft-graph/auth';
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
import type { FileCategory, FileCategoryWithLegacy } from '@/types';

/**
 * Get a Microsoft Graph client using app-level credentials
 */
export async function getSharePointClient(): Promise<Client> {
  const token = await getAppAccessToken();

  return Client.init({
    authProvider: (done) => {
      done(null, token);
    },
  });
}

/**
 * Get the user's default SharePoint site
 */
export async function getDefaultSite(): Promise<SharePointSite> {
  const client = await getSharePointClient();

  // Get the root SharePoint site for the organization
  const site = await client.api('/sites/root').get();

  return site;
}

/**
 * Get a specific SharePoint site by URL
 */
export async function getSiteByUrl(
  hostname: string,
  sitePath: string
): Promise<SharePointSite> {
  const client = await getSharePointClient();

  // Format: /sites/{hostname}:/{site-path}
  const site = await client.api(`/sites/${hostname}:${sitePath}`).get();

  return site;
}

/**
 * List available SharePoint sites the user has access to
 */
export async function listSites(): Promise<SharePointSite[]> {
  const client = await getSharePointClient();

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
  siteId: string
): Promise<SharePointDrive> {
  const client = await getSharePointClient();

  const drive = await client.api(`/sites/${siteId}/drive`).get();

  return drive;
}

/**
 * List all drives (document libraries) in a site
 */
export async function listDrives(
  siteId: string
): Promise<SharePointDrive[]> {
  const client = await getSharePointClient();

  const response: SharePointListResponse<SharePointDrive> = await client
    .api(`/sites/${siteId}/drives`)
    .get();

  return response.value;
}

/**
 * List items (files and folders) in a drive folder
 */
export async function listFolderContents(
  driveId: string,
  folderId: string = 'root'
): Promise<SharePointDriveItem[]> {
  const client = await getSharePointClient();

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
  driveId: string,
  folderPath: string
): Promise<SharePointDriveItem[]> {
  const client = await getSharePointClient();

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
  driveId: string,
  itemId: string
): Promise<SharePointDriveItem> {
  const client = await getSharePointClient();

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
  driveId: string,
  itemPath: string
): Promise<SharePointDriveItem | null> {
  const client = await getSharePointClient();

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
  driveId: string,
  parentFolderId: string,
  folderName: string
): Promise<SharePointDriveItem> {
  const client = await getSharePointClient();

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
  driveId: string,
  folderPath: string
): Promise<SharePointDriveItem> {
  const client = await getSharePointClient();

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
  driveId: string,
  baseFolderId: string,
  projectName: string,
  categories: FileCategory[] = ['schematics', 'sow', 'media', 'other']
): Promise<Record<FileCategory, SharePointDriveItem>> {
  // Create main project folder
  const projectFolder = await createFolder(driveId, baseFolderId, projectName);

  // Create category subfolders
  const categoryFolders: Partial<Record<FileCategory, SharePointDriveItem>> = {};

  for (const category of categories) {
    const categoryName = getCategoryFolderName(category);
    const folder = await createFolder(driveId, projectFolder.id, categoryName);
    categoryFolders[category] = folder;
  }

  return categoryFolders as Record<FileCategory, SharePointDriveItem>;
}

/**
 * Upload a small file (< 4MB) directly
 */
export async function uploadSmallFile(
  driveId: string,
  folderId: string,
  fileName: string,
  fileContent: ArrayBuffer | Blob,
  contentType: string
): Promise<FileUploadResult> {
  const client = await getSharePointClient();

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
  driveId: string,
  folderId: string,
  fileName: string
): Promise<SharePointUploadSession> {
  const client = await getSharePointClient();

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
  driveId: string,
  folderId: string,
  fileName: string,
  fileContent: Blob,
  onProgress?: (progress: number) => void
): Promise<FileUploadResult> {
  try {
    const session = await createUploadSession(driveId, folderId, fileName);

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
  driveId: string,
  folderId: string,
  fileName: string,
  fileContent: Blob,
  contentType: string,
  onProgress?: (progress: number) => void
): Promise<FileUploadResult> {
  const SMALL_FILE_THRESHOLD = 4 * 1024 * 1024; // 4MB

  if (fileContent.size < SMALL_FILE_THRESHOLD) {
    return uploadSmallFile(driveId, folderId, fileName, fileContent, contentType);
  } else {
    return uploadLargeFile(driveId, folderId, fileName, fileContent, onProgress);
  }
}

/**
 * Delete an item (file or folder)
 */
export async function deleteItem(
  driveId: string,
  itemId: string
): Promise<void> {
  const client = await getSharePointClient();

  await client.api(`/drives/${driveId}/items/${itemId}`).delete();
}

/**
 * Get a download URL for a file
 */
export async function getDownloadUrl(
  driveId: string,
  itemId: string
): Promise<string> {
  const client = await getSharePointClient();

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
  driveId: string,
  itemId: string,
  options: CreateShareLinkRequest
): Promise<ShareLinkResult> {
  const client = await getSharePointClient();

  const result = await client
    .api(`/drives/${driveId}/items/${itemId}/createLink`)
    .post(options);

  return result;
}

/**
 * Search for files in a drive
 */
export async function searchFiles(
  driveId: string,
  query: string
): Promise<SharePointDriveItem[]> {
  const client = await getSharePointClient();

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
  driveId: string,
  itemId: string,
  newParentFolderId: string,
  newName?: string
): Promise<SharePointDriveItem> {
  const client = await getSharePointClient();

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
  driveId: string,
  itemId: string,
  newParentFolderId: string,
  newName?: string
): Promise<void> {
  const client = await getSharePointClient();

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
  driveId: string,
  itemId: string
): Promise<SharePointDriveItem['thumbnails']> {
  const client = await getSharePointClient();

  const response = await client
    .api(`/drives/${driveId}/items/${itemId}/thumbnails`)
    .get();

  return response.value;
}

// Helper function to map category to folder name
// Supports legacy photos/videos categories for existing files
function getCategoryFolderName(category: FileCategoryWithLegacy): string {
  const names: Record<FileCategoryWithLegacy, string> = {
    schematics: 'Schematics',
    sow: 'SOW',
    media: 'Photos & Videos',
    // Legacy categories map to Photos & Videos folder
    photos: 'Photos & Videos',
    videos: 'Photos & Videos',
    other: 'Other',
  };
  return names[category];
}

/**
 * Get or create the archive folder structure: _archive/{year}
 * Returns the year folder ID for moving project folders into
 */
export async function getOrCreateArchiveFolder(
  driveId: string,
  baseFolderId: string,
  baseFolderPath: string,
  year: number
): Promise<{ archiveFolderId: string; yearFolderId: string; yearFolderPath: string }> {
  const archiveFolderName = '_archive';
  const yearFolderName = String(year);

  // Try to get _archive folder
  let archiveFolder: SharePointDriveItem | null = null;
  const archivePath = baseFolderPath === '/' || baseFolderPath === 'Root'
    ? `/${archiveFolderName}`
    : `${baseFolderPath}/${archiveFolderName}`;

  try {
    archiveFolder = await getItemByPath(driveId, archivePath);
  } catch {
    // Folder doesn't exist
  }

  // Create _archive folder if it doesn't exist
  if (!archiveFolder) {
    archiveFolder = await createFolder(driveId, baseFolderId, archiveFolderName);
  }

  // Try to get year folder
  let yearFolder: SharePointDriveItem | null = null;
  const yearPath = `${archivePath}/${yearFolderName}`;

  try {
    yearFolder = await getItemByPath(driveId, yearPath);
  } catch {
    // Folder doesn't exist
  }

  // Create year folder if it doesn't exist
  if (!yearFolder) {
    yearFolder = await createFolder(driveId, archiveFolder.id, yearFolderName);
  }

  return {
    archiveFolderId: archiveFolder.id,
    yearFolderId: yearFolder.id,
    yearFolderPath: yearPath,
  };
}

// Export folder name helper for use elsewhere
export { getCategoryFolderName };
