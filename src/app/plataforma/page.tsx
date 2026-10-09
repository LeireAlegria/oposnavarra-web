import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { LogoutButton } from './logout-button';

export default async function PlatformPage() {
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

  return (
    <main className="status-page">
      <div className="auth-shell">
        <p className="eyebrow">Plataforma</p>
        <h1>Tu espacio de práctica</h1>
        <p>
          Aquí podrás comenzar a preparar tus oposiciones cuando la aplicación de tests esté
          disponible.
        </p>

        <div className="status-actions" style={{ display: 'grid', gap: '0.75rem' }}>
          <Link href="/" className="button">
            Volver al inicio
          </Link>
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
