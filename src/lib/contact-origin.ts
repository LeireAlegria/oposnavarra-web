import { isIP } from 'node:net';

export function getContactIp(request: Request): string | null {
  const header = process.env.CONTACT_IP_HEADER?.trim();
  if (header) {
    const ip = request.headers.get(header)?.trim();
    if (!ip || !isIP(ip)) return null;
    return isIP(ip) === 6 ? new URL(`http://[${ip}]/`).hostname.slice(1, -1) : ip;
  }

  // Local development has no trusted ingress. Use one shared, non-spoofable bucket.
  const hostname = new URL(request.url).hostname;
  if (
    process.env.NODE_ENV === 'development' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(hostname)
  ) {
    return '127.0.0.1';
  }
  return null;
}
