import { createStripeSignature, verifyStripeSignature } from './stripe-signature.ts';

export const STRIPE_API_VERSION = '2026-09-30.endive';
export { createStripeSignature, verifyStripeSignature };

export type AuthenticatedUser = {
  id: string;
  email: string;
  email_confirmed_at: string | null;
};

export type StripeObject = Record<string, unknown> & {
  id: string;
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, apikey, content-type',
      'access-control-allow-methods': 'POST, OPTIONS',
    },
  });
}

export function handleOptions(request: Request): Response | null {
  return request.method === 'OPTIONS'
    ? new Response('ok', {
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': 'authorization, apikey, content-type',
          'access-control-allow-methods': 'POST, OPTIONS',
        },
      })
    : null;
}

export function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required configuration: ${name}`);
  return value;
}

export function stripeMode(): 'test' | 'live' {
  const mode = requiredEnv('STRIPE_MODE');
  if (mode !== 'test' && mode !== 'live') throw new Error('STRIPE_MODE must be test or live.');
  const key = requiredEnv('STRIPE_SECRET_KEY');
  if ((mode === 'test' && !key.startsWith('sk_test_')) || (mode === 'live' && !key.startsWith('sk_live_'))) {
    throw new Error('Stripe key does not match STRIPE_MODE.');
  }
  return mode;
}

export async function authenticateUser(request: Request): Promise<AuthenticatedUser> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Error('Authentication required.');
  const response = await fetch(`${requiredEnv('SUPABASE_URL')}/auth/v1/user`, {
    headers: {
      apikey: requiredEnv('SUPABASE_ANON_KEY'),
      authorization,
    },
  });
  if (!response.ok) throw new Error('Authentication required.');
  const user = (await response.json()) as AuthenticatedUser;
  if (!user.id || !user.email || !user.email_confirmed_at) {
    throw new Error('A verified email address is required.');
  }
  return user;
}

export async function adminRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const key = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  return fetch(`${requiredEnv('SUPABASE_URL')}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });
}

export async function adminRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const response = await adminRequest(`rpc/${name}`, {
    method: 'POST',
    body: JSON.stringify(args),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof body?.message === 'string' ? body.message : `Database operation ${name} failed.`;
    throw new Error(message);
  }
  return body as T;
}

export async function stripeRequest<T>(
  path: string,
  method: 'GET' | 'POST',
  parameters?: URLSearchParams,
  idempotencyKey?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${requiredEnv('STRIPE_SECRET_KEY')}`,
    'stripe-version': STRIPE_API_VERSION,
  };
  if (method === 'POST') headers['content-type'] = 'application/x-www-form-urlencoded';
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
  const query = method === 'GET' && parameters?.size ? `?${parameters.toString()}` : '';
  const response = await fetch(`https://api.stripe.com${path}${query}`, {
    method,
    headers,
    ...(method === 'POST' ? { body: parameters?.toString() ?? '' } : {}),
  });
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!response.ok || !body) {
    throw new Error(body?.error?.message ?? `Stripe request failed with status ${response.status}.`);
  }
  return body as T;
}

export function stringId(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    return value.id;
  }
  return null;
}

export function unixDate(value: unknown): string | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Date(value * 1000).toISOString()
    : null;
}
