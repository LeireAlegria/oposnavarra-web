import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Preparación con rumbo</p>
          <h1 id="hero-title">Cada test te acerca a tu plaza.</h1>
          <p className="hero-text">
            OposNavarra será tu espacio para practicar tests de oposiciones de Navarra,
            revisar tus avances y estudiar con criterio.
          </p>
          <Link className="button" href="/acceder">Acceder <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="hero-panel" aria-label="Resumen de la plataforma">
          <span className="panel-kicker">Tu preparación</span>
          <strong>En marcha</strong>
          <div className="panel-line"><span /></div>
          <span className="panel-note">Una base clara para empezar</span>
        </div>
      </section>
      <section className="route-strip" aria-label="Áreas de la plataforma">
        <Link href="/app"><span>01</span><strong>Área del opositor</strong><small>Próximamente</small></Link>
        <Link href="/admin"><span>02</span><strong>Administración</strong><small>Próximamente</small></Link>
      </section>
    </main>
  );
}
