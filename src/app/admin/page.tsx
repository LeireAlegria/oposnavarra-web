import { redirect } from 'next/navigation';

import { AdminConsole } from '@/components/admin-console';
import { isAdminProfile } from '@/lib/admin-access';
import { createClient } from '@/lib/supabase/server';

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/acceder');
  }

  if (!user.email_confirmed_at) {
    redirect(`/verificar-correo?email=${encodeURIComponent(user.email ?? '')}`);
  }

  const { data: profile, error: profileError } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !isAdminProfile(profile)) {
    redirect('/plataforma');
  }

  return <AdminConsole adminEmail={user.email ?? 'Administrador'} />;
}
