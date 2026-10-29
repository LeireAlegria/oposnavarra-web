'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { DemoTrackedLink } from '@/components/demo-measurement';

const navigation = [
  { href: '/#como-funciona', label: 'Cómo funciona' },
  { href: '/tests', label: 'Temario' },
  { href: '/planes', label: 'Planes' },
  { href: '/contacto', label: 'Contacto' },
];

function isCurrentPath(currentPath: string, href: string) {
  if (href === '/') {
    return currentPath === '/';
  }

  return currentPath.startsWith(href);
}

export function SiteHeader({ isAuthenticated }: { isAuthenticated: boolean }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const accessHref = isAuthenticated ? '/plataforma' : '/acceder';

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[rgba(247,244,235,0.94)] backdrop-blur-sm">
      <div className="page-shell flex items-center justify-between gap-4 py-4">
        <Link
          href="/"
          className="inline-flex items-center gap-3 font-sans text-lg font-bold tracking-tight text-[var(--ink)]"
          aria-label="OposNavarra, inicio"
        >
          <span className="hidden h-9 w-9 place-items-center rounded-full bg-[var(--ink)] text-xs text-[var(--cream)] sm:grid">
            ON
          </span>
          <span>
            opos<span className="text-[var(--coral)]">navarra</span>
          </span>
        </Link>

        <nav aria-label="Navegación principal" className="hidden items-center gap-6 xl:flex">
          {navigation.map((item) => {
            const current = isCurrentPath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current ? 'page' : undefined}
                className={[
                  'font-sans text-sm font-medium transition-colors',
                  current ? 'text-[var(--coral)]' : 'text-[var(--muted)] hover:text-[var(--coral)]',
                ].join(' ')}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href={accessHref}
            className="hidden font-sans text-sm font-semibold underline md:inline-flex"
          >
            {isAuthenticated ? 'Mi cuenta' : 'Iniciar sesión'}
          </Link>

          <DemoTrackedLink
            href="/prueba-gratis"
            location="header"
            className="inline-flex min-h-11 items-center rounded-full bg-[#b94235] px-4 py-2 text-sm font-semibold text-white"
          >
            Probar gratis
          </DemoTrackedLink>

          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full border border-[var(--line)] p-2 text-[var(--ink)] xl:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span className="sr-only">Menú</span>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-5 w-5">
              <path
                d="M3 5h14M3 10h14M3 15h14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav
          id="mobile-navigation"
          aria-label="Navegación móvil"
          className="page-shell border-t border-[var(--line)] py-4 xl:hidden"
        >
          <ul className="flex flex-col gap-3">
            <li>
              <Link
                href={accessHref}
                className="block px-3 py-2 underline"
                onClick={() => setMenuOpen(false)}
              >
                {isAuthenticated ? 'Mi cuenta' : 'Iniciar sesión'}
              </Link>
            </li>
            {navigation.map((item) => {
              const current = isCurrentPath(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? 'page' : undefined}
                    className={[
                      'block rounded-xl px-3 py-2 font-sans text-sm font-medium',
                      current
                        ? 'bg-[rgba(243,111,94,0.08)] text-[var(--coral)]'
                        : 'text-[var(--ink)] hover:bg-white/60',
                    ].join(' ')}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
