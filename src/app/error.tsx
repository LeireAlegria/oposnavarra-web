'use client';

import Link from 'next/link';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="status-page">
      <p className="eyebrow">Algo no ha salido bien</p>
      <h1>No hemos podido cargar esta sección.</h1>
      <p>Puedes intentarlo de nuevo o volver al inicio.</p>
      <div className="status-actions">
        <button className="button" onClick={reset}>
          Reintentar
        </button>
        <Link className="button secondary-button" href="/">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
