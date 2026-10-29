import { afterEach, describe, expect, it, vi } from 'vitest';
import { getContactIp } from './contact-origin';
afterEach(() => vi.unstubAllEnvs());
describe('contact source', () => {
  it('allows a shared development bucket on localhost without trusting forwarded headers', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('CONTACT_IP_HEADER', '');
    expect(
      getContactIp(
        new Request('http://localhost:3000/api/contacto', {
          headers: { 'x-forwarded-for': '192.0.2.42' },
        }),
      ),
    ).toBe('127.0.0.1');
  });
  it('requires trusted ingress configuration in production and on public hosts', () => {
    vi.stubEnv('CONTACT_IP_HEADER', '');
    vi.stubEnv('NODE_ENV', 'production');
    expect(getContactIp(new Request('http://localhost/api/contacto'))).toBeNull();
    vi.stubEnv('NODE_ENV', 'development');
    expect(getContactIp(new Request('https://example.com/api/contacto'))).toBeNull();
  });
  it('rejects missing or spoofed lists and normalizes equivalent IPv6 addresses', () => {
    vi.stubEnv('CONTACT_IP_HEADER', 'x-client-ip');
    expect(getContactIp(new Request('http://localhost/api/contacto'))).toBeNull();
    expect(
      getContactIp(
        new Request('http://localhost/api/contacto', {
          headers: { 'x-client-ip': '192.0.2.1, 192.0.2.2' },
        }),
      ),
    ).toBeNull();
    const normalized = getContactIp(
      new Request('http://localhost/api/contacto', {
        headers: { 'x-client-ip': '2001:0DB8:0:0:0:0:0:1' },
      }),
    );
    expect(normalized).toBe('2001:db8::1');
  });
});
