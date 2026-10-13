import Link from 'next/link';
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

  return (
    <main className="page-shell py-10 md:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Administración</p>
            <h1 className="text-4xl font-normal tracking-[-0.06em] text-[var(--ink)] md:text-6xl">
              Panel del administrador
            </h1>
          </div>
          <Link
            href="/plataforma"
            className="inline-flex items-center justify-center rounded-full border border-[var(--ink)] px-5 py-3 font-sans text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-white/70"
          >
            Volver a la plataforma
          </Link>
        </div>

        <AdminConsole />
      </div>
    </main>
  );
}
