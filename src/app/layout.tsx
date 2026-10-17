import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: { default: 'OposNavarra | Tests para oposiciones', template: '%s | OposNavarra' },
  description: 'Plataforma para preparar oposiciones de Navarra con tests, seguimiento y suscripción global.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-[var(--cream)] text-[var(--ink)] antialiased">
        {children}
      </body>
    </html>
  );
}
