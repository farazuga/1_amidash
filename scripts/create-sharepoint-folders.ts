#!/usr/bin/env npx tsx
/**
 * CLI Script: Create SharePoint folders for existing projects
 *
 * Usage:
 *   npm run sharepoint:create-folders [options]
 *
 * Options:
 *   --dry-run         Show what would be created without making changes
 *   --limit N         Process only N projects (default: all)
 *   --user-id UUID    Use specific user's Microsoft connection
 *   --verbose         Show detailed output
 *
 * Requirements:
 *   - Global SharePoint config must be set up in admin settings
 *   - A user with Microsoft connection must exist (use --user-id to specify)
 *   - Environment variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import 'dotenv/config';
import { createAdminClient } from './lib/supabase-admin';
import { generateProjectFolderName } from '../src/lib/sharepoint/folder-operations';
import * as sharepoint from '../src/lib/sharepoint/client';
import { decryptToken, isEncryptionConfigured } from '../src/lib/crypto';
import type { FileCategory, SharePointGlobalConfig } from '../src/types';

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : null;
const userIdIndex = args.indexOf('--user-id');
const specificUserId = userIdIndex !== -1 ? args[userIdIndex + 1] : null;

interface ProjectWithoutFolder {
  id: string;
  client_name: string;
  sales_order_number: string;
}

interface MicrosoftConnection {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

async function main() {
  console.log('='.repeat(60));
  console.log('SharePoint Folder Creation Script');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  if (limit) console.log(`Limit: ${limit} projects`);
  console.log('');

  // Initialize Supabase client
  const supabase = createAdminClient();

  // Step 1: Get global SharePoint configuration
  console.log('Step 1: Checking SharePoint configuration...');
  const { data: configData } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'sharepoint_config')
    .maybeSingle();

  if (!configData?.value) {
    console.error('ERROR: Global SharePoint configuration not found.');
    console.error('Please configure SharePoint in Admin > Settings first.');
    process.exit(1);
  }

  const globalConfig = configData.value as SharePointGlobalConfig;
  console.log(`  ✓ SharePoint configured: ${globalConfig.site_name}`);
  console.log(`  ✓ Base folder: ${globalConfig.base_folder_path}`);
  console.log('');

  // Step 2: Get Microsoft connection
  console.log('Step 2: Getting Microsoft connection...');

  let msConnectionQuery = supabase
    .from('calendar_connections')
    .select('*')
    .eq('provider', 'microsoft');

  if (specificUserId) {
    msConnectionQuery = msConnectionQuery.eq('user_id', specificUserId);
  }

  const { data: connections, error: connError } = await msConnectionQuery.limit(1);

  if (connError || !connections || connections.length === 0) {
    console.error('ERROR: No Microsoft connection found.');
    if (specificUserId) {
      console.error(`User ${specificUserId} does not have a Microsoft connection.`);
    } else {
      console.error('No users have connected their Microsoft account.');
      console.error('Use --user-id to specify a user with a Microsoft connection.');
    }
    process.exit(1);
  }

  const rawConnection = connections[0] as MicrosoftConnection;
  console.log(`  ✓ Using Microsoft connection from user: ${rawConnection.user_id}`);

  // Decrypt tokens if encryption is configured
  let msConnection = {
    ...rawConnection,
    access_token: rawConnection.access_token,
    refresh_token: rawConnection.refresh_token,
  };

  if (isEncryptionConfigured()) {
    try {
      msConnection.access_token = decryptToken(rawConnection.access_token);
      msConnection.refresh_token = decryptToken(rawConnection.refresh_token);
      console.log('  ✓ Tokens decrypted');
    } catch {
      console.log('  ⚠ Token decryption failed, using raw tokens');
    }
  }
  console.log('');

  // Step 3: Get projects without SharePoint connections
  console.log('Step 3: Finding projects without SharePoint folders...');

  // Get all projects with sales_order_number
  let projectsQuery = supabase
    .from('projects')
    .select('id, client_name, sales_order_number')
    .not('sales_order_number', 'is', null);

  const { data: allProjects, error: projectsError } = await projectsQuery;

  if (projectsError) {
    console.error('ERROR: Failed to fetch projects:', projectsError.message);
    process.exit(1);
  }

  // Get projects that already have SharePoint connections
  const { data: existingConnections } = await supabase
    .from('project_sharepoint_connections')
    .select('project_id');

  const connectedProjectIds = new Set(
    existingConnections?.map((c: { project_id: string }) => c.project_id) || []
  );

  // Filter to projects without connections
  let projectsWithoutFolders = (allProjects || [])
    .filter((p): p is ProjectWithoutFolder =>
      p.sales_order_number !== null && !connectedProjectIds.has(p.id)
    );

  console.log(`  Total projects: ${allProjects?.length || 0}`);
  console.log(`  Projects with SharePoint: ${connectedProjectIds.size}`);
  console.log(`  Projects without SharePoint: ${projectsWithoutFolders.length}`);

  if (limit && projectsWithoutFolders.length > limit) {
    projectsWithoutFolders = projectsWithoutFolders.slice(0, limit);
    console.log(`  Processing (limited): ${projectsWithoutFolders.length}`);
  }
  console.log('');

  if (projectsWithoutFolders.length === 0) {
    console.log('✓ All projects already have SharePoint folders!');
    process.exit(0);
  }

  // Step 4: Create folders
  console.log('Step 4: Creating SharePoint folders...');
  console.log('');

  let successCount = 0;
  let errorCount = 0;
  const errors: { project: string; error: string }[] = [];

  for (const project of projectsWithoutFolders) {
    const folderName = generateProjectFolderName(project.sales_order_number, project.client_name);

    if (verbose || dryRun) {
      console.log(`  Processing: ${folderName}`);
    }

    if (dryRun) {
      console.log(`    [DRY RUN] Would create folder: ${folderName}`);
      successCount++;
      continue;
    }

    try {
      // Create project folder
      const projectFolder = await sharepoint.createFolder(
        msConnection as any,
        globalConfig.drive_id,
        globalConfig.base_folder_id,
        folderName
      );

      // Create category subfolders
      const categories: FileCategory[] = ['schematics', 'sow', 'media', 'other'];
      for (const category of categories) {
        const categoryFolderName = sharepoint.getCategoryFolderName(category);
        try {
          await sharepoint.createFolder(
            msConnection as any,
            globalConfig.drive_id,
            projectFolder.id,
            categoryFolderName
          );
        } catch {
          // Folder may already exist
        }
      }

      // Save connection to database
      const folderPath = globalConfig.base_folder_path === '/' || globalConfig.base_folder_path === 'Root'
        ? `/${folderName}`
        : `${globalConfig.base_folder_path}/${folderName}`;

      const { error: insertError } = await supabase
        .from('project_sharepoint_connections')
        .insert({
          project_id: project.id,
          site_id: globalConfig.site_id,
          drive_id: globalConfig.drive_id,
          folder_id: projectFolder.id,
          folder_path: folderPath,
          folder_url: projectFolder.webUrl,
          connected_by: rawConnection.user_id,
          auto_created: true,
        });

      if (insertError) {
        throw new Error(`Database insert failed: ${insertError.message}`);
      }

      successCount++;
      if (verbose) {
        console.log(`    ✓ Created: ${folderPath}`);
      } else {
        process.stdout.write('.');
      }

      // Rate limiting: small delay between API calls
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      errorCount++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push({ project: folderName, error: errorMessage });

      if (verbose) {
        console.log(`    ✗ Error: ${errorMessage}`);
      } else {
        process.stdout.write('x');
      }
    }
  }

  console.log('');
  console.log('');

  // Summary
  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`  Processed: ${projectsWithoutFolders.length}`);
  console.log(`  Successful: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);

  if (errors.length > 0) {
    console.log('');
    console.log('Errors:');
    for (const err of errors) {
      console.log(`  - ${err.project}: ${err.error}`);
    }
  }

  if (dryRun) {
    console.log('');
    console.log('This was a DRY RUN. No changes were made.');
    console.log('Run without --dry-run to create folders.');
  }

  process.exit(errorCount > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
