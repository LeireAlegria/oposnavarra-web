import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from './api-client';

describe('apiFetch', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.test/');
  });

  it('normalizes the base URL and exposes failed HTTP responses as ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    await expect(apiFetch('/health')).rejects.toEqual(
      new ApiError(503, 'API request failed with status 503'),
    );
    expect(fetch).toHaveBeenCalledWith('https://api.example.test/health', expect.anything());
  });

  it('passes an AbortSignal through to fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ok: true })));
    const controller = new AbortController();

    await apiFetch<{ ok: boolean }>('/health', { signal: controller.signal });

    expect(fetch).toHaveBeenCalledWith('https://api.example.test/health', expect.objectContaining({ signal: controller.signal }));
  });
});
