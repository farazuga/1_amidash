/**
 * Confirmation Actions Tests
 *
 * Tests for public-facing confirmation workflow including:
 * - createConfirmationRequest
 * - handleConfirmationResponse
 * - getConfirmationRequestByToken
 * - getPendingConfirmations
 * - resendConfirmationEmail
 * - cancelConfirmationRequest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Supabase clients
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock next/headers
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue('127.0.0.1'),
  }),
}));

// Mock email
vi.mock('@/lib/email/send', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/email/settings', () => ({
  checkEmailEnabled: vi.fn().mockResolvedValue({
    canSendEmail: true,
    globalEnabled: true,
    projectEnabled: true,
    recipientEnabled: true,
  }),
}));

vi.mock('@/lib/email/templates', () => ({
  confirmationEmailTemplate: vi.fn().mockReturnValue('<html>confirm</html>'),
  pmConfirmationResponseEmailTemplate: vi.fn().mockReturnValue('<html>response</html>'),
}));

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/send';
import { checkEmailEnabled } from '@/lib/email/settings';
import {
  createConfirmationRequest,
  handleConfirmationResponse,
  getConfirmationRequestByToken,
  getPendingConfirmations,
  resendConfirmationEmail,
  cancelConfirmationRequest,
} from '../confirmation-actions';

// Helper to build chainable Supabase mock
function createChainMock(resolvedValue: unknown = { data: null, error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const terminalFn = vi.fn().mockResolvedValue(resolvedValue);

  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = terminalFn;

  // Make the chain itself thenable so `await chain` resolves
  (chain as any).then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    terminalFn().then(resolve, reject);

  return chain;
}

// Counter to generate unique tokens per test to avoid rate limiting
let tokenCounter = 0;
function uniqueToken() {
  return `token-${++tokenCounter}-${Date.now()}`;
}

const mockUser = { id: 'user-1', email: 'pm@example.com' };
const mockAdminProfile = { id: 'user-1', role: 'admin', full_name: 'Test Admin' };
const mockViewerProfile = { id: 'user-1', role: 'viewer', full_name: 'Test Viewer' };

const mockProject = {
  id: 'project-1',
  client_name: 'Acme Corp',
  poc_name: 'John Doe',
  poc_email: 'john@acme.com',
};

const mockAssignments = [
  {
    id: 'assign-1',
    booking_status: 'draft',
    user: { id: 'eng-1', full_name: 'Engineer One', email: 'eng1@test.com' },
    assignment_days: [{ work_date: '2026-04-01', start_time: '09:00', end_time: '17:00' }],
  },
  {
    id: 'assign-2',
    booking_status: 'draft',
    user: { id: 'eng-2', full_name: 'Engineer Two', email: 'eng2@test.com' },
    assignment_days: [{ work_date: '2026-04-02', start_time: '09:00', end_time: '17:00' }],
  },
];

const validCreateParams = {
  projectId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  assignmentIds: [
    'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    'c3d4e5f6-a7b8-4c9d-ae1f-2a3b4c5d6e7f',
  ],
  sendToEmail: 'customer@acme.com',
  sendToName: 'John Doe',
};

describe('Confirmation Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.test.com';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================
  // createConfirmationRequest
  // ==========================================
  describe('createConfirmationRequest', () => {
    it('happy path: creates request, links assignments, sends email, returns id and token', async () => {
      const mockRequest = { id: 'req-1', token: 'tok-123', expires_at: '2026-04-10T00:00:00Z' };

      const fromHandler = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null }),
              }),
            }),
          };
        }
        if (table === 'projects') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
              }),
            }),
          };
        }
        if (table === 'project_assignments') {
          const chain = createChainMock({ data: mockAssignments, error: null });
          // Also handle update().in() path
          chain.update = vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: null, error: null }),
          });
          return chain;
        }
        if (table === 'confirmation_requests') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockRequest, error: null }),
              }),
            }),
          };
        }
        if (table === 'confirmation_request_assignments') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === 'booking_status_history') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return createChainMock();
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: fromHandler,
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      const result = await createConfirmationRequest(validCreateParams);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 'req-1', token: 'tok-123', emailSent: true });
      expect(sendEmail).toHaveBeenCalled();
    });

    it('returns error for invalid input (bad email)', async () => {
      const result = await createConfirmationRequest({
        ...validCreateParams,
        sendToEmail: 'not-an-email',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns error when not authenticated', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      const result = await createConfirmationRequest(validCreateParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');
    });

    it('returns error when user is not admin/editor', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockViewerProfile, error: null }),
                }),
              }),
            };
          }
          return createChainMock();
        }),
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      const result = await createConfirmationRequest(validCreateParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient permissions');
    });

    it('updates assignments to pending status', async () => {
      const mockRequest = { id: 'req-1', token: 'tok-123', expires_at: '2026-04-10T00:00:00Z' };
      const updateInMock = vi.fn().mockResolvedValue({ data: null, error: null });
      const updateMock = vi.fn().mockReturnValue({ in: updateInMock });

      const fromHandler = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null }),
              }),
            }),
          };
        }
        if (table === 'projects') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
              }),
            }),
          };
        }
        if (table === 'project_assignments') {
          const chain = createChainMock({ data: mockAssignments, error: null });
          chain.update = updateMock;
          return chain;
        }
        if (table === 'confirmation_requests') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockRequest, error: null }),
              }),
            }),
          };
        }
        if (table === 'confirmation_request_assignments') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        if (table === 'booking_status_history') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return createChainMock();
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: fromHandler,
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      await createConfirmationRequest(validCreateParams);

      expect(updateMock).toHaveBeenCalledWith({ booking_status: 'pending' });
    });

    it('records status history for each assignment', async () => {
      const mockRequest = { id: 'req-1', token: 'tok-123', expires_at: '2026-04-10T00:00:00Z' };
      const historyInsertMock = vi.fn().mockResolvedValue({ error: null });

      const fromHandler = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null }),
              }),
            }),
          };
        }
        if (table === 'projects') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
              }),
            }),
          };
        }
        if (table === 'project_assignments') {
          const chain = createChainMock({ data: mockAssignments, error: null });
          chain.update = vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: null, error: null }),
          });
          return chain;
        }
        if (table === 'confirmation_requests') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockRequest, error: null }),
              }),
            }),
          };
        }
        if (table === 'confirmation_request_assignments') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        if (table === 'booking_status_history') {
          return { insert: historyInsertMock };
        }
        return createChainMock();
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: fromHandler,
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      await createConfirmationRequest(validCreateParams);

      // Should be called once per assignment
      expect(historyInsertMock).toHaveBeenCalledTimes(2);
      expect(historyInsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          old_status: 'draft',
          new_status: 'pending',
          changed_by: mockUser.id,
        })
      );
    });

    it('skips email when email is disabled', async () => {
      vi.mocked(checkEmailEnabled).mockResolvedValueOnce({
        canSendEmail: false,
        globalEnabled: false,
        projectEnabled: true,
        recipientEnabled: true,
      } as never);

      const mockRequest = { id: 'req-1', token: 'tok-123', expires_at: '2026-04-10T00:00:00Z' };

      const fromHandler = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null }),
              }),
            }),
          };
        }
        if (table === 'projects') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
              }),
            }),
          };
        }
        if (table === 'project_assignments') {
          const chain = createChainMock({ data: mockAssignments, error: null });
          chain.update = vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: null, error: null }),
          });
          return chain;
        }
        if (table === 'confirmation_requests') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockRequest, error: null }),
              }),
            }),
          };
        }
        if (table === 'confirmation_request_assignments') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        if (table === 'booking_status_history') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return createChainMock();
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: fromHandler,
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      const result = await createConfirmationRequest(validCreateParams);

      expect(result.success).toBe(true);
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('returns error on DB insert failure', async () => {
      const fromHandler = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null }),
              }),
            }),
          };
        }
        if (table === 'projects') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
              }),
            }),
          };
        }
        if (table === 'project_assignments') {
          return createChainMock({ data: mockAssignments, error: null });
        }
        if (table === 'confirmation_requests') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'DB insert error' },
                }),
              }),
            }),
          };
        }
        return createChainMock();
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: fromHandler,
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      const result = await createConfirmationRequest(validCreateParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB insert error');
    });

    it('returns error when assignments are not in draft/pending status', async () => {
      const confirmedAssignments = [
        { ...mockAssignments[0], booking_status: 'confirmed' },
      ];

      const fromHandler = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null }),
              }),
            }),
          };
        }
        if (table === 'projects') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
              }),
            }),
          };
        }
        if (table === 'project_assignments') {
          return createChainMock({ data: confirmedAssignments, error: null });
        }
        return createChainMock();
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: fromHandler,
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      const result = await createConfirmationRequest(validCreateParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain('draft or pending');
    });

    it('cleans up request if assignment linking fails', async () => {
      const mockRequest = { id: 'req-1', token: 'tok-123' };
      const deleteMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const fromHandler = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null }),
              }),
            }),
          };
        }
        if (table === 'projects') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
              }),
            }),
          };
        }
        if (table === 'project_assignments') {
          return createChainMock({ data: mockAssignments, error: null });
        }
        if (table === 'confirmation_requests') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockRequest, error: null }),
              }),
            }),
            delete: deleteMock,
          };
        }
        if (table === 'confirmation_request_assignments') {
          return {
            insert: vi.fn().mockResolvedValue({ error: { message: 'Link failed' } }),
          };
        }
        return createChainMock();
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: fromHandler,
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      const result = await createConfirmationRequest(validCreateParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Link failed');
    });
  });

  // ==========================================
  // handleConfirmationResponse
  // ==========================================
  describe('handleConfirmationResponse', () => {
    function makePendingRequest(token: string) {
      return {
        id: 'req-1',
        token,
        status: 'pending',
        expires_at: '2099-12-31T00:00:00Z',
        sent_to_name: 'John Doe',
        sent_to_email: 'john@acme.com',
        project: { id: 'proj-1', client_name: 'Acme Corp', poc_name: 'John' },
        created_by_profile: { email: 'pm@example.com', full_name: 'PM User' },
      };
    }

    function buildServiceMock(request: unknown, linkedAssignments: unknown[] = [{ assignment_id: 'a-1' }]) {
      const fromHandler = vi.fn().mockImplementation((table: string) => {
        if (table === 'confirmation_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: request, error: request ? null : { message: 'not found' } }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === 'confirmation_request_assignments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: linkedAssignments, error: null }),
            }),
          };
        }
        if (table === 'project_assignments') {
          return {
            update: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === 'booking_status_history') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return createChainMock();
      });

      return { from: fromHandler };
    }

    it('confirm: updates to confirmed, notifies PM', async () => {
      const token = uniqueToken();
      const req = makePendingRequest(token);
      const mock = buildServiceMock(req);
      vi.mocked(createServiceClient).mockResolvedValue(mock as never);

      const result = await handleConfirmationResponse({
        token,
        action: 'confirm',
      });

      expect(result.success).toBe(true);
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'pm@example.com',
          subject: expect.stringContaining('confirmed'),
        })
      );
    });

    it('decline: updates to declined, notifies PM', async () => {
      const token = uniqueToken();
      const req = makePendingRequest(token);
      const mock = buildServiceMock(req);
      vi.mocked(createServiceClient).mockResolvedValue(mock as never);

      const result = await handleConfirmationResponse({
        token,
        action: 'decline',
        declineReason: 'Dates do not work',
      });

      expect(result.success).toBe(true);
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'pm@example.com',
          subject: expect.stringContaining('declined'),
        })
      );
    });

    it('returns error for expired request', async () => {
      const token = uniqueToken();
      const expiredRequest = {
        ...makePendingRequest(token),
        expires_at: '2020-01-01T00:00:00Z',
      };
      const updateEqMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

      const fromHandler = vi.fn().mockImplementation((table: string) => {
        if (table === 'confirmation_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: expiredRequest, error: null }),
              }),
            }),
            update: updateMock,
          };
        }
        return createChainMock();
      });

      vi.mocked(createServiceClient).mockResolvedValue({ from: fromHandler } as never);

      const result = await handleConfirmationResponse({
        token,
        action: 'confirm',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('returns error for already responded request', async () => {
      const token = uniqueToken();
      const respondedRequest = { ...makePendingRequest(token), status: 'confirmed' };
      const mock = buildServiceMock(respondedRequest);
      vi.mocked(createServiceClient).mockResolvedValue(mock as never);

      const result = await handleConfirmationResponse({
        token,
        action: 'confirm',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already been responded');
    });

    it('returns error for invalid token', async () => {
      const token = uniqueToken();
      const mock = buildServiceMock(null);
      vi.mocked(createServiceClient).mockResolvedValue(mock as never);

      const result = await handleConfirmationResponse({
        token,
        action: 'confirm',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    it('returns error on validation failure', async () => {
      const result = await handleConfirmationResponse({
        token: '',
        action: 'confirm',
      });

      // Validation will fail (token min length 1)
      expect(result.success).toBe(false);
    });

    it('updates assignment statuses on confirm', async () => {
      const token = uniqueToken();
      const req = makePendingRequest(token);
      const updateInMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ in: updateInMock });

      const fromHandler = vi.fn().mockImplementation((table: string) => {
        if (table === 'confirmation_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: req, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === 'confirmation_request_assignments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ assignment_id: 'a-1' }, { assignment_id: 'a-2' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'project_assignments') {
          return { update: updateMock };
        }
        if (table === 'booking_status_history') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return createChainMock();
      });

      vi.mocked(createServiceClient).mockResolvedValue({ from: fromHandler } as never);

      await handleConfirmationResponse({
        token,
        action: 'confirm',
      });

      expect(updateMock).toHaveBeenCalledWith({ booking_status: 'confirmed' });
      expect(updateInMock).toHaveBeenCalledWith('id', ['a-1', 'a-2']);
    });

    it('handles DB error during request update', async () => {
      const token = uniqueToken();
      const req = makePendingRequest(token);

      const fromHandler = vi.fn().mockImplementation((table: string) => {
        if (table === 'confirmation_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: req, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: { message: 'Update failed' } }),
            }),
          };
        }
        return createChainMock();
      });

      vi.mocked(createServiceClient).mockResolvedValue({ from: fromHandler } as never);

      const result = await handleConfirmationResponse({
        token,
        action: 'confirm',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unable to process your response. Please try again.');
    });
  });

  // ==========================================
  // getConfirmationRequestByToken
  // ==========================================
  describe('getConfirmationRequestByToken', () => {
    it('returns grouped schedule data', async () => {
      const request = {
        id: 'req-1',
        token: 'tok-1',
        status: 'pending',
        expires_at: '2099-12-31T00:00:00Z',
        sent_to_name: 'John',
        project: { id: 'p-1', client_name: 'Acme Corp', poc_name: 'John' },
      };

      const linkedAssignments = [
        {
          assignment: {
            id: 'a-1',
            user: { full_name: 'Engineer A' },
            assignment_days: [
              { work_date: '2026-04-01', start_time: '09:00', end_time: '17:00' },
            ],
          },
        },
        {
          assignment: {
            id: 'a-2',
            user: { full_name: 'Engineer B' },
            assignment_days: [
              { work_date: '2026-04-01', start_time: '09:00', end_time: '17:00' },
            ],
          },
        },
      ];

      const fromHandler = vi.fn().mockImplementation((table: string) => {
        if (table === 'confirmation_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: request, error: null }),
              }),
            }),
          };
        }
        if (table === 'confirmation_request_assignments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: linkedAssignments, error: null }),
            }),
          };
        }
        return createChainMock();
      });

      vi.mocked(createServiceClient).mockReturnValue({ from: fromHandler } as never);

      const result = await getConfirmationRequestByToken('tok-1');

      expect(result.success).toBe(true);
      expect(result.data?.project_name).toBe('Acme Corp');
      expect(result.data?.customer_name).toBe('John');
      // Both engineers on same date/time should be grouped together
      expect(result.data?.dates).toHaveLength(1);
      expect(result.data?.dates[0].engineers).toContain('Engineer A');
      expect(result.data?.dates[0].engineers).toContain('Engineer B');
      expect(result.data?.is_expired).toBe(false);
      expect(result.data?.is_responded).toBe(false);
    });

    it('sets is_expired flag correctly for expired request', async () => {
      const request = {
        id: 'req-1',
        token: 'tok-1',
        status: 'pending',
        expires_at: '2020-01-01T00:00:00Z',
        sent_to_name: null,
        project: { id: 'p-1', client_name: 'Acme', poc_name: 'Jane' },
      };

      const fromHandler = vi.fn().mockImplementation((table: string) => {
        if (table === 'confirmation_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: request, error: null }),
              }),
            }),
          };
        }
        if (table === 'confirmation_request_assignments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return createChainMock();
      });

      vi.mocked(createServiceClient).mockReturnValue({ from: fromHandler } as never);

      const result = await getConfirmationRequestByToken('tok-1');

      expect(result.success).toBe(true);
      expect(result.data?.is_expired).toBe(true);
    });

    it('returns error when not found', async () => {
      const fromHandler = vi.fn().mockImplementation((table: string) => {
        if (table === 'confirmation_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
              }),
            }),
          };
        }
        return createChainMock();
      });

      vi.mocked(createServiceClient).mockReturnValue({ from: fromHandler } as never);

      const result = await getConfirmationRequestByToken('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    it('returns error when token is empty', async () => {
      const result = await getConfirmationRequestByToken('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token required');
    });

    it('marks responded requests correctly', async () => {
      const request = {
        id: 'req-1',
        token: 'tok-1',
        status: 'confirmed',
        expires_at: '2099-12-31T00:00:00Z',
        sent_to_name: 'John',
        project: { id: 'p-1', client_name: 'Acme', poc_name: 'John' },
      };

      const fromHandler = vi.fn().mockImplementation((table: string) => {
        if (table === 'confirmation_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: request, error: null }),
              }),
            }),
          };
        }
        if (table === 'confirmation_request_assignments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return createChainMock();
      });

      vi.mocked(createServiceClient).mockReturnValue({ from: fromHandler } as never);

      const result = await getConfirmationRequestByToken('tok-1');

      expect(result.success).toBe(true);
      expect(result.data?.is_responded).toBe(true);
      expect(result.data?.previous_response).toBe('confirmed');
    });
  });

  // ==========================================
  // getPendingConfirmations
  // ==========================================
  describe('getPendingConfirmations', () => {
    it('requires auth', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      const result = await getPendingConfirmations();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');
    });

    it('returns pending requests with counts', async () => {
      const pendingData = [
        {
          id: 'req-1',
          project_id: 'proj-1',
          project: { client_name: 'Acme' },
          sent_to_email: 'john@acme.com',
          sent_to_name: 'John',
          sent_at: '2026-04-01T00:00:00Z',
          expires_at: '2099-12-31T00:00:00Z',
        },
      ];

      const fromHandler = vi.fn().mockImplementation((table: string) => {
        if (table === 'confirmation_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: pendingData, error: null }),
              }),
            }),
          };
        }
        if (table === 'confirmation_request_assignments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 3 }),
            }),
          };
        }
        return createChainMock();
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: fromHandler,
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      const result = await getPendingConfirmations();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].project_name).toBe('Acme');
      expect(result.data![0].assignment_count).toBe(3);
      expect(result.data![0].is_expired).toBe(false);
    });

    it('returns error on DB failure', async () => {
      const fromHandler = vi.fn().mockImplementation((table: string) => {
        if (table === 'confirmation_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
              }),
            }),
          };
        }
        return createChainMock();
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: fromHandler,
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      const result = await getPendingConfirmations();

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });
  });

  // ==========================================
  // resendConfirmationEmail
  // ==========================================
  describe('resendConfirmationEmail', () => {
    const mockConfirmRequest = {
      id: 'req-1',
      token: 'tok-1',
      status: 'pending',
      project_id: 'proj-1',
      sent_to_email: 'john@acme.com',
      sent_to_name: 'John',
      expires_at: '2099-12-31T00:00:00Z',
      project: { client_name: 'Acme', poc_name: 'John' },
    };

    it('requires admin/editor', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockViewerProfile, error: null }),
                }),
              }),
            };
          }
          return createChainMock();
        }),
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      const result = await resendConfirmationEmail('req-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient permissions');
    });

    it('sends email for pending request', async () => {
      const fromHandler = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null }),
              }),
            }),
          };
        }
        if (table === 'confirmation_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockConfirmRequest, error: null }),
              }),
            }),
          };
        }
        if (table === 'confirmation_request_assignments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    assignment: {
                      user: { full_name: 'Eng' },
                      assignment_days: [{ work_date: '2026-04-01', start_time: '09:00', end_time: '17:00' }],
                    },
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        return createChainMock();
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: fromHandler,
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      const result = await resendConfirmationEmail('req-1');

      expect(result.success).toBe(true);
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'john@acme.com',
          subject: expect.stringContaining('Reminder'),
        })
      );
    });

    it('skips when email disabled and returns error reason', async () => {
      vi.mocked(checkEmailEnabled).mockResolvedValueOnce({
        canSendEmail: false,
        globalEnabled: true,
        projectEnabled: false,
        recipientEnabled: true,
      } as never);

      const fromHandler = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null }),
              }),
            }),
          };
        }
        if (table === 'confirmation_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockConfirmRequest, error: null }),
              }),
            }),
          };
        }
        return createChainMock();
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: fromHandler,
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      const result = await resendConfirmationEmail('req-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled');
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('returns error if request not found', async () => {
      const fromHandler = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null }),
              }),
            }),
          };
        }
        if (table === 'confirmation_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        return createChainMock();
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: fromHandler,
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      const result = await resendConfirmationEmail('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('returns error if request already responded to', async () => {
      const respondedRequest = { ...mockConfirmRequest, status: 'confirmed' };

      const fromHandler = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null }),
              }),
            }),
          };
        }
        if (table === 'confirmation_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: respondedRequest, error: null }),
              }),
            }),
          };
        }
        return createChainMock();
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: fromHandler,
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      const result = await resendConfirmationEmail('req-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already responded');
    });
  });

  // ==========================================
  // cancelConfirmationRequest
  // ==========================================
  describe('cancelConfirmationRequest', () => {
    it('requires auth', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      const result = await cancelConfirmationRequest('req-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');
    });

    it('requires admin/editor', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockViewerProfile, error: null }),
                }),
              }),
            };
          }
          return createChainMock();
        }),
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      const result = await cancelConfirmationRequest('req-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient permissions');
    });

    it('reverts assignments to draft and records status changes', async () => {
      const historyInsertMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ error: null }),
      });
      const deleteEqMock = vi.fn().mockResolvedValue({ error: null });
      const deleteMock = vi.fn().mockReturnValue({ eq: deleteEqMock });

      const fromHandler = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null }),
              }),
            }),
          };
        }
        if (table === 'confirmation_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'req-1', status: 'pending' },
                  error: null,
                }),
              }),
            }),
            delete: deleteMock,
          };
        }
        if (table === 'confirmation_request_assignments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ assignment_id: 'a-1' }, { assignment_id: 'a-2' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'project_assignments') {
          return { update: updateMock };
        }
        if (table === 'booking_status_history') {
          return { insert: historyInsertMock };
        }
        return createChainMock();
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: fromHandler,
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      const result = await cancelConfirmationRequest('req-1');

      expect(result.success).toBe(true);
      expect(updateMock).toHaveBeenCalledWith({ booking_status: 'draft' });
      expect(historyInsertMock).toHaveBeenCalledTimes(2);
      expect(historyInsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          old_status: 'pending',
          new_status: 'draft',
          note: 'Confirmation request cancelled',
        })
      );
    });

    it('deletes the confirmation request', async () => {
      const deleteEqMock = vi.fn().mockResolvedValue({ error: null });
      const deleteMock = vi.fn().mockReturnValue({ eq: deleteEqMock });

      const fromHandler = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null }),
              }),
            }),
          };
        }
        if (table === 'confirmation_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'req-1', status: 'pending' },
                  error: null,
                }),
              }),
            }),
            delete: deleteMock,
          };
        }
        if (table === 'confirmation_request_assignments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'project_assignments') {
          return {
            update: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === 'booking_status_history') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return createChainMock();
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: fromHandler,
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      await cancelConfirmationRequest('req-1');

      expect(deleteMock).toHaveBeenCalled();
      expect(deleteEqMock).toHaveBeenCalledWith('id', 'req-1');
    });

    it('returns error if request not found', async () => {
      const fromHandler = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null }),
              }),
            }),
          };
        }
        if (table === 'confirmation_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        return createChainMock();
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: fromHandler,
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      const result = await cancelConfirmationRequest('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('returns error if request already responded to', async () => {
      const fromHandler = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null }),
              }),
            }),
          };
        }
        if (table === 'confirmation_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'req-1', status: 'confirmed' },
                  error: null,
                }),
              }),
            }),
          };
        }
        return createChainMock();
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: fromHandler,
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

      const result = await cancelConfirmationRequest('req-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already responded');
    });
  });
});
