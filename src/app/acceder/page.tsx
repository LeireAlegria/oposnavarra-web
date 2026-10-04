import Link from 'next/link';

export const metadata = { title: 'Acceder' };

export default function AccessPage() {
  return (
    <main className="status-page">
      <p className="eyebrow">Acceso</p>
      <h1>Estamos preparando tu entrada.</h1>
      <p>
        El inicio de sesión llegará en una próxima fase. Todavía no hay cuentas ni formularios
        activos.
      </p>
      <Link className="button" href="/">
        Volver al inicio <span aria-hidden="true">↗</span>
      </Link>
    </main>
  );
}
