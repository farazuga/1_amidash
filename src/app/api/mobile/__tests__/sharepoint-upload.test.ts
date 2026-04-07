/**
 * Mobile SharePoint Upload API Contract Tests
 *
 * Ensures POST /api/mobile/sharepoint/upload validates input correctly
 * and returns the shapes the iOS app depends on.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @supabase/supabase-js (still needed since route imports it transitively)
const mockGetUser = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

// Mock mobile auth
const mockAuthenticateMobileRequest = vi.fn();
vi.mock('@/lib/mobile/auth', () => ({
  authenticateMobileRequest: (...args: unknown[]) => mockAuthenticateMobileRequest(...args),
}));

// Mock service client
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(),
  })),
}));

// Mock sharepoint client (not needed for validation tests, but required for import)
vi.mock('@/lib/sharepoint/client', () => ({
  createFolder: vi.fn(),
  getCategoryFolderName: vi.fn(),
  getItemByPath: vi.fn(),
  getItem: vi.fn(),
  uploadFile: vi.fn(),
  getThumbnails: vi.fn(),
}));

// Mock file-security module
vi.mock('@/lib/mobile/file-security', () => ({
  validateMobileFileSize: vi.fn().mockReturnValue(true),
  validateMobileFileType: vi.fn().mockResolvedValue({ valid: true }),
  sanitizeFilename: vi.fn((name: string) => name),
  stripExifData: vi.fn((buf: Buffer) => buf),
}));

// Import the handler after mocks are set up
import { POST } from '../sharepoint/upload/route';

/**
 * Helper to build a Request whose formData() returns a mock FormData.
 * Node's Request + FormData with Blobs causes formData() to hang in
 * test environments, so we override it directly.
 */
function buildMockFormDataRequest(
  fields: Record<string, string | File>,
  headers?: Record<string, string>
): Request {
  // Build a map for formData.get() that returns File objects with working arrayBuffer()
  const fieldMap = new Map<string, string | File>();
  for (const [k, v] of Object.entries(fields)) {
    if (v instanceof File) {
      // Create a File-like object with working arrayBuffer() for Node test environments
      const mockFile = {
        name: v.name,
        type: v.type,
        size: v.size,
        arrayBuffer: async () => new ArrayBuffer(v.size),
        stream: () => new ReadableStream(),
        text: async () => '',
        slice: () => new Blob(),
        lastModified: Date.now(),
        [Symbol.toStringTag]: 'File',
      } as unknown as File;
      fieldMap.set(k, mockFile);
    } else {
      fieldMap.set(k, v);
    }
  }

  const mockFormData = {
    get: (key: string) => fieldMap.get(key) ?? null,
    has: (key: string) => fieldMap.has(key),
    getAll: (key: string) => { const v = fieldMap.get(key); return v ? [v] : []; },
  } as unknown as FormData;

  const request = new Request('http://localhost/api/mobile/sharepoint/upload', {
    method: 'POST',
    headers: headers ?? {},
    body: '(mock body)',
  });

  // Override formData() to return our prepared FormData
  request.formData = async () => mockFormData;
  return request;
}

describe('POST /api/mobile/sharepoint/upload', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };
  const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without Authorization header', async () => {
    mockAuthenticateMobileRequest.mockResolvedValue(
      Response.json({ error: 'Authentication required' }, { status: 401 })
    );

    const request = buildMockFormDataRequest({});

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Authentication required' });
  });

  it('returns 401 with invalid/expired token', async () => {
    mockAuthenticateMobileRequest.mockResolvedValue(
      Response.json({ error: 'Authentication required' }, { status: 401 })
    );

    const request = buildMockFormDataRequest(
      {},
      { Authorization: 'Bearer expired-token' }
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Authentication required' });
  });

  it('returns 400 when file is missing', async () => {
    mockAuthenticateMobileRequest.mockResolvedValue({ user: mockUser, profile: { role: 'admin' } });

    const request = buildMockFormDataRequest(
      { projectId: 'project-123', category: 'schematics' },
      { Authorization: 'Bearer valid-token' }
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'File is required' });
  });

  it('returns 400 when projectId is missing', async () => {
    mockAuthenticateMobileRequest.mockResolvedValue({ user: mockUser, profile: { role: 'admin' } });

    const request = buildMockFormDataRequest(
      { file: testFile, category: 'schematics' },
      { Authorization: 'Bearer valid-token' }
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Project ID is required' });
  });

  it('returns 400 when category is missing', async () => {
    mockAuthenticateMobileRequest.mockResolvedValue({ user: mockUser, profile: { role: 'admin' } });

    const request = buildMockFormDataRequest(
      { file: testFile, projectId: 'project-123' },
      { Authorization: 'Bearer valid-token' }
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Category is required' });
  });

  it('returns 400 when category is invalid', async () => {
    mockAuthenticateMobileRequest.mockResolvedValue({ user: mockUser, profile: { role: 'admin' } });

    const request = buildMockFormDataRequest(
      { file: testFile, projectId: 'project-123', category: 'invalid_category' },
      { Authorization: 'Bearer valid-token' }
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Invalid category');
  });

  it('maps legacy category "photos" to "media" (does not return 400)', async () => {
    mockAuthenticateMobileRequest.mockResolvedValue({ user: mockUser, profile: { role: 'admin' } });

    const { createServiceClient } = await import('@/lib/supabase/server');
    vi.mocked(createServiceClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    } as never);

    const request = buildMockFormDataRequest(
      { file: testFile, projectId: 'project-123', category: 'photos' },
      { Authorization: 'Bearer valid-token' }
    );

    const response = await POST(request);

    // Should not be 400 (validation passed), will be 404 (project not found) or 500
    expect(response.status).not.toBe(400);
  });
});
