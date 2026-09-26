import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'OposNavarra | Tests para oposiciones', template: '%s | OposNavarra' },
  description: 'Plataforma para practicar tests de oposiciones de Navarra.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <header className="site-header">
          <Link className="brand" href="/" aria-label="OposNavarra, inicio">
            <span className="brand-mark">ON</span>
            <span>opos<span className="brand-accent">navarra</span></span>
          </Link>
          <nav aria-label="Navegación principal">
            <Link href="/acceder">Acceder</Link>
          </nav>
        </header>
        {children}
        <footer className="site-footer">OposNavarra · Preparar con sentido</footer>
      </body>
    </html>
  );
}
