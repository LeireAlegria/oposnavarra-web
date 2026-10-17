'use client';

import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';

export function StripePortalButton() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function openPortal() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: {},
      });
      if (error || typeof data?.url !== 'string' || !data.url.startsWith('https://billing.stripe.com/')) {
        setErrorMessage('No se pudo abrir la gestión de pagos. Vuelve a intentarlo.');
        return;
      }
      window.location.assign(data.url);
    } catch {
      setErrorMessage('No se pudo abrir la gestión de pagos. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={openPortal}
        disabled={isSubmitting}
        className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--ink)] px-5 py-3 font-sans text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-white/70 disabled:cursor-wait disabled:opacity-60"
      >
        {isSubmitting ? 'Abriendo…' : 'Gestionar suscripción y facturas'}
      </button>
      {errorMessage ? <p role="alert" className="mt-3 text-sm text-[var(--coral)]">{errorMessage}</p> : null}
    </div>
  );
}
