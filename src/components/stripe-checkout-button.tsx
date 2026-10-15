'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';

type StripeCheckoutButtonProps = {
  planId: string;
};

async function getFunctionErrorMessage(error: { context?: unknown }): Promise<string> {
  if (error.context instanceof Response) {
    try {
      const body = (await error.context.json()) as { message?: string };
      if (body.message === 'Verifica tu correo antes de contratar.') return body.message;
      if (body.message === 'Inicia sesión para contratar.') return body.message;
      if (body.message === 'Ya se completó este pago. Estamos confirmando el resultado; no inicies otra contratación.') {
        return body.message;
      }
    } catch {
      return 'No se pudo iniciar el pago. Actualiza la página e inténtalo de nuevo.';
    }
  }
  return 'No se pudo iniciar el pago. Actualiza la página e inténtalo de nuevo.';
}

export function StripeCheckoutButton({ planId }: StripeCheckoutButtonProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function startCheckout() {
    if (isSubmitting) return;
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const next = `/contratar?plan=${encodeURIComponent(planId)}`;
      if (!data.user) {
        router.push(`/acceder?next=${encodeURIComponent(next)}`);
        return;
      }
      if (!data.user.email_confirmed_at) {
        router.push(
          `/verificar-correo?email=${encodeURIComponent(data.user.email ?? '')}&next=${encodeURIComponent(next)}`,
        );
        return;
      }

      const { data: result, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { planId },
      });
      if (error) {
        setErrorMessage(await getFunctionErrorMessage(error));
        return;
      }
      if (typeof result?.url !== 'string' || !result.url.startsWith('https://checkout.stripe.com/')) {
        setErrorMessage('Stripe no devolvió una dirección de pago válida. Inténtalo de nuevo.');
        return;
      }
      window.location.assign(result.url);
    } catch {
      setErrorMessage('No se pudo iniciar el pago. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={startCheckout}
        disabled={isSubmitting}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--coral)] px-5 py-3 font-sans text-sm font-semibold text-white transition-colors hover:bg-[#d95d4d] disabled:cursor-wait disabled:opacity-60"
      >
        {isSubmitting ? 'Conectando con Stripe…' : 'Continuar al pago seguro'}
      </button>
      {errorMessage ? (
        <p role="alert" className="mt-3 text-sm text-[var(--coral)]">
          {errorMessage}
        </p>
      ) : null}
      <p className="mt-3 text-center font-sans text-xs text-[var(--muted)]">
        El pago se completa en Stripe. No guardamos datos de tarjeta.
      </p>
    </div>
  );
}
