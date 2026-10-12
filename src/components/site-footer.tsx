import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--line)] bg-[rgba(255,255,255,0.35)]">
      <div className="page-shell flex flex-col gap-4 py-8 text-sm text-[var(--muted)] md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-sans font-semibold text-[var(--ink)]">OposNavarra</p>
          <p>Preparar con sentido y sin fricción.</p>
        </div>

        <nav aria-label="Navegación secundaria" className="flex flex-wrap items-center gap-4 font-sans">
          <Link href="/" className="hover:text-[var(--coral)]">Inicio</Link>
          <Link href="/tests" className="hover:text-[var(--coral)]">Tests disponibles</Link>
          <Link href="/planes" className="hover:text-[var(--coral)]">Planes</Link>
          <Link href="/contacto" className="hover:text-[var(--coral)]">Contacto</Link>
          <Link href="/politica-privacidad" className="hover:text-[var(--coral)]">Política de privacidad</Link>
          <Link href="/aviso-legal" className="hover:text-[var(--coral)]">Aviso legal</Link>
        </nav>
      </div>
    </footer>
  );
}
