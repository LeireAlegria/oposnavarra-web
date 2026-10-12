import Link from 'next/link';
import { redirect } from 'next/navigation';

import { TestPlatform } from '@/components/test-platform';
import { createClient } from '@/lib/supabase/server';

import { LogoutButton } from './logout-button';

function formatDate(date: string | null) {
  if (!date) {
    return 'Sin fecha';
  }

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
  }).format(new Date(date));
}

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

  const { data: subscription, error: subscriptionError } = await supabase.rpc('consultar_mi_suscripcion');
  const { data: hasAccess, error: accessError } = await supabase.rpc('comprobar_acceso_suscripcion', {
    p_usuario_id: user.id,
  });

  const statusText = subscriptionError || accessError ? 'No se pudo cargar tu suscripción.' : subscription?.estado ?? 'sin suscripción';

  const hasActiveAccess = Boolean(hasAccess);

  return (
    <main className="page-shell py-10 md:py-14">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-[var(--line)] bg-white/80 p-6 shadow-[0_26px_70px_rgba(23,60,58,0.04)] md:p-8">
        <p className="eyebrow">Plataforma</p>
        <h1 className="text-4xl font-normal tracking-[-0.06em] text-[var(--ink)] md:text-6xl">
          Tu espacio de práctica
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-[var(--muted)]">
          La aplicación de tests sigue en desarrollo, pero la gestión de la suscripción ya se encuentra preparada para la integración con la plataforma.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--line)] bg-[rgba(22,31,29,0.03)] p-5">
            <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[var(--coral)]">Estado de acceso</p>
            <p className="mt-3 text-2xl font-semibold text-[var(--ink)]">{hasActiveAccess ? 'Acceso activo' : 'Acceso no disponible'}</p>
            <p className="mt-3 text-sm text-[var(--muted)]">
              {hasActiveAccess
                ? 'Tu suscripción vigente habilita el acceso global a todas las convocatorias disponibles.'
                : 'Sin una suscripción activa, la plataforma permanece bloqueada.'}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[rgba(243,111,94,0.05)] p-5">
            <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[var(--coral)]">Suscripción</p>
            <p className="mt-3 text-2xl font-semibold text-[var(--ink)]">
              {subscription ? subscription.estado : 'Sin suscripción'}
            </p>
            <p className="mt-3 text-sm text-[var(--muted)]">
              {subscription?.periodo_fin ? `Periodo actual hasta ${formatDate(subscription.periodo_fin)}` : 'La contratación pendiente o sin fecha no concede acceso.'}
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link href="/planes" className="inline-flex items-center justify-center rounded-full bg-[var(--coral)] px-5 py-3 font-sans text-sm font-semibold text-white transition-colors hover:bg-[#d95d4d]">
            Ver planes
          </Link>
          <Link href="/" className="inline-flex items-center justify-center rounded-full border border-[var(--ink)] px-5 py-3 font-sans text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-white/70">
            Volver al inicio
          </Link>
          <LogoutButton />
        </div>

        <p className="mt-6 text-sm text-[var(--muted)]">{statusText}</p>
      </div>

      {hasActiveAccess ? (
        <div className="mt-10">
          <TestPlatform />
        </div>
      ) : (
        <div className="mx-auto mt-10 max-w-4xl rounded-[2rem] border border-[var(--line)] bg-[rgba(22,31,29,0.03)] p-6 md:p-8">
          <p className="eyebrow">Historial disponible</p>
          <h2 className="text-2xl font-normal text-[var(--ink)]">Puedes consultar tus resultados anteriores aunque la plataforma esté bloqueada.</h2>
          <p className="mt-3 text-[var(--muted)]">Activa una suscripción vigente para crear tests nuevos, recuperar intentos en curso o revisar preguntas completas.</p>
        </div>
      )}
    </main>
  );
}
