import { createClient } from '@supabase/supabase-js';

// Never import this module into a client component.
export function createPrivilegedClient() {
  if (typeof window !== 'undefined') throw new Error('Server only');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing server configuration');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
