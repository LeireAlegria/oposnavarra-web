export async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string,
  nowSeconds = Date.now() / 1000,
): Promise<boolean> {
  const fields = signature.split(',').map((part) => part.split('=', 2));
  const timestamp = fields.find(([key]) => key === 't')?.[1];
  const signatures = fields.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > 300) return false;

  const expected = await createHmacSignature(`${timestamp}.${payload}`, secret);
  return signatures.some((candidate) => {
    if (!/^[a-f\d]{64}$/i.test(candidate) || candidate.length !== expected.length) return false;
    let difference = 0;
    for (let index = 0; index < expected.length; index += 1) {
      difference |= expected.charCodeAt(index) ^ candidate.toLowerCase().charCodeAt(index);
    }
    return difference === 0;
  });
}

export async function createStripeSignature(payload: string, secret: string, timestamp: number): Promise<string> {
  const signature = await createHmacSignature(`${timestamp}.${payload}`, secret);
  return `t=${timestamp},v1=${signature}`;
}

async function createHmacSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
