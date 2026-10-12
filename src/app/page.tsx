import Link from 'next/link';

import { featuredExamination, formatPrice, homeFeatures, subscriptionPlans } from '@/lib/public-content';

export default function HomePage() {
  const mainPlan = subscriptionPlans[0];

  return (
    <main className="page-shell py-10 md:py-14">
      <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
        <div>
          <p className="eyebrow">Plataforma de preparación</p>
          <h1 className="max-w-xl text-5xl font-normal tracking-[-0.06em] text-[var(--ink)] md:text-7xl">
            Prepárate para tu convocatoria con OposNavarra.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-[var(--muted)]">
            Aquí encontrarás la práctica, la revisión y la orientación necesarias para estudiar con
            criterio antes de cada examen.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/tests" className="inline-flex items-center justify-center rounded-full bg-[var(--coral)] px-5 py-3 font-sans text-sm font-semibold text-white transition-colors hover:bg-[#d95d4d]">
              Ver tests disponibles
            </Link>
            <Link href="/planes" className="inline-flex items-center justify-center rounded-full border border-[var(--ink)] px-5 py-3 font-sans text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-white/60">
              Ver planes
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-[var(--line)] bg-white/60 p-6 shadow-[0_26px_70px_rgba(23,60,58,0.08)]">
          <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[var(--coral)]">
            Convocatoria disponible
          </p>
          <h2 className="mt-3 text-3xl font-normal tracking-[-0.05em] text-[var(--ink)]">
            {featuredExamination.name}
          </h2>
          <p className="mt-4 text-[var(--muted)]">{featuredExamination.summary}</p>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-[rgba(243,111,94,0.06)] px-3 py-2 text-sm">
              <span className="font-sans text-[var(--muted)]">Estado</span>
              <span className="font-sans font-semibold text-[var(--ink)]">{featuredExamination.status}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[rgba(22,31,29,0.03)] px-3 py-2 text-sm">
              <span className="font-sans text-[var(--muted)]">Suscripción</span>
              <span className="font-sans font-semibold text-[var(--ink)]">Global</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[rgba(22,31,29,0.03)] px-3 py-2 text-sm">
              <span className="font-sans text-[var(--muted)]">Desde</span>
              <span className="font-sans font-semibold text-[var(--ink)]">{featuredExamination.availableFrom ?? 'MVP'}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-16 rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.45)] p-6 md:p-8">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Qué resuelve</p>
            <h2 className="text-3xl font-normal tracking-[-0.05em] text-[var(--ink)]">
              Practicar con claridad y estudiar de forma orientada.
            </h2>
          </div>
          <p className="max-w-xl text-[var(--muted)]">
            La plataforma está diseñada para ayudarte a repasar temas, configurar tests y valorar tus
            resultados antes de cada convocatoria.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {homeFeatures.map((feature) => (
            <div key={feature} className="rounded-2xl border border-[var(--line)] bg-white/70 p-5">
              <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--yellow)] font-sans text-sm font-bold text-[var(--ink)]">
                ✓
              </span>
              <p className="text-base text-[var(--ink)]">{feature}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] border border-[var(--line)] bg-[rgba(22,31,29,0.04)] p-6 md:p-8">
          <p className="eyebrow">MVP</p>
          <h2 className="text-3xl font-normal tracking-[-0.05em] text-[var(--ink)]">
            Convocatoria incluida en la suscripción
          </h2>
          <p className="mt-4 text-[var(--muted)]">
            En esta primera etapa, la oferta comercial se centra en una convocatoria concreta: {featuredExamination.name}. La suscripción da acceso a todas las convocatorias disponibles y a las que se incorporen durante su vigencia.
          </p>
        </div>

        <div className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-6 md:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Suscripción</p>
              <h2 className="text-3xl font-normal tracking-[-0.05em] text-[var(--ink)]">
                {mainPlan.name}
              </h2>
            </div>
            <div className="text-right">
              <p className="text-3xl font-semibold text-[var(--ink)]">{formatPrice(mainPlan.priceCents)}</p>
              <p className="font-sans text-sm text-[var(--muted)]">por {mainPlan.durationMonths} {mainPlan.durationMonths === 1 ? 'mes' : 'meses'}</p>
            </div>
          </div>
          <p className="mt-6 text-[var(--muted)]">
            Todas las modalidades ofrecen el mismo acceso a todas las convocatorias disponibles y una renovación automática al finalizar el periodo contratado.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/planes" className="inline-flex items-center justify-center rounded-full bg-[var(--coral)] px-5 py-3 font-sans text-sm font-semibold text-white transition-colors hover:bg-[#d95d4d]">
              Ver planes
            </Link>
            <Link href="/tests" className="inline-flex items-center justify-center rounded-full border border-[var(--line)] px-5 py-3 font-sans text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[rgba(23,60,58,0.04)]">
              Ver tests disponibles
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
