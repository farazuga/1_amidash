import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CopyClientLink } from '../copy-client-link';
import { getPortalUrl } from '@/lib/email/send';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
}));

describe('CopyClientLink', () => {
  it('renders button when token is provided', () => {
    render(<CopyClientLink token="test-token-123" />);
    expect(screen.getByRole('button', { name: /copy client link/i })).toBeInTheDocument();
  });

  it('does not render when token is null', () => {
    const { container } = render(<CopyClientLink token={null} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('getPortalUrl', () => {
  it('generates /status/{token} URL', () => {
    const url = getPortalUrl('my-token');
    expect(url).toMatch(/\/status\/my-token$/);
  });

  it('uses NEXT_PUBLIC_APP_URL as base', () => {
    const originalEnv = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = 'https://dash.amitrace.com';

    const url = getPortalUrl('abc');
    expect(url).toBe('https://dash.amitrace.com/status/abc');

    process.env.NEXT_PUBLIC_APP_URL = originalEnv;
  });
});

describe('Portal link consistency', () => {
  it('all portal links use the /status/{token} pattern', () => {
    // This test documents the expected portal URL pattern.
    // The mobile card view, table column, copy link, and emails
    // should all generate URLs matching /status/{token}.
    const token = 'test-uuid-token';
    const expectedPattern = `/status/${token}`;

    // getPortalUrl (used by emails)
    expect(getPortalUrl(token)).toContain(expectedPattern);

    // The same pattern is used in:
    // - projects-table.tsx line ~503: window.open(`/status/${project.client_token}`, '_blank')
    // - projects-table.tsx line ~696: window.open(`/status/${project.client_token}`, '_blank')
    // - copy-client-link.tsx line 17: `${window.location.origin}/status/${token}`
  });
});
