'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

type CheckoutConfirmationProps = {
  sessionId: string | null;
};

type CurrentSubscription = {
  estado: string;
  periodo_inicio: string | null;
  periodo_fin: string | null;
  stripe_subscription_id: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(new Date(value));
}

export function CheckoutConfirmation({ sessionId }: CheckoutConfirmationProps) {
  const [subscription, setSubscription] = useState<CurrentSubscription | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const supabase = createClient();
    let attempts = 0;

    async function checkStatus() {
      const { data, error } = await supabase.rpc('consultar_mi_suscripcion');
      if (cancelled) return;
      if (error) {
        setErrorMessage('No se pudo consultar el estado del pago. Puedes volver a intentarlo o revisar tu cuenta.');
        setIsChecking(false);
        return;
      }
      const row = data as CurrentSubscription | null;
      if (
        row?.estado === 'activa' &&
        row.periodo_inicio &&
        row.periodo_fin &&
        new Date(row.periodo_inicio).getTime() <= Date.now() &&
        new Date(row.periodo_fin).getTime() > Date.now()
      ) {
        setSubscription(row);
        setIsChecking(false);
        return;
      }
      attempts += 1;
      if (attempts < 12) {
        timer = setTimeout(checkStatus, 5000);
      } else {
        setIsChecking(false);
      }
    }

    if (!sessionId) {
      setErrorMessage('No se ha recibido una referencia de Checkout válida.');
      setIsChecking(false);
      return;
    }
    void checkStatus();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [refreshCount, sessionId]);

  return (
    <main className="page-shell py-12 md:py-20">
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-[var(--line)] bg-white/90 p-6 shadow-[0_26px_70px_rgba(23,60,58,0.06)] md:p-10">
        <p className="eyebrow">Confirmación del pago</p>
        <h1 className="mt-3 text-4xl font-normal tracking-[-0.06em] text-[var(--ink)] md:text-5xl">
          {subscription ? 'Suscripción confirmada' : 'Estamos confirmando tu pago'}
        </h1>

        {subscription ? (
          <>
            <p className="mt-5 text-[var(--muted)]">
              Stripe ha confirmado el pago. Tu acceso está disponible hasta el {formatDate(subscription.periodo_fin!)}.
            </p>
            <Link
              href="/plataforma"
              className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--coral)] px-5 py-3 font-sans text-sm font-semibold text-white hover:bg-[#d95d4d]"
            >
              Ir a mi cuenta
            </Link>
          </>
        ) : (
          <>
            <p className="mt-5 text-[var(--muted)]">
              La confirmación puede tardar unos instantes. No vuelvas a pagar: el acceso solo se activa cuando Stripe confirma la factura.
            </p>
            {errorMessage ? <p role="alert" className="mt-4 text-sm text-[var(--coral)]">{errorMessage}</p> : null}
            {isChecking ? <p aria-live="polite" className="mt-5 font-sans text-sm text-[var(--muted)]">Consultando el estado…</p> : null}
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsChecking(true);
                  setErrorMessage('');
                  setRefreshCount((count) => count + 1);
                }}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--coral)] px-5 py-3 font-sans text-sm font-semibold text-white hover:bg-[#d95d4d]"
              >
                Actualizar estado
              </button>
              <Link
                href="/plataforma"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--ink)] px-5 py-3 font-sans text-sm font-semibold text-[var(--ink)] hover:bg-white/70"
              >
                Volver a mi cuenta
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
