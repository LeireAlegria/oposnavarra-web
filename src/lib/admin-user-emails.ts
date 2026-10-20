import type { SupabaseClient } from '@supabase/supabase-js';

export async function getAdminUserEmails(supabase: SupabaseClient, userIds: string[]) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return { emails: new Map<string, string | null>(), error: null };

  const { data, error } = await supabase
    .rpc('list_admin_users')
    .select('id, email')
    .in('id', ids);

  const users = (data ?? []) as Array<{ id: string; email: string | null }>;

  return {
    emails: new Map<string, string | null>(
      users.map((user) => [user.id, user.email]),
    ),
    error,
  };
}
