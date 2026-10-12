import type { Metadata } from 'next';

import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { createClient } from '@/lib/supabase/server';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'OposNavarra | Tests para oposiciones', template: '%s | OposNavarra' },
  description: 'Plataforma para preparar oposiciones de Navarra con tests, seguimiento y suscripción global.',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user && user.email_confirmed_at);

  return (
    <html lang="es">
      <body className="min-h-screen bg-[var(--cream)] text-[var(--ink)] antialiased">
        <div className="flex min-h-screen flex-col">
          <SiteHeader isAuthenticated={isAuthenticated} />
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
