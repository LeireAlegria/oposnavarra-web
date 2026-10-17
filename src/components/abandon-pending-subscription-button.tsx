'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AbandonPendingSubscriptionButton() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function abandon() {
    if (isSubmitting || !window.confirm('¿Quieres abandonar esta selección de plan?')) return;
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'abandon' }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setErrorMessage(result.message ?? 'No se pudo abandonar la selección.');
        return;
      }
      router.refresh();
    } catch {
      setErrorMessage('No se pudo abandonar la selección. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={abandon}
        disabled={isSubmitting}
        className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--ink)] px-5 py-3 font-sans text-sm font-semibold text-[var(--ink)] hover:bg-white/70 disabled:opacity-60"
      >
        {isSubmitting ? 'Abandonando…' : 'Abandonar selección'}
      </button>
      {errorMessage ? <p role="alert" className="mt-3 text-sm text-[var(--coral)]">{errorMessage}</p> : null}
    </div>
  );
}
