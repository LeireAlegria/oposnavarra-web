import Link from 'next/link';

import { featuredExamination } from '@/lib/public-content';

export const metadata = {
  title: 'Tests disponibles',
  description: 'Consulta la convocatoria disponible y el contenido incluido en la suscripción global de OposNavarra.',
};

export default function AvailableTestsPage() {
  return (
    <main className="page-shell py-10 md:py-14">
      <section className="mb-8 max-w-3xl">
        <p className="eyebrow">Catálogo disponible</p>
        <h1 className="text-4xl font-normal tracking-[-0.06em] text-[var(--ink)] md:text-6xl">
          Tests disponibles
        </h1>
        <p className="mt-5 text-lg text-[var(--muted)]">
          La suscripción global incluye todas las convocatorias publicadas para practicar. En el MVP
          se presenta una sola convocatoria: {featuredExamination.name}.
        </p>
      </section>

      <section className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-6 shadow-[0_26px_70px_rgba(23,60,58,0.04)] sm:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[var(--coral)]">
              {featuredExamination.status}
            </p>
            <h2 className="mt-2 text-3xl font-normal tracking-[-0.05em] text-[var(--ink)]">
              {featuredExamination.name}
            </h2>
          </div>
          <Link href="/planes" className="inline-flex items-center justify-center rounded-full bg-[var(--coral)] px-5 py-3 font-sans text-sm font-semibold text-white transition-colors hover:bg-[#d95d4d]">
            Ver planes
          </Link>
        </div>

        <p className="mt-6 max-w-2xl text-[var(--muted)]">{featuredExamination.summary}</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h3 className="text-xl font-semibold text-[var(--ink)]">Temas incluidos</h3>
            <ul className="mt-4 space-y-3">
              {featuredExamination.topics.map((topic) => (
                <li key={topic} className="flex items-center gap-3 text-[var(--muted)]">
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[var(--coral)]" aria-hidden="true" />
                  <span>{topic}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[rgba(243,111,94,0.05)] p-5">
            <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[var(--coral)]">
              Estado del contenido
            </p>
            <p className="mt-3 text-lg font-medium text-[var(--ink)]">{featuredExamination.status}</p>
            <p className="mt-4 text-sm text-[var(--muted)]">
              La disponibilidad del contenido se declara explícitamente. Una convocatoria en preparación no se anuncia como accesible para practicar.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
