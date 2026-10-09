import type { Metadata } from 'next';
import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'OposNavarra | Tests para oposiciones', template: '%s | OposNavarra' },
  description: 'Plataforma para practicar tests de oposiciones de Navarra.',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user && user.email_confirmed_at);

  return (
    <html lang="es">
      <body>
        <header className="site-header">
          <Link className="brand" href="/" aria-label="OposNavarra, inicio">
            <span className="brand-mark">ON</span>
            <span>
              opos<span className="brand-accent">navarra</span>
            </span>
          </Link>
          <nav aria-label="Navegación principal">
            {isAuthenticated ? <Link href="/plataforma">Plataforma</Link> : <Link href="/acceder">Acceder</Link>}
          </nav>
        </header>
        {children}
        <footer className="site-footer">OposNavarra · Preparar con sentido</footer>
      </body>
    </html>
  );
}
