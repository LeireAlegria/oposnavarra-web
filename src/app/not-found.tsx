import Link from 'next/link';

import { SiteFrame } from '@/components/site-frame';

export default function NotFound() {
  return (
    <SiteFrame>
      <main className="status-page">
        <p className="eyebrow">404</p>
        <h1>Esta página no existe.</h1>
        <p>Puede que el enlace haya cambiado o esté escrito de otra forma.</p>
        <Link className="button" href="/">
          Volver al inicio <span aria-hidden="true">↗</span>
        </Link>
      </main>
    </SiteFrame>
  );
}
