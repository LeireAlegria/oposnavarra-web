import Link from 'next/link';
import { redirect } from 'next/navigation';

import { TestPlatform } from '@/components/test-platform';
import { isAdminProfile } from '@/lib/admin-access';
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

export default async function PlatformPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  const initialTab =
    section === 'crear' ||
    section === 'oficiales' ||
    section === 'curso' ||
    section === 'resultados'
      ? section
      : undefined;
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

  const { data: subscription, error: subscriptionError } = await supabase.rpc(
    'consultar_mi_suscripcion',
  );
  const { data: hasAccess, error: accessError } = await supabase.rpc(
    'comprobar_acceso_suscripcion',
    {
      p_usuario_id: user.id,
    },
  );
  const { data: hasSubscription, error: subscriptionAccessError } = await supabase.rpc(
    'tiene_suscripcion_activa',
    {
      p_usuario_id: user.id,
    },
  );
  const { data: profile, error: profileError } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle();
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
    ? await supabase
        .from('planes')
        .select('nombre')
        .eq('id', subscriptionRecord.plan_id)
        .maybeSingle()
    : { data: null };
  const { data: checkoutAttempts } =
    subscriptionRecord?.estado === 'pendiente'
      ? await supabase
          .from('stripe_checkout_attempts')
          .select('estado, expires_at')
          .eq('suscripcion_id', subscriptionRecord.id)
          .order('created_at', { ascending: false })
          .limit(1)
      : { data: null };

  const statusText =
    subscriptionError || accessError || subscriptionAccessError || profileError
      ? 'No se pudo cargar tu suscripción.'
      : (subscriptionRecord?.estado ?? 'sin suscripción');

  const hasActiveAccess = Boolean(hasAccess);
  const hasActiveSubscription = Boolean(hasSubscription);
  const isAdmin = isAdminProfile(profile);
  const canAbandonPending =
    subscriptionRecord?.estado === 'pendiente' &&
    !subscriptionRecord.stripe_subscription_id &&
    (!checkoutAttempts?.[0] ||
      checkoutAttempts[0].estado === 'expired' ||
      (checkoutAttempts[0].expires_at &&
        new Date(checkoutAttempts[0].expires_at).getTime() <= Date.now()));
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
      : subscriptionRecord?.estado === 'activa' && !hasActiveSubscription
        ? 'Periodo pagado finalizado'
        : subscriptionRecord?.estado === 'activa' &&
            subscriptionRecord.cancelar_al_final_del_periodo
          ? 'Activa · no se renovará'
          : subscriptionRecord?.estado === 'activa'
            ? 'Activa'
            : subscriptionRecord?.estado === 'pendiente'
              ? 'Pago pendiente'
              : subscriptionRecord?.estado === 'vencida' ||
                  subscriptionRecord?.estado === 'cancelada'
                ? 'Finalizada'
                : 'Sin suscripción';

  const accountPanel = (
    <div className="space-y-4 text-sm">
      <Link href="/prueba-gratis/resultados" className="inline-block underline">Mis pruebas gratuitas guardadas</Link>
      <section className="rounded-xl border border-[var(--line)] bg-[#f8f7f3] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Estado de acceso
        </p>
        <p className="mt-2 text-lg font-semibold text-[var(--ink)]">
          {hasActiveAccess
            ? isAdmin && !hasActiveSubscription
              ? 'Acceso de administrador'
              : 'Acceso activo'
            : 'Acceso no disponible'}
        </p>
        <p className="mt-2 leading-5 text-[var(--muted)]">
          {hasActiveAccess
            ? isAdmin && !hasActiveSubscription
              ? 'Tu cuenta de administrador permite acceder a los tests sin una suscripción activa.'
              : 'Tu suscripción vigente habilita el acceso a las convocatorias disponibles.'
            : 'Sin una suscripción activa no se pueden crear ni continuar tests.'}
        </p>
      </section>

      <section className="rounded-xl border border-[var(--line)] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Suscripción
        </p>
        <p className="mt-2 text-lg font-semibold text-[var(--ink)]">{friendlyStatus}</p>
        <p className="mt-2 leading-5 text-[var(--muted)]">
          {plan?.nombre ? `Plan ${plan.nombre}. ` : ''}
          {subscriptionRecord?.periodo_fin
            ? `Acceso pagado hasta ${formatDate(subscriptionRecord.periodo_fin)}.`
            : 'La contratación pendiente no concede acceso.'}
        </p>
        {subscriptionRecord?.estado === 'activa' &&
        !subscriptionRecord.cancelar_al_final_del_periodo &&
        subscriptionRecord.stripe_status === 'active' &&
        !subscriptionRecord.payment_issue ? (
          <p className="mt-2 leading-5 text-[var(--muted)]">
            Próxima renovación prevista para {formatDate(subscriptionRecord.periodo_fin!)}; no es un
            cobro confirmado.
          </p>
        ) : null}
        {subscriptionRecord?.cancelar_al_final_del_periodo ? (
          <p className="mt-2 leading-5 text-[var(--muted)]">
            Tu suscripción no se renovará. Mantienes el acceso hasta el final del periodo pagado.
          </p>
        ) : null}
        {paymentIssueMessage ? (
          <p role="alert" className="mt-3 text-[var(--coral)]">
            {paymentIssueMessage}
          </p>
        ) : null}
      </section>

      <div className="flex flex-col gap-2">
        <Link
          href="/planes"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#bd3734] px-4 py-2 font-semibold text-white hover:bg-[#a82f2c]"
        >
          Ver planes
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--line)] px-4 py-2 font-semibold text-[var(--ink)] hover:bg-[#f8f7f3]"
        >
          Volver al inicio
        </Link>
        {subscriptionRecord?.stripe_subscription_id ? <StripePortalButton /> : null}
        {canAbandonPending ? (
          <AbandonPendingSubscriptionButton />
        ) : subscriptionRecord?.estado === 'pendiente' &&
          !subscriptionRecord.stripe_subscription_id ? (
          <p className="text-xs leading-5 text-[var(--muted)]">
            Hay una sesión de pago que todavía puede completarse. Espera a que Stripe la marque como
            caducada antes de elegir otro plan.
          </p>
        ) : null}
        <LogoutButton />
        <p className="text-xs text-[var(--muted)]">{statusText}</p>
      </div>
    </div>
  );

  return (
    <TestPlatform
      accountEmail={user.email ?? ''}
      accountPanel={accountPanel}
      canPractice={hasActiveAccess}
      initialTab={initialTab}
    />
  );
}
