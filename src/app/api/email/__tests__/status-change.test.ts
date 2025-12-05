import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../status-change/route';
import { NextRequest } from 'next/server';

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Mock email send
vi.mock('@/lib/email/send', () => ({
  sendEmail: vi.fn(),
  getPortalUrl: vi.fn((token: string) => `https://app.test/status/${token}`),
}));

// Mock email templates
vi.mock('@/lib/email/templates', () => ({
  statusChangeEmail: vi.fn(() => '<html>Email content</html>'),
}));

import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/send';

function createMockRequest(body: Record<string, unknown>, origin?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (origin) {
    headers['origin'] = origin;
  }
  return new NextRequest('http://localhost:3000/api/email/status-change', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('POST /api/email/status-change', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 for invalid origin (CSRF protection)', async () => {
    const request = createMockRequest(
      {
        to: 'test@example.com',
        clientName: 'Test Client',
        newStatus: 'In Progress',
      },
      'https://malicious-site.com'
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Invalid origin');
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as unknown as ReturnType<typeof createClient>);

    const request = createMockRequest({
      to: 'test@example.com',
      clientName: 'Test Client',
      newStatus: 'In Progress',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 400 for invalid email format', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
      },
    } as unknown as ReturnType<typeof createClient>);

    const request = createMockRequest({
      to: 'invalid-email',
      clientName: 'Test Client',
      newStatus: 'In Progress',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid request');
    expect(data.details).toHaveProperty('to');
  });

  it('returns 400 for missing required fields', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
      },
    } as unknown as ReturnType<typeof createClient>);

    const request = createMockRequest({
      to: 'test@example.com',
      // missing clientName and newStatus
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid request');
  });

  it('sends email when authenticated with valid data', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
      },
    } as unknown as ReturnType<typeof createClient>);

    vi.mocked(sendEmail).mockResolvedValue({
      success: true,
      data: { id: 'email-123' },
    });

    const request = createMockRequest({
      to: 'client@example.com',
      clientName: 'Acme Corp',
      newStatus: 'Completed',
      previousStatus: 'In Progress',
      clientToken: 'token123',
      note: 'Great work!',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'client@example.com',
        subject: 'Project Update: Acme Corp - Completed',
      })
    );
  });

  it('returns 500 when email sending fails', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
      },
    } as unknown as ReturnType<typeof createClient>);

    vi.mocked(sendEmail).mockResolvedValue({
      success: false,
      error: 'SMTP error',
    });

    const request = createMockRequest({
      to: 'client@example.com',
      clientName: 'Test Client',
      newStatus: 'In Progress',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('SMTP error');
  });
});
