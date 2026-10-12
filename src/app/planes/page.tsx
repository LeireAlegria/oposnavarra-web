import Link from 'next/link';

import { formatPrice, subscriptionPlans } from '@/lib/public-content';

export const metadata = {
  title: 'Planes',
  description: 'Consulta las modalidades de suscripción de OposNavarra y el acceso global a todas las convocatorias disponibles.',
};

export default function PlansPage() {
  return (
    <main className="page-shell py-10 md:py-14">
      <section className="max-w-3xl">
        <p className="eyebrow">Suscripción global</p>
        <h1 className="text-4xl font-normal tracking-[-0.06em] text-[var(--ink)] md:text-6xl">
          Elige tu modalidad
        </h1>
        <p className="mt-5 text-lg text-[var(--muted)]">
          Hay una única suscripción para OposNavarra. Las modalidades cambian el precio y la duración,
          pero todas incluyen el mismo acceso a todas las convocatorias disponibles.
        </p>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-3">
        {subscriptionPlans.map((plan) => (
          <article key={plan.code} className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-6 shadow-[0_16px_42px_rgba(23,60,58,0.04)]">
            <div className="flex items-center justify-between gap-4">
              <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[var(--coral)]">
                {plan.name}
              </p>
              {plan.code === 'anual' ? (
                <span className="rounded-full bg-[var(--yellow)] px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink)]">
                  Mejor valor
                </span>
              ) : null}
            </div>

            <p className="mt-6 text-4xl font-semibold tracking-[-0.05em] text-[var(--ink)]">
              {formatPrice(plan.priceCents)}
            </p>
            <p className="mt-2 font-sans text-sm text-[var(--muted)]">
              {plan.durationMonths} {plan.durationMonths === 1 ? 'mes' : 'meses'} de acceso
            </p>

            <p className="mt-5 text-sm text-[var(--muted)]">{plan.description}</p>

            <ul className="mt-5 space-y-3 text-sm text-[var(--ink)]">
              <li className="flex gap-3">
                <span aria-hidden="true">•</span>
                <span>Acceso a todas las convocatorias disponibles.</span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden="true">•</span>
                <span>Renovación automática: {plan.renewal.toLowerCase()}.</span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden="true">•</span>
                <span>La misma experiencia de estudio en cada modalidad.</span>
              </li>
            </ul>

            <button
              type="button"
              disabled
              aria-disabled="true"
              className="mt-7 inline-flex w-full items-center justify-center rounded-full border border-[var(--line)] bg-[rgba(23,60,58,0.02)] px-4 py-3 font-sans text-sm font-semibold text-[var(--muted)] cursor-not-allowed"
            >
              Contratación pendiente
            </button>
          </article>
        ))}
      </section>

      <section className="mt-10 rounded-[2rem] border border-[var(--line)] bg-[rgba(22,31,29,0.04)] p-6 md:p-8">
        <p className="eyebrow">Información</p>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl text-[var(--muted)]">
            El flujo de contratación y la gestión de la suscripción se integrarán con la especificación de la plataforma y la pasarela de pago. Mientras tanto, estas modalidades se muestran con el importe total del periodo y la renovación automática, sin simular compras.
          </div>
          <Link href="/contacto" className="inline-flex items-center justify-center rounded-full border border-[var(--ink)] px-5 py-3 font-sans text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-white/70">
            Consulta dudas
          </Link>
        </div>
      </section>
    </main>
  );
}
