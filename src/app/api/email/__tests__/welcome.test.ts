import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../welcome/route';
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
  welcomeEmail: vi.fn(() => '<html>Welcome email</html>'),
}));

import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/send';

function createMockRequest(body: Record<string, unknown>, origin?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (origin) {
    headers['origin'] = origin;
  }
  return new NextRequest('http://localhost:3000/api/email/welcome', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('POST /api/email/welcome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 for invalid origin (CSRF protection)', async () => {
    const request = createMockRequest(
      {
        to: 'poc@client.com',
        clientName: 'Test Client',
        pocName: 'John Doe',
        clientToken: 'token123',
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
      to: 'poc@client.com',
      clientName: 'Test Client',
      pocName: 'John Doe',
      clientToken: 'token123',
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
      to: 'not-an-email',
      clientName: 'Test Client',
      pocName: 'John Doe',
      clientToken: 'token123',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid request');
    expect(data.details).toHaveProperty('to');
  });

  it('returns 400 for missing clientToken', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
      },
    } as unknown as ReturnType<typeof createClient>);

    const request = createMockRequest({
      to: 'poc@client.com',
      clientName: 'Test Client',
      pocName: 'John Doe',
      // missing clientToken
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid request');
  });

  it('returns 400 for empty pocName', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
      },
    } as unknown as ReturnType<typeof createClient>);

    const request = createMockRequest({
      to: 'poc@client.com',
      clientName: 'Test Client',
      pocName: '',
      clientToken: 'token123',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid request');
  });

  it('sends welcome email when authenticated with valid data', async () => {
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
      to: 'poc@client.com',
      clientName: 'Acme Corp',
      pocName: 'Jane Smith',
      clientToken: 'token456',
      projectType: 'Development',
      initialStatus: 'Kickoff',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'poc@client.com',
        subject: 'Welcome to Amitrace - Acme Corp',
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
      error: 'Rate limit exceeded',
    });

    const request = createMockRequest({
      to: 'poc@client.com',
      clientName: 'Test Client',
      pocName: 'John Doe',
      clientToken: 'token123',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Rate limit exceeded');
  });
});
