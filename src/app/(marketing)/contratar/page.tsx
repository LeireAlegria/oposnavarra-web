import Link from 'next/link';

import { StripeCheckoutButton } from '@/components/stripe-checkout-button';
import { formatPrice } from '@/lib/public-content';
import { getPublicPlans } from '@/lib/subscriptions';

export const metadata = {
  title: 'Contratar una suscripción',
  description: 'Revisa las condiciones de tu suscripción antes de continuar al pago seguro.',
};

type ContractPageProps = {
  searchParams: Promise<{ plan?: string }>;
};

export default async function ContractPage({ searchParams }: ContractPageProps) {
  const { plan: planId } = await searchParams;
  let plan = null;
  try {
    plan = (await getPublicPlans()).find((item) => item.id === planId) ?? null;
  } catch {
    plan = null;
  }

  return (
    <main className="page-shell py-10 md:py-16">
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-[var(--line)] bg-white/90 p-6 shadow-[0_26px_70px_rgba(23,60,58,0.06)] md:p-10">
        <p className="eyebrow">Resumen de contratación</p>
        <h1 className="mt-3 text-4xl font-normal tracking-[-0.06em] text-[var(--ink)] md:text-5xl">
          {plan ? `Plan ${plan.name}` : 'Plan no disponible'}
        </h1>
        {plan ? (
          <>
            <p className="mt-6 text-[var(--muted)]">
              Revisa las condiciones antes de continuar. El pago se completará en Stripe.
            </p>
            <dl className="mt-7 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] px-5">
              <div className="flex justify-between gap-4 py-4">
                <dt className="text-sm text-[var(--muted)]">Importe total por periodo</dt>
                <dd className="font-sans text-lg font-semibold text-[var(--ink)]">{formatPrice(plan.priceCents)}</dd>
              </div>
              <div className="flex justify-between gap-4 py-4">
                <dt className="text-sm text-[var(--muted)]">Duración</dt>
                <dd className="text-right font-sans text-sm font-semibold text-[var(--ink)]">
                  {plan.durationMonths} {plan.durationMonths === 1 ? 'mes' : 'meses'}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-4">
                <dt className="text-sm text-[var(--muted)]">Renovación</dt>
                <dd className="text-right font-sans text-sm font-semibold text-[var(--ink)]">{plan.renewal}</dd>
              </div>
              <div className="flex justify-between gap-4 py-4">
                <dt className="text-sm text-[var(--muted)]">Acceso incluido</dt>
                <dd className="max-w-sm text-right font-sans text-sm font-semibold text-[var(--ink)]">
                  Todas las convocatorias disponibles, incluidas las nuevas durante la vigencia.
                </dd>
              </div>
            </dl>
            <p className="mt-5 text-sm leading-6 text-[var(--muted)]">
              Puedes cancelar la renovación desde tu cuenta o el portal de Stripe. Mantendrás el acceso hasta el final del periodo pagado.
            </p>
            <StripeCheckoutButton planId={plan.id} />
          </>
        ) : (
          <>
            <p role="alert" className="mt-5 text-[var(--muted)]">
              No se pudo cargar ese plan. Vuelve al catálogo para elegir un plan disponible.
            </p>
            <Link
              href="/planes"
              className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--coral)] px-5 py-3 font-sans text-sm font-semibold text-white hover:bg-[#d95d4d]"
            >
              Volver a los planes
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
