import { beforeEach, describe, expect, it, vi } from 'vitest';
const clients = vi.hoisted(() => ({ privileged: { rpc: vi.fn() }, session: { rpc: vi.fn() } }));
vi.mock('@/lib/supabase/privileged', () => ({ createPrivilegedClient: () => clients.privileged }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => clients.session }));
import { POST } from './route';
const token = 'a'.repeat(64);
function send(body: unknown, ip = '192.0.2.1', origin = 'http://localhost') {
  return POST(
    new Request('http://localhost/api/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-client-ip': ip, origin },
      body: JSON.stringify(body),
    }),
  );
}
beforeEach(() => {
  vi.stubEnv('DEMO_IP_HEADER', 'x-client-ip');
  clients.privileged.rpc.mockReset().mockResolvedValue({ data: { state: 'started' }, error: null });
  clients.session.rpc.mockReset().mockResolvedValue({ data: { state: 'claimed' }, error: null });
});
describe('demonstration boundary', () => {
  it('hashes the credential and trusted origin before starting, and disables caching', async () => {
    const response = await send({ action: 'start', token });
    expect(response.status).toBe(200);
    expect(clients.privileged.rpc).toHaveBeenCalledWith('demo_start', {
      p_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_origin: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(clients.privileged.rpc.mock.calls[0][1].p_hash).not.toBe(token);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
  });
  it('uses JWT-based operations for recovery and claim rather than an arbitrary supplied owner', async () => {
    await send({ action: 'claim', token });
    expect(clients.session.rpc).toHaveBeenCalledWith('demo_claim', { p_token: token });
    expect(clients.privileged.rpc).not.toHaveBeenCalled();
    expect((await send({ action: 'claim', token, ownerId: 'attacker' })).status).toBe(400);
  });
  it('rejects injected scores, malformed tokens, cross-origin posts and missing trusted IPs', async () => {
    expect((await send({ action: 'start', token, score: 5 })).status).toBe(400);
    expect((await send({ action: 'restore', token: 'guess' })).status).toBe(400);
    expect(
      (await send({ action: 'start', token }, '192.0.2.1', 'https://evil.invalid')).status,
    ).toBe(403);
    expect((await send({ action: 'start', token }, 'unknown')).status).toBe(503);
    expect(clients.privileged.rpc).not.toHaveBeenCalled();
  });
  it('limits answers and returns a retry delay without leaking unexpected database errors', async () => {
    const answer = {
      action: 'answer',
      token,
      position: 0,
      option: '00000000-0000-4000-8000-000000000001',
    };
    clients.privileged.rpc.mockResolvedValueOnce({ error: { code: 'P0001', message: 'details' } });
    const limited = await send(answer);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBe('3600');
    clients.privileged.rpc.mockResolvedValueOnce({
      error: { code: 'XX000', message: 'private detail' },
    });
    const response = await send(answer);
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('private detail');
  });
});
