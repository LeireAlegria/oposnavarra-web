import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const auth = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth }) }));
import { GET } from './route';
const next = `/prueba-gratis#token=${'a'.repeat(64)}&guardar=1`;
beforeEach(() => {
  vi.clearAllMocks();
  auth.getUser.mockResolvedValue({ data: { user: { email_confirmed_at: '2026-10-29' } } });
});
describe('authentication continuity', () => {
  it('preserves the opaque recovery link after the ordinary PKCE callback', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await GET(
      new NextRequest(`http://localhost/auth/callback?code=valid&next=${encodeURIComponent(next)}`),
    );
    expect(response.headers.get('location')).toBe(`http://localhost${next}`);
  });
  it('supports token-hash email confirmation from another device without PKCE state', async () => {
    auth.verifyOtp.mockResolvedValue({ error: null });
    const response = await GET(
      new NextRequest(
        `http://localhost/auth/callback?token_hash=email-proof&type=email&next=${encodeURIComponent(next)}`,
      ),
    );
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'email-proof', type: 'email' });
    expect(response.headers.get('location')).toBe(`http://localhost${next}`);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it('retains recovery on a repeated callback or unavailable verifier instead of blocking the account', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: { message: 'no verifier' } });
    const response = await GET(
      new NextRequest(
        `http://localhost/auth/callback?code=repeated&next=${encodeURIComponent(next)}`,
      ),
    );
    const destination = new URL(response.headers.get('location')!);
    expect(destination.pathname).toBe('/acceder');
    expect(destination.searchParams.get('next')).toBe(next);
  });
  it('rejects external return destinations', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await GET(
      new NextRequest('http://localhost/auth/callback?code=valid&next=https://evil.invalid'),
    );
    expect(response.headers.get('location')).toBe('http://localhost/plataforma');
  });
});
