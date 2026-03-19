import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../upload/route';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/app/(dashboard)/projects/[salesOrder]/files/actions', () => ({
  uploadFile: vi.fn(),
}));

vi.mock('@/lib/api/csrf', () => ({
  validateOrigin: vi.fn().mockReturnValue(null),
}));

import { createClient } from '@/lib/supabase/server';
import { uploadFile } from '@/app/(dashboard)/projects/[salesOrder]/files/actions';

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockUploadFile = uploadFile as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockAuthenticated() {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
  });
}

function mockUnauthenticated() {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      }),
    },
  });
}

function mockAuthError() {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      }),
    },
  });
}

/**
 * Create a mock File-like object that works in the Node test environment.
 * The route calls `file.arrayBuffer()`, `file.name`, and `file.type`.
 */
function makeMockFile(
  name = 'test.pdf',
  type = 'application/pdf',
  sizeBytes = 1024
) {
  const buffer = new ArrayBuffer(sizeBytes);
  return {
    name,
    type,
    size: sizeBytes,
    arrayBuffer: () => Promise.resolve(buffer),
  };
}

/**
 * Build a mock Request whose formData() returns a Map-like with the given fields.
 * We mock formData() directly to avoid Node.js multipart parsing issues in tests.
 */
function makeUploadRequest(fields: Record<string, unknown>): Request {
  const store = new Map(Object.entries(fields));
  const mockFormData = {
    get: (key: string) => store.get(key) ?? null,
  };

  return {
    formData: () => Promise.resolve(mockFormData),
  } as unknown as Request;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/files/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Authentication ---

  it('returns 401 when user is not authenticated', async () => {
    mockUnauthenticated();

    const request = makeUploadRequest({
      file: makeMockFile(),
      projectId: 'proj-1',
      category: 'schematics',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Authentication required');
  });

  it('returns 401 when auth returns an error', async () => {
    mockAuthError();

    const request = makeUploadRequest({
      file: makeMockFile(),
      projectId: 'proj-1',
      category: 'schematics',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Authentication required');
  });

  // --- Missing required fields ---

  it('returns 400 when file is missing', async () => {
    mockAuthenticated();

    const request = makeUploadRequest({
      projectId: 'proj-1',
      category: 'schematics',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('File is required');
  });

  it('returns 400 when projectId is missing', async () => {
    mockAuthenticated();

    const request = makeUploadRequest({
      file: makeMockFile(),
      category: 'schematics',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Project ID is required');
  });

  it('returns 400 when category is missing', async () => {
    mockAuthenticated();

    const request = makeUploadRequest({
      file: makeMockFile(),
      projectId: 'proj-1',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Category is required');
  });

  // --- Successful upload ---

  it('returns success with file data on valid upload', async () => {
    mockAuthenticated();

    const mockFileRecord = {
      id: 'file-1',
      file_name: 'test.pdf',
      category: 'schematics',
      project_id: 'proj-1',
    };

    mockUploadFile.mockResolvedValue({
      success: true,
      file: mockFileRecord,
    });

    const request = makeUploadRequest({
      file: makeMockFile('test.pdf', 'application/pdf'),
      projectId: 'proj-1',
      category: 'schematics',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.file).toEqual(mockFileRecord);
  });

  it('passes optional fields to uploadFile', async () => {
    mockAuthenticated();

    mockUploadFile.mockResolvedValue({
      success: true,
      file: { id: 'file-2' },
    });

    const request = makeUploadRequest({
      file: makeMockFile('photo.jpg', 'image/jpeg'),
      projectId: 'proj-1',
      category: 'media',
      notes: 'Site photo from visit',
      capturedOffline: 'true',
      capturedOnDevice: 'iPhone 15',
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    expect(mockUploadFile).toHaveBeenCalledOnce();
    const callArgs = mockUploadFile.mock.calls[0][0];
    expect(callArgs.projectId).toBe('proj-1');
    expect(callArgs.fileName).toBe('photo.jpg');
    expect(callArgs.contentType).toBe('image/jpeg');
    expect(callArgs.category).toBe('media');
    expect(callArgs.notes).toBe('Site photo from visit');
    expect(callArgs.capturedOffline).toBe(true);
    expect(callArgs.capturedOnDevice).toBe('iPhone 15');
    expect(callArgs.fileContent).toBeInstanceOf(ArrayBuffer);
  });

  it('passes undefined for notes when not provided', async () => {
    mockAuthenticated();

    mockUploadFile.mockResolvedValue({
      success: true,
      file: { id: 'file-3' },
    });

    const request = makeUploadRequest({
      file: makeMockFile(),
      projectId: 'proj-1',
      category: 'sow',
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const callArgs = mockUploadFile.mock.calls[0][0];
    expect(callArgs.notes).toBeUndefined();
    expect(callArgs.capturedOffline).toBe(false);
    expect(callArgs.capturedOnDevice).toBeUndefined();
  });

  // --- Upload failure (SharePoint / server action error) ---

  it('returns 500 when uploadFile action returns failure', async () => {
    mockAuthenticated();

    mockUploadFile.mockResolvedValue({
      success: false,
      error: 'SharePoint upload failed: 403 Forbidden',
    });

    const request = makeUploadRequest({
      file: makeMockFile(),
      projectId: 'proj-1',
      category: 'schematics',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('SharePoint upload failed: 403 Forbidden');
  });

  it('returns generic error message when uploadFile fails without error string', async () => {
    mockAuthenticated();

    mockUploadFile.mockResolvedValue({
      success: false,
    });

    const request = makeUploadRequest({
      file: makeMockFile(),
      projectId: 'proj-1',
      category: 'other',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Upload failed');
  });

  // --- Exception handling ---

  it('returns 500 with error message when uploadFile throws', async () => {
    mockAuthenticated();

    mockUploadFile.mockRejectedValue(new Error('Network timeout'));

    const request = makeUploadRequest({
      file: makeMockFile(),
      projectId: 'proj-1',
      category: 'schematics',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('An internal error occurred. Please try again.');
  });

  it('returns 500 with generic message when non-Error is thrown', async () => {
    mockAuthenticated();

    mockUploadFile.mockRejectedValue('unexpected string error');

    const request = makeUploadRequest({
      file: makeMockFile(),
      projectId: 'proj-1',
      category: 'schematics',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('An internal error occurred. Please try again.');
  });
});
