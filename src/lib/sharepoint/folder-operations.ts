import * as sharepoint from './client';
import type { CalendarConnection } from '@/lib/microsoft-graph/types';
import type { FileCategory, ProjectSharePointConnection, SharePointGlobalConfig } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface CreateProjectFolderParams {
  projectId: string;
  salesOrderNumber: string;
  clientName: string;
  userId: string;
  msConnection: CalendarConnection;
  globalConfig: SharePointGlobalConfig;
}

export interface CreateProjectFolderResult {
  success: boolean;
  connection?: ProjectSharePointConnection;
  error?: string;
}

// ============================================================================
// Folder Name Utilities
// ============================================================================

/**
 * Sanitize a string for use as a SharePoint folder name
 * Removes invalid characters: < > : " / \ | ? *
 */
export function sanitizeFolderName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '-').trim();
}

/**
 * Generate a project folder name in the format: "S12345 ClientName"
 * @param salesOrderNumber - Sales order number (e.g., "S12345")
 * @param clientName - Client name
 * @returns Sanitized folder name
 */
export function generateProjectFolderName(salesOrderNumber: string, clientName: string): string {
  const sanitizedClientName = sanitizeFolderName(clientName);
  return `${salesOrderNumber} ${sanitizedClientName}`;
}

// ============================================================================
// Folder Creation
// ============================================================================

/**
 * Create a SharePoint folder structure for a project
 * Creates main folder + category subfolders (Schematics, SOW, Photos & Videos, Other)
 *
 * @param params - Creation parameters
 * @param db - Supabase client (passed in to avoid importing server-only code)
 * @returns Result with connection details or error
 */
export async function createProjectSharePointFolder(
  params: CreateProjectFolderParams,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any
): Promise<CreateProjectFolderResult> {
  const { projectId, salesOrderNumber, clientName, userId, msConnection, globalConfig } = params;

  try {
    // Generate folder name: "S12345 ClientName"
    const folderName = generateProjectFolderName(salesOrderNumber, clientName);

    // Create project folder under the base folder
    const projectFolder = await sharepoint.createFolder(
      msConnection,
      globalConfig.drive_id,
      globalConfig.base_folder_id,
      folderName
    );

    // Create category subfolders
    const categories: FileCategory[] = ['schematics', 'sow', 'media', 'other'];
    for (const category of categories) {
      const categoryFolderName = sharepoint.getCategoryFolderName(category);
      try {
        await sharepoint.createFolder(msConnection, globalConfig.drive_id, projectFolder.id, categoryFolderName);
      } catch {
        // Folder may already exist - this is fine
        console.log(`Category folder ${categoryFolderName} may already exist`);
      }
    }

    // Build the folder path
    const folderPath = globalConfig.base_folder_path === '/' || globalConfig.base_folder_path === 'Root'
      ? `/${folderName}`
      : `${globalConfig.base_folder_path}/${folderName}`;

    // Save connection to database
    const { data: connection, error: insertError } = await db
      .from('project_sharepoint_connections')
      .insert({
        project_id: projectId,
        site_id: globalConfig.site_id,
        drive_id: globalConfig.drive_id,
        folder_id: projectFolder.id,
        folder_path: folderPath,
        folder_url: projectFolder.webUrl,
        connected_by: userId,
        auto_created: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to save SharePoint connection:', insertError);
      return { success: false, error: 'Failed to save connection' };
    }

    return { success: true, connection: connection as ProjectSharePointConnection };
  } catch (error) {
    console.error('Create project folder error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create project folder',
    };
  }
}
