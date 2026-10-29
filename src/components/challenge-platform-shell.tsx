'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';

const sections = [
  { href: '/mi-camino', label: 'Mi camino', icon: '◇' },
  { href: '/retos', label: 'Retos compartidos', icon: '⚑' },
  { href: '/plataforma?section=crear', label: 'Test por temas', icon: '＋' },
  { href: '/plataforma?section=oficiales', label: 'Test oficiales', icon: '★' },
  { href: '/plataforma?section=curso', label: 'Test en curso', icon: '☷' },
  { href: '/plataforma?section=resultados', label: 'Historial de tests', icon: '▥' },
];

export function ChallengePlatformShell({
  children,
  activeArea = 'retos',
}: {
  children: ReactNode;
  activeArea?: 'retos' | 'camino';
}) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const activeHref = activeArea === 'camino' ? '/mi-camino' : '/retos';
  return (
    <main className="student-platform-shell min-h-screen bg-[#f8f7f3] text-[#302f2b]">
      <header className="flex min-h-16 items-center justify-between border-b border-[var(--line)] bg-white px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-expanded={navigationOpen}
            aria-controls="challenge-platform-navigation"
            onClick={() => setNavigationOpen((open) => !open)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--line)] text-lg lg:hidden"
          >
            <span className="sr-only">
              {navigationOpen ? 'Cerrar navegación' : 'Abrir navegación'}
            </span>
            <span aria-hidden="true">{navigationOpen ? '×' : '☰'}</span>
          </button>
          <Link href="/plataforma" className="font-serif text-xl font-semibold tracking-tight">
            OposNavarra
          </Link>
          <span className="hidden border-l border-[var(--line)] pl-3 text-sm text-[var(--muted)] sm:inline">
            Espacio de estudio
          </span>
        </div>
        <Link
          href="/plataforma"
          className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium hover:bg-[#f8f7f3]"
        >
          Mi plataforma
        </Link>
      </header>
      <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside
          id="challenge-platform-navigation"
          className={`flex-col border-b border-[var(--line)] bg-[#f2f1eb] p-4 lg:flex lg:border-b-0 lg:border-r lg:p-6 ${navigationOpen ? 'flex' : 'hidden'}`}
        >
          <div className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              Espacio de estudio
            </p>
            <p className="mt-2 font-sans text-sm font-semibold">
              {activeArea === 'camino' ? 'Mi camino' : 'Retos'}
            </p>
          </div>
          <nav aria-label="Navegación de la plataforma" className="mt-5 grid gap-1">
            <p className="mb-2 px-3 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              Apartados
            </p>
            {sections.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                aria-current={section.href === activeHref ? 'page' : undefined}
                onClick={() => setNavigationOpen(false)}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-left font-sans text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd3734] ${section.href === activeHref ? 'bg-[#fbefec] font-semibold text-[#bd3734]' : 'text-[var(--muted)] hover:bg-white'}`}
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  {section.icon}
                </span>
                {section.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto hidden pt-8 text-xs leading-5 text-[var(--muted)] lg:block">
            <p className="font-medium text-[#302f2b]">Un test. Un paso más.</p>
            <p className="mt-2">
              Avanza pregunta a pregunta y revisa tu progreso cuando lo necesites.
            </p>
          </div>
        </aside>
        <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <p className="mb-7 text-xs text-[var(--muted)]">
            Mi espacio <span className="mx-2">/</span>{' '}
            {activeArea === 'camino' ? 'Mi camino' : 'Retos compartidos'}
          </p>
          {children}
        </div>
      </div>
    </main>
  );
}
