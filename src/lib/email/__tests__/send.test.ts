import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendEmail, getPortalUrl } from '../send';

// Mock the resend module
vi.mock('@/lib/resend', () => ({
  getResend: vi.fn(),
}));

import { getResend } from '@/lib/resend';

describe('sendEmail', () => {
  const mockSend = vi.fn();
  const mockResend = {
    emails: {
      send: mockSend,
    },
  };

  beforeEach(() => {
    vi.mocked(getResend).mockReturnValue(mockResend as never);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('sends email successfully with single recipient', async () => {
    mockSend.mockResolvedValue({
      data: { id: 'email-123' },
      error: null,
    });

    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Test content</p>',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 'email-123' });
    expect(mockSend).toHaveBeenCalledWith({
      from: 'Amitrace <updates@dash.amitrace.com>',
      to: ['test@example.com'],
      subject: 'Test Subject',
      html: '<p>Test content</p>',
      replyTo: 'support@amitrace.com',
    });
  });

  it('sends email successfully with multiple recipients', async () => {
    mockSend.mockResolvedValue({
      data: { id: 'email-456' },
      error: null,
    });

    const result = await sendEmail({
      to: ['test1@example.com', 'test2@example.com'],
      subject: 'Test Subject',
      html: '<p>Test content</p>',
    });

    expect(result.success).toBe(true);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['test1@example.com', 'test2@example.com'],
      })
    );
  });

  it('uses custom replyTo when provided', async () => {
    mockSend.mockResolvedValue({
      data: { id: 'email-789' },
      error: null,
    });

    await sendEmail({
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Test content</p>',
      replyTo: 'custom@example.com',
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        replyTo: 'custom@example.com',
      })
    );
  });

  it('returns error when Resend returns an error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockSend.mockResolvedValue({
      data: null,
      error: { message: 'Invalid API key' },
    });

    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Test content</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid API key');
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('handles exceptions during email send', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockSend.mockRejectedValue(new Error('Network error'));

    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Test content</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('handles non-Error exceptions', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockSend.mockRejectedValue('Unknown error');

    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Test content</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to send email');

    consoleSpy.mockRestore();
  });

  it('returns undefined data when send returns null data', async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Test content</p>',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeUndefined();
  });
});

describe('getPortalUrl', () => {
  const originalEnv = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalEnv;
  });

  it('returns portal URL with environment variable base', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.amitrace.com';

    const url = getPortalUrl('test-token-123');

    expect(url).toBe('https://app.amitrace.com/status/test-token-123');
  });

  it('falls back to localhost when env not set', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    const url = getPortalUrl('test-token-456');

    expect(url).toBe('http://localhost:3000/status/test-token-456');
  });
});
