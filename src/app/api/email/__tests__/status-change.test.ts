import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../status-change/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/email/send', () => ({
  sendEmail: vi.fn(),
  getPortalUrl: vi.fn((token: string) => `https://app.test/status/${token}`),
}));

vi.mock('@/lib/email/templates', () => ({
  statusChangeEmail: vi.fn(() => '<html>Email</html>'),
}));

import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/send';

function createMockRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/email/status-change', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/email/status-change', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as unknown as ReturnType<typeof createClient>);

    const response = await POST(createMockRequest({ to: 'test@example.com', clientName: 'Test', newStatus: 'Done' }));
    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid email', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: '123' } } }) },
    } as unknown as ReturnType<typeof createClient>);

    const response = await POST(createMockRequest({ to: 'invalid', clientName: 'Test', newStatus: 'Done' }));
    expect(response.status).toBe(400);
  });

  it('sends email when authenticated with valid data', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: '123' } } }) },
    } as unknown as ReturnType<typeof createClient>);
    vi.mocked(sendEmail).mockResolvedValue({ success: true, data: { id: 'email-123' } });

    const response = await POST(createMockRequest({ to: 'test@example.com', clientName: 'Test', newStatus: 'Done' }));
    expect(response.status).toBe(200);
    expect(sendEmail).toHaveBeenCalled();
  });
});
