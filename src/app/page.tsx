import Link from 'next/link';

import { featuredExamination, formatPrice } from '@/lib/public-content';
import { getPublicPlans } from '@/lib/subscriptions';

export default async function HomePage() {
  const plans = await getPublicPlans();

  return (
    <main>
      <section className="page-shell grid items-center gap-12 py-14 md:py-20 lg:grid-cols-[1fr_0.9fr] lg:gap-16 lg:py-24">
        <div>
          <p className="eyebrow flex items-center gap-3 before:h-px before:w-7 before:bg-[var(--coral)] before:content-['']">
            Tu oposición en Navarra, paso a paso
          </p>
          <h1 className="max-w-2xl font-serif text-5xl font-normal leading-[1.08] tracking-[-0.045em] text-[#292c28] sm:text-6xl lg:text-7xl">
            Estudia con foco.
            <br />
            Practica con <span className="text-[var(--coral)]">sentido.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)] md:text-xl">
            Tests para preparar oposiciones de Navarra. Organiza tu práctica por convocatoria,
            repasa tus resultados y avanza a tu ritmo.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/tests"
              className="inline-flex min-h-14 items-center justify-center gap-4 rounded-md bg-[var(--coral)] px-6 py-3 font-sans text-sm font-semibold text-white transition-colors hover:bg-[#d95d4d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2"
            >
              Encuentra tu oposición
              <span aria-hidden="true" className="text-lg">→</span>
            </Link>
            <Link
              href="/planes"
              className="inline-flex min-h-14 items-center justify-center gap-4 rounded-md border border-[var(--line)] bg-white px-6 py-3 font-sans text-sm font-semibold text-[var(--ink)] transition-colors hover:border-[var(--coral)]"
            >
              Ver planes
              <span aria-hidden="true" className="text-lg text-[var(--coral)]">→</span>
            </Link>
          </div>
          <p className="mt-4 font-sans text-sm text-[var(--muted)]">
            Una suscripción. Todas las convocatorias disponibles.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <div
            aria-hidden="true"
            className="absolute -inset-3 rotate-2 rounded-[1.75rem] bg-[#f0e2dc]"
          />
          <div className="relative rounded-[1.5rem] bg-white p-5 shadow-[0_24px_64px_rgba(38,42,38,0.1)] sm:p-8">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
              <div>
                <p className="font-serif text-2xl font-semibold tracking-tight text-[#292c28]">
                  OposNavarra
                </p>
                <p className="mt-1 font-sans text-xs text-[var(--muted)]">Tu cuaderno de preparación</p>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[#f5f3ed] text-[var(--coral)]" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                  <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
            </div>

            <div className="pt-6">
              <p className="font-sans text-xs font-bold uppercase tracking-[0.13em] text-[var(--coral)]">
                Convocatoria del MVP
              </p>
              <h2 className="mt-2 font-serif text-3xl font-normal leading-tight text-[#292c28] sm:text-4xl">
                {featuredExamination.name}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                Preparación organizada para que puedas centrarte en lo que toca estudiar.
              </p>
            </div>

            <div className="mt-6 rounded-xl bg-[#f7f6f2] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-sans text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                  Área de práctica
                </p>
                <span className="rounded-full bg-[#f0e2dc] px-3 py-1 font-sans text-xs font-semibold text-[#9e4037]">
                  En preparación
                </span>
              </div>
              <p className="mt-3 font-sans text-xs leading-5 text-[var(--muted)]">
                Estamos preparando el espacio para que practiques y revises tus resultados.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {featuredExamination.topics.slice(0, 4).map((topic) => (
                <div
                  key={topic}
                  className="flex min-h-12 items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 font-sans text-xs text-[var(--ink)]"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--coral)]" aria-hidden="true" />
                  {topic}
                </div>
              ))}
            </div>
            <p className="mt-4 text-right font-sans text-xs text-[var(--muted)]">
              Vista ilustrativa · no representa un test activo
            </p>
          </div>
        </div>
      </section>

      <section aria-label="Ventajas" className="border-y border-[var(--line)] bg-[#f0efe8]">
        <div className="page-shell grid gap-6 py-6 md:grid-cols-3 md:gap-8 md:py-7">
          <div className="flex items-center gap-4">
            <span className="text-2xl text-[var(--coral)]" aria-hidden="true">⌖</span>
            <div>
              <h2 className="font-sans text-sm font-semibold text-[#292c28]">El foco, en Navarra</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Contenido organizado por convocatoria.</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-2xl text-[var(--coral)]" aria-hidden="true">▤</span>
            <div>
              <h2 className="font-sans text-sm font-semibold text-[#292c28]">Una preparación clara</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Practica, revisa y vuelve a tus temas.</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-2xl text-[var(--coral)]" aria-hidden="true">◷</span>
            <div>
              <h2 className="font-sans text-sm font-semibold text-[#292c28]">A tu ritmo</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Sin límite de tiempo en esta primera versión.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell py-16 md:py-24">
        <div className="max-w-3xl">
          <p className="eyebrow">01 / Encuentra tu camino</p>
          <h2 className="font-serif text-4xl font-normal leading-tight tracking-[-0.04em] text-[#292c28] md:text-5xl">
            Tu oposición tiene su sitio.
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-7 text-[var(--muted)]">
            Empieza por la convocatoria que estás preparando y consulta los temas que incluye.
            La suscripción da acceso al catálogo completo disponible.
          </p>
        </div>

        <article className="mt-9 grid gap-6 rounded-2xl border border-[var(--line)] bg-white p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#f7f6f2] text-[var(--coral)]" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                  <path d="M5 4.75A2.75 2.75 0 0 1 7.75 2H20v17H7.75A2.75 2.75 0 0 0 5 21.75v-17Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M5 5v16.75M9 7h7m-7 4h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              <p className="eyebrow mb-0">Administración</p>
            </div>
            <h3 className="mt-4 font-serif text-3xl font-normal text-[#292c28]">
              {featuredExamination.name}
            </h3>
            <p className="mt-2 max-w-2xl leading-6 text-[var(--muted)]">
              {featuredExamination.summary}
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {featuredExamination.topics.map((topic) => (
                <li key={topic} className="rounded-full bg-[#f5f3ed] px-3 py-1.5 font-sans text-xs text-[var(--muted)]">
                  {topic}
                </li>
              ))}
            </ul>
          </div>
          <Link
            href="/tests"
            className="inline-flex min-h-12 items-center justify-center gap-3 rounded-md border border-[var(--line)] px-5 py-3 font-sans text-sm font-semibold text-[var(--ink)] transition-colors hover:border-[var(--coral)]"
          >
            Ver convocatoria
            <span aria-hidden="true" className="text-lg text-[var(--coral)]">→</span>
          </Link>
        </article>
      </section>

      <section className="bg-[#292f2b] text-white">
        <div className="page-shell grid gap-10 py-16 md:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <p className="eyebrow !text-[#f28a7c]">02 / Un método sencillo</p>
            <h2 className="font-serif text-4xl font-normal leading-tight tracking-[-0.04em] md:text-5xl">
              Menos vueltas.
              <br />
              Más práctica.
            </h2>
            <p className="mt-5 max-w-md leading-7 text-white/70">
              La plataforma está en preparación. Este es el camino de estudio que estamos
              construyendo para ti.
            </p>
            <Link
              href="/tests"
              className="mt-7 inline-flex items-center gap-3 font-sans text-sm font-semibold text-white hover:text-[#f28a7c]"
            >
              Explorar la convocatoria
              <span aria-hidden="true" className="text-lg">→</span>
            </Link>
          </div>
          <ol className="grid gap-7 sm:grid-cols-3">
            {[
              {
                number: '01',
                title: 'Elige qué preparar',
                description: 'Consulta la convocatoria y conoce los temas incluidos.',
              },
              {
                number: '02',
                title: 'Practica a tu manera',
                description: 'Configura tests por temas y el número de preguntas.',
              },
              {
                number: '03',
                title: 'Revisa y vuelve al tema',
                description: 'Consulta tus resultados y retoma las preguntas que quieras repasar.',
              },
            ].map((step) => (
              <li key={step.number} className="border-t border-white/20 pt-5">
                <p className="font-serif text-4xl text-[#f28a7c]">{step.number}</p>
                <h3 className="mt-5 font-sans text-base font-semibold">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/65">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="page-shell py-16 md:py-24">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">03 / Una suscripción global</p>
            <h2 className="font-serif text-4xl font-normal leading-tight tracking-[-0.04em] text-[#292c28] md:text-5xl">
              Un plan que encaja contigo.
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-7 text-[var(--muted)]">
              Todas las modalidades incluyen el mismo acceso a las convocatorias disponibles.
            </p>
          </div>
          <Link href="/planes" className="font-sans text-sm font-semibold text-[var(--coral)] hover:underline">
            Comparar modalidades <span aria-hidden="true">→</span>
          </Link>
        </div>

        {plans.length > 0 ? (
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <article key={plan.code} className="rounded-xl border border-[var(--line)] bg-white p-6">
                <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[var(--coral)]">
                  {plan.name}
                </p>
                <p className="mt-4 font-sans text-3xl font-semibold tracking-tight text-[#292c28]">
                  {formatPrice(plan.priceCents)}
                </p>
                <p className="mt-1 font-sans text-sm text-[var(--muted)]">
                  {plan.durationMonths} {plan.durationMonths === 1 ? 'mes' : 'meses'} · pago por periodo
                </p>
                <p className="mt-4 border-t border-[var(--line)] pt-4 text-sm leading-6 text-[var(--muted)]">
                  Acceso a todas las convocatorias disponibles. Renovación {plan.renewal.toLowerCase()}.
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-8 rounded-xl border border-[var(--line)] bg-white p-6 text-[var(--muted)]">
            Las modalidades no están disponibles en este momento. Puedes consultar la información
            de planes más adelante.
          </p>
        )}

        <div className="mt-8 flex flex-col items-start justify-between gap-5 rounded-2xl bg-[#f0e2dc] p-6 sm:flex-row sm:items-center sm:p-8">
          <div>
            <h3 className="font-serif text-2xl font-normal text-[#292c28]">
              Empieza por conocer tu convocatoria.
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Sin elegir una convocatoria para contratar: todas se incluyen en la suscripción.
            </p>
          </div>
          <Link
            href="/planes"
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-3 rounded-md bg-[var(--coral)] px-5 py-3 font-sans text-sm font-semibold text-white transition-colors hover:bg-[#d95d4d]"
          >
            Ver planes
            <span aria-hidden="true" className="text-lg">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
