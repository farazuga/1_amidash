import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockMessagesCreate = vi.fn().mockResolvedValue({
  content: [{ type: 'text', text: 'This project involves installing broadcast equipment.' }],
  usage: { input_tokens: 100, output_tokens: 20 },
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/api/csrf', () => ({
  validateOrigin: vi.fn().mockReturnValue(null),
}));

vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }

  // Use a wrapper that delegates to the hoisted mockMessagesCreate
  const Anthropic = function () {
    return {
      messages: {
        create: (...args: unknown[]) => mockMessagesCreate(...args),
      },
    };
  };

  Anthropic.APIError = APIError;

  return { default: Anthropic };
});

import { createClient } from '@/lib/supabase/server';
import { POST } from '../summarize/route';

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/odoo/summarize', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockAuth(authenticated = true) {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authenticated ? { id: 'user-1' } : null },
      }),
    },
  });
}

describe('POST /api/odoo/summarize', () => {
  beforeEach(() => {
    mockMessagesCreate.mockClear();
    (createClient as ReturnType<typeof vi.fn>).mockReset();
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  });

  it('returns 401 when user is not authenticated', async () => {
    mockAuth(false);

    const response = await POST(
      makeRequest({
        lineItems: [{ productName: 'Test', quantity: 1, description: 'Test item', subtotal: 100 }],
        clientName: 'Test Client',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 400 when lineItems is empty', async () => {
    mockAuth();

    const response = await POST(makeRequest({ lineItems: [], clientName: 'Test' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('lineItems');
  });

  it('returns 400 when clientName is missing', async () => {
    mockAuth();

    const response = await POST(
      makeRequest({
        lineItems: [{ productName: 'Test', quantity: 1, description: 'Test', subtotal: 100 }],
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('clientName');
  });

  it('returns summary on success', async () => {
    mockAuth();

    const response = await POST(
      makeRequest({
        lineItems: [
          { productName: 'TriCaster Mini X', quantity: 1, description: 'Video switcher', subtotal: 5000 },
          { productName: 'BMD Camera', quantity: 3, description: 'Studio cameras', subtotal: 6000 },
        ],
        clientName: 'Lincoln High School',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.summary).toBe('This project involves installing broadcast equipment.');
    expect(mockMessagesCreate).toHaveBeenCalledOnce();
  });
});
