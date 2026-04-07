import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('getAppAccessToken', () => {
  let getAppAccessToken: () => Promise<string>;
  let clearTokenCache: () => void;

  beforeEach(async () => {
    mockFetch.mockReset();
    vi.useFakeTimers();

    // Set env vars before each fresh import
    process.env.MICROSOFT_TENANT_ID = 'test-tenant-id';
    process.env.MICROSOFT_CLIENT_ID = 'test-client-id';
    process.env.MICROSOFT_CLIENT_SECRET = 'test-client-secret';

    // Fresh import so module reads env vars
    vi.resetModules();
    const mod = await import('../auth');
    getAppAccessToken = mod.getAppAccessToken;
    clearTokenCache = mod.clearTokenCache;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches a token from the OAuth endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'new-token-abc',
        expires_in: 3600,
      }),
    });

    const token = await getAppAccessToken();

    expect(token).toBe('new-token-abc');
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(
      'https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/token'
    );
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe(
      'application/x-www-form-urlencoded'
    );

    const body = new URLSearchParams(options.body);
    expect(body.get('client_id')).toBe('test-client-id');
    expect(body.get('client_secret')).toBe('test-client-secret');
    expect(body.get('scope')).toBe('https://graph.microsoft.com/.default');
    expect(body.get('grant_type')).toBe('client_credentials');
  });

  it('caches the token and returns it on subsequent calls', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'cached-token',
        expires_in: 3600,
      }),
    });

    const token1 = await getAppAccessToken();
    const token2 = await getAppAccessToken();

    expect(token1).toBe('cached-token');
    expect(token2).toBe('cached-token');
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('refreshes the token when it is within 5 minutes of expiry', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'first-token',
          expires_in: 3600,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'refreshed-token',
          expires_in: 3600,
        }),
      });

    const token1 = await getAppAccessToken();
    expect(token1).toBe('first-token');

    // Advance time to within the 5-minute buffer of expiry
    vi.advanceTimersByTime((3600 - 299) * 1000);

    const token2 = await getAppAccessToken();
    expect(token2).toBe('refreshed-token');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does not refresh when token still has time remaining beyond the buffer', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'valid-token',
        expires_in: 3600,
      }),
    });

    await getAppAccessToken();

    // Advance 30 minutes — still 30 min left, well beyond 5-min buffer
    vi.advanceTimersByTime(30 * 60 * 1000);

    const token = await getAppAccessToken();
    expect(token).toBe('valid-token');
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('throws on API error with error_description', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'invalid_client',
        error_description: 'Client credentials are invalid',
      }),
    });

    await expect(getAppAccessToken()).rejects.toThrow(
      'Failed to get app token: Client credentials are invalid'
    );
  });

  it('throws on API error falling back to error field', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'unauthorized_client',
      }),
    });

    await expect(getAppAccessToken()).rejects.toThrow(
      'Failed to get app token: unauthorized_client'
    );
  });

  it('clearTokenCache forces a new fetch on next call', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token-before-clear',
          expires_in: 3600,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token-after-clear',
          expires_in: 3600,
        }),
      });

    const t1 = await getAppAccessToken();
    expect(t1).toBe('token-before-clear');

    clearTokenCache();

    const t2 = await getAppAccessToken();
    expect(t2).toBe('token-after-clear');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
