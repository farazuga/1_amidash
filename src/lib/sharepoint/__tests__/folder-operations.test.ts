import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sanitizeFolderName,
  generateProjectFolderName,
  createProjectSharePointFolder,
  CreateProjectFolderParams,
} from '../folder-operations';
import type { SharePointGlobalConfig } from '@/types';

// Mock the SharePoint client module
vi.mock('../client', () => ({
  createFolder: vi.fn(),
  getCategoryFolderName: vi.fn((category: string) => {
    const names: Record<string, string> = {
      schematics: 'Schematics',
      sow: 'SOW',
      media: 'Photos & Videos',
      other: 'Other',
    };
    return names[category];
  }),
}));

import * as sharepoint from '../client';

const mockCreateFolder = vi.mocked(sharepoint.createFolder);

// ============================================================================
// sanitizeFolderName
// ============================================================================

describe('sanitizeFolderName', () => {
  it('preserves normal characters and spaces', () => {
    expect(sanitizeFolderName('Hello World')).toBe('Hello World');
  });

  it('preserves letters, numbers, hyphens, and underscores', () => {
    expect(sanitizeFolderName('Project-123_v2')).toBe('Project-123_v2');
  });

  it('replaces < > : " / \\ | ? * with hyphens', () => {
    expect(sanitizeFolderName('a<b>c:d"e/f\\g|h?i*j')).toBe('a-b-c-d-e-f-g-h-i-j');
  });

  it('handles empty string', () => {
    expect(sanitizeFolderName('')).toBe('');
  });

  it('handles string with only invalid characters', () => {
    expect(sanitizeFolderName(':<>"|?*')).toBe('-------');
  });

  it('handles multiple consecutive invalid characters', () => {
    expect(sanitizeFolderName('test<>:name')).toBe('test---name');
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeFolderName('  hello  ')).toBe('hello');
  });
});

// ============================================================================
// generateProjectFolderName
// ============================================================================

describe('generateProjectFolderName', () => {
  it('generates folder name in format "S12345 ClientName"', () => {
    expect(generateProjectFolderName('S12345', 'Acme Corp')).toBe('S12345 Acme Corp');
  });

  it('sanitizes client name with special characters', () => {
    expect(generateProjectFolderName('S10001', 'Client <Test>')).toBe('S10001 Client -Test-');
  });

  it('preserves sales order number as-is', () => {
    expect(generateProjectFolderName('S99999', 'Normal')).toBe('S99999 Normal');
  });

  it('handles client name with multiple invalid chars', () => {
    expect(generateProjectFolderName('S10000', 'A/B "Test" Co.')).toBe('S10000 A-B -Test- Co.');
  });
});

// ============================================================================
// createProjectSharePointFolder
// ============================================================================

describe('createProjectSharePointFolder', () => {
  const globalConfig: SharePointGlobalConfig = {
    id: 'config-1',
    site_id: 'site-1',
    drive_id: 'drive-1',
    base_folder_id: 'base-folder-1',
    base_folder_path: '/Projects',
    site_url: 'https://example.sharepoint.com/sites/test',
    drive_name: 'Documents',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const baseParams: CreateProjectFolderParams = {
    projectId: 'proj-1',
    salesOrderNumber: 'S12345',
    clientName: 'Acme Corp',
    userId: 'user-1',
    globalConfig,
  };

  const mockProjectFolder = {
    id: 'folder-id-1',
    name: 'S12345 Acme Corp',
    webUrl: 'https://example.sharepoint.com/sites/test/Shared%20Documents/Projects/S12345%20Acme%20Corp',
    size: 0,
    folder: { childCount: 0 },
  };

  const mockConnection = {
    id: 'conn-1',
    project_id: 'proj-1',
    site_id: 'site-1',
    drive_id: 'drive-1',
    folder_id: 'folder-id-1',
    folder_path: '/Projects/S12345 Acme Corp',
    folder_url: mockProjectFolder.webUrl,
    connected_by: 'user-1',
    auto_created: true,
  };

  function createMockDb(overrides?: { insertError?: unknown; data?: unknown }) {
    const single = vi.fn().mockResolvedValue({
      data: overrides?.data ?? mockConnection,
      error: overrides?.insertError ?? null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    return { from, insert, select, single };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateFolder.mockResolvedValue(mockProjectFolder as never);
  });

  it('creates main folder and 4 category subfolders', async () => {
    const db = createMockDb();
    await createProjectSharePointFolder(baseParams, db);

    // Main folder creation
    expect(mockCreateFolder).toHaveBeenCalledWith('drive-1', 'base-folder-1', 'S12345 Acme Corp');

    // 4 subfolder creations
    expect(mockCreateFolder).toHaveBeenCalledWith('drive-1', 'folder-id-1', 'Schematics');
    expect(mockCreateFolder).toHaveBeenCalledWith('drive-1', 'folder-id-1', 'SOW');
    expect(mockCreateFolder).toHaveBeenCalledWith('drive-1', 'folder-id-1', 'Photos & Videos');
    expect(mockCreateFolder).toHaveBeenCalledWith('drive-1', 'folder-id-1', 'Other');

    expect(mockCreateFolder).toHaveBeenCalledTimes(5);
  });

  it('saves connection to database with correct fields', async () => {
    const db = createMockDb();
    await createProjectSharePointFolder(baseParams, db);

    expect(db.from).toHaveBeenCalledWith('project_sharepoint_connections');
    expect(db.insert).toHaveBeenCalledWith({
      project_id: 'proj-1',
      site_id: 'site-1',
      drive_id: 'drive-1',
      folder_id: 'folder-id-1',
      folder_path: '/Projects/S12345 Acme Corp',
      folder_url: mockProjectFolder.webUrl,
      connected_by: 'user-1',
      auto_created: true,
    });
  });

  it('returns success with connection details', async () => {
    const db = createMockDb();
    const result = await createProjectSharePointFolder(baseParams, db);

    expect(result).toEqual({
      success: true,
      connection: mockConnection,
    });
  });

  it('handles root base_folder_path ("/")', async () => {
    const db = createMockDb();
    const params = {
      ...baseParams,
      globalConfig: { ...globalConfig, base_folder_path: '/' },
    };
    await createProjectSharePointFolder(params, db);

    expect(db.insert).toHaveBeenCalledWith(
      expect.objectContaining({ folder_path: '/S12345 Acme Corp' })
    );
  });

  it('handles "Root" base_folder_path', async () => {
    const db = createMockDb();
    const params = {
      ...baseParams,
      globalConfig: { ...globalConfig, base_folder_path: 'Root' },
    };
    await createProjectSharePointFolder(params, db);

    expect(db.insert).toHaveBeenCalledWith(
      expect.objectContaining({ folder_path: '/S12345 Acme Corp' })
    );
  });

  it('returns error when SharePoint API fails on main folder creation', async () => {
    mockCreateFolder.mockRejectedValueOnce(new Error('SharePoint API error'));
    const db = createMockDb();
    const result = await createProjectSharePointFolder(baseParams, db);

    expect(result).toEqual({
      success: false,
      error: 'SharePoint API error',
    });
    // Should not attempt to save to DB
    expect(db.from).not.toHaveBeenCalled();
  });

  it('continues when subfolder creation fails', async () => {
    // Main folder succeeds, first subfolder fails, rest succeed
    mockCreateFolder
      .mockResolvedValueOnce(mockProjectFolder as never) // main
      .mockRejectedValueOnce(new Error('Subfolder exists')) // schematics
      .mockResolvedValueOnce({} as never) // sow
      .mockResolvedValueOnce({} as never) // media
      .mockResolvedValueOnce({} as never); // other

    const db = createMockDb();
    const result = await createProjectSharePointFolder(baseParams, db);

    expect(result.success).toBe(true);
    expect(mockCreateFolder).toHaveBeenCalledTimes(5);
  });

  it('returns error when DB save fails', async () => {
    const db = createMockDb({ insertError: { message: 'DB error' } });
    const result = await createProjectSharePointFolder(baseParams, db);

    expect(result).toEqual({
      success: false,
      error: 'Failed to save connection',
    });
  });

  it('handles non-Error thrown objects in catch', async () => {
    mockCreateFolder.mockRejectedValueOnce('string error');
    const db = createMockDb();
    const result = await createProjectSharePointFolder(baseParams, db);

    expect(result).toEqual({
      success: false,
      error: 'Failed to create project folder',
    });
  });
});
