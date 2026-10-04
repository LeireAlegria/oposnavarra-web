import Link from 'next/link';

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <main className="status-page">
      <p className="eyebrow">Próximamente</p>
      <h1>{title}</h1>
      <p>{description}</p>
      <Link className="button" href="/">
        Volver al inicio <span aria-hidden="true">↗</span>
      </Link>
    </main>
  );
}
