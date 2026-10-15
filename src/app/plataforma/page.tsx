import Link from 'next/link';
import { redirect } from 'next/navigation';

import { TestPlatform } from '@/components/test-platform';
import { createClient } from '@/lib/supabase/server';
import { AbandonPendingSubscriptionButton } from '@/components/abandon-pending-subscription-button';
import { StripePortalButton } from '@/components/stripe-portal-button';

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
  const subscriptionRecord = subscription as
    | (Record<string, unknown> & {
        id: string;
        plan_id: string;
        estado: string;
        periodo_inicio: string | null;
        periodo_fin: string | null;
        cancelar_al_final_del_periodo: boolean;
        stripe_customer_id: string | null;
        stripe_subscription_id: string | null;
        stripe_status: string | null;
        payment_issue: string | null;
        access_revoked_at: string | null;
      })
    | null;
  const { data: plan } = subscriptionRecord
    ? await supabase.from('planes').select('nombre').eq('id', subscriptionRecord.plan_id).maybeSingle()
    : { data: null };
  const { data: checkoutAttempts } = subscriptionRecord?.estado === 'pendiente'
    ? await supabase
        .from('stripe_checkout_attempts')
        .select('estado, expires_at')
        .eq('suscripcion_id', subscriptionRecord.id)
        .order('created_at', { ascending: false })
        .limit(1)
    : { data: null };

  const statusText = subscriptionError || accessError ? 'No se pudo cargar tu suscripción.' : subscriptionRecord?.estado ?? 'sin suscripción';

  const hasActiveAccess = Boolean(hasAccess);
  const canAbandonPending =
    subscriptionRecord?.estado === 'pendiente' &&
    !subscriptionRecord.stripe_subscription_id &&
    (!checkoutAttempts?.[0] ||
      checkoutAttempts[0].estado === 'expired' ||
      (checkoutAttempts[0].expires_at && new Date(checkoutAttempts[0].expires_at).getTime() <= Date.now()));
  const paymentIssueMessage =
    subscriptionRecord?.payment_issue === 'action_required'
      ? 'Tu pago requiere una acción. Abre el portal para completar la autenticación del pago.'
      : subscriptionRecord?.payment_issue === 'payment_failed'
        ? 'No se pudo completar el último cobro. Actualiza el método de pago en el portal.'
        : null;
  const friendlyStatus =
    subscriptionRecord?.estado === 'activa' &&
    subscriptionRecord.access_revoked_at &&
    subscriptionRecord.periodo_fin &&
    new Date(subscriptionRecord.periodo_fin).getTime() > Date.now()
      ? 'Acceso suspendido tras un reembolso'
      : subscriptionRecord?.estado === 'activa' && !hasActiveAccess
      ? 'Periodo pagado finalizado'
      : subscriptionRecord?.estado === 'activa' && subscriptionRecord.cancelar_al_final_del_periodo
        ? 'Activa · no se renovará'
        : subscriptionRecord?.estado === 'activa'
          ? 'Activa'
          : subscriptionRecord?.estado === 'pendiente'
            ? 'Pago pendiente'
            : subscriptionRecord?.estado === 'vencida' || subscriptionRecord?.estado === 'cancelada'
              ? 'Finalizada'
              : 'Sin suscripción';

  return (
    <main className="page-shell py-10 md:py-14">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-[var(--line)] bg-white/80 p-6 shadow-[0_26px_70px_rgba(23,60,58,0.04)] md:p-8">
        <p className="eyebrow">Plataforma</p>
        <h1 className="text-4xl font-normal tracking-[-0.06em] text-[var(--ink)] md:text-6xl">
          Tu espacio de práctica
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-[var(--muted)]">
          Gestiona tu acceso, los pagos y la preparación desde tu cuenta.
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
              {friendlyStatus}
            </p>
            <p className="mt-3 text-sm text-[var(--muted)]">
              {plan?.nombre ? `Plan ${plan.nombre}. ` : ''}
              {subscriptionRecord?.periodo_fin
                ? `Acceso pagado hasta ${formatDate(subscriptionRecord.periodo_fin)}.`
                : 'La contratación pendiente no concede acceso.'}
            </p>
            {subscriptionRecord?.estado === 'activa' &&
            !subscriptionRecord.cancelar_al_final_del_periodo &&
            subscriptionRecord.stripe_status === 'active' &&
            !subscriptionRecord.payment_issue ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                Próxima renovación prevista para {formatDate(subscriptionRecord.periodo_fin!)}; no es un cobro confirmado.
              </p>
            ) : null}
            {subscriptionRecord?.cancelar_al_final_del_periodo ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                Tu suscripción no se renovará. Mantienes el acceso hasta el final del periodo pagado.
              </p>
            ) : null}
            {paymentIssueMessage ? <p role="alert" className="mt-3 text-sm text-[var(--coral)]">{paymentIssueMessage}</p> : null}
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

        {subscriptionRecord?.stripe_subscription_id ? (
          <div className="mt-6">
            <StripePortalButton />
          </div>
        ) : null}
        {canAbandonPending ? (
          <div className="mt-6">
            <AbandonPendingSubscriptionButton />
          </div>
        ) : subscriptionRecord?.estado === 'pendiente' && !subscriptionRecord.stripe_subscription_id ? (
          <p className="mt-6 text-sm text-[var(--muted)]">
            Hay una sesión de pago que todavía puede completarse. Espera a que Stripe la marque como caducada antes de elegir otro plan.
          </p>
        ) : null}

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
