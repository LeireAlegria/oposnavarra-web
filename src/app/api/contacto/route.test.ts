import { beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase/privileged', () => ({ createPrivilegedClient: () => api }));
import { POST } from './route';
const valid = { name: ' Ana ', email: 'ana@example.com', message: 'Hola', honeypot: '' };
function send(body: unknown, ip = '192.0.2.1') {
  return POST(
    new Request('http://localhost/api/contacto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-client-ip': ip },
      body: JSON.stringify(body),
    }),
  );
}
beforeEach(() => {
  vi.stubEnv('CONTACT_IP_HEADER', 'x-client-ip');
  api.rpc.mockReset();
  api.rpc.mockResolvedValue({ error: null });
});
describe('contact submission', () => {
  it('only stores the inquiry and never calls an email service', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    try {
      expect((await send(valid)).status).toBe(200);
      expect(api.rpc).toHaveBeenCalledOnce();
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('confirms only after saving trimmed content and never accepts state fields', async () => {
    expect((await send(valid)).status).toBe(200);
    expect(api.rpc).toHaveBeenCalledWith(
      'guardar_mensaje_contacto',
      expect.objectContaining({
        p_nombre: 'Ana',
        p_mensaje: 'Hola',
        p_ip_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect((await send({ ...valid, leido: true })).status).toBe(400);
    expect(api.rpc).toHaveBeenCalledTimes(1);
  });
  it.each([
    { ...valid, name: 'x'.repeat(121) },
    { ...valid, message: ' ' },
    { ...valid, email: 'invalid' },
    { ...valid, honeypot: 'bot' },
  ])('rejects invalid fields and bots', async (body) => {
    expect((await send(body)).status).toBe(400);
    expect(api.rpc).not.toHaveBeenCalled();
  });
  it('fails closed without a trusted IP', async () => {
    expect((await send(valid, 'unknown')).status).toBe(503);
    expect(api.rpc).not.toHaveBeenCalled();
  });
  it('reports frequency and storage failures without confirming success', async () => {
    api.rpc.mockResolvedValueOnce({ error: { code: 'P0001' } });
    expect((await send(valid)).status).toBe(429);
    api.rpc.mockResolvedValueOnce({ error: { code: 'other' } });
    expect((await send(valid)).status).toBe(503);
  });
});
