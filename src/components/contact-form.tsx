'use client';

import { useState } from 'react';

type FormValues = {
  name: string;
  email: string;
  message: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const initialValues: FormValues = { name: '', email: '', message: '' };

export function ContactForm() {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error' | null>(null);

  const handleChange = (field: keyof FormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (statusMessage) {
      setStatusMessage(null);
      setStatusType(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);
    setStatusType(null);

    const trimmedValues = {
      name: values.name.trim(),
      email: values.email.trim(),
      message: values.message.trim(),
    };

    const nextErrors: FormErrors = {};

    if (trimmedValues.name.length < 1 || trimmedValues.name.length > 100) {
      nextErrors.name = 'El nombre debe tener entre 1 y 100 caracteres.';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValues.email) || trimmedValues.email.length > 254) {
      nextErrors.email = 'Introduce un correo electrónico válido.';
    }

    if (trimmedValues.message.length < 10 || trimmedValues.message.length > 5000) {
      nextErrors.message = 'El mensaje debe tener entre 10 y 5.000 caracteres.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...trimmedValues, honeypot: '' }),
      });

      const data = (await response.json()) as { message?: string; errors?: Record<string, string> };

      if (!response.ok) {
        const issueMessage = data.message ?? 'No se pudo enviar tu consulta. Inténtalo de nuevo.';
        const serverErrors = data.errors ?? {};

        setErrors((current) => ({
          ...current,
          ...Object.fromEntries(
            Object.entries(serverErrors).map(([field, value]) => [field, value]),
          ),
        }));
        setStatusType('error');
        setStatusMessage(issueMessage);
        setIsSubmitting(false);
        return;
      }

      setValues(initialValues);
      setErrors({});
      setStatusType('success');
      setStatusMessage(data.message ?? 'Tu consulta se ha enviado correctamente.');
    } catch {
      setStatusType('error');
      setStatusMessage('No se pudo enviar tu mensaje en este momento. Inténtalo más tarde.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      <div className="hidden">
        <label htmlFor="website">Si ves esto, ignóralo</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div>
        <label htmlFor="name" className="mb-2 block font-sans text-sm font-medium text-[var(--ink)]">
          Nombre
        </label>
        <input
          id="name"
          type="text"
          value={values.name}
          onChange={(event) => handleChange('name', event.target.value)}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'name-error' : undefined}
          className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-base text-[var(--ink)] outline-none transition-colors focus:border-[var(--coral)] focus:ring-2 focus:ring-[rgba(243,111,94,0.2)]"
          maxLength={100}
        />
        {errors.name ? (
          <p id="name-error" className="mt-2 text-sm text-red-700">{errors.name}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="email" className="mb-2 block font-sans text-sm font-medium text-[var(--ink)]">
          Correo electrónico
        </label>
        <input
          id="email"
          type="email"
          value={values.email}
          onChange={(event) => handleChange('email', event.target.value)}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-base text-[var(--ink)] outline-none transition-colors focus:border-[var(--coral)] focus:ring-2 focus:ring-[rgba(243,111,94,0.2)]"
          maxLength={254}
        />
        {errors.email ? (
          <p id="email-error" className="mt-2 text-sm text-red-700">{errors.email}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="message" className="mb-2 block font-sans text-sm font-medium text-[var(--ink)]">
          Mensaje
        </label>
        <textarea
          id="message"
          rows={6}
          value={values.message}
          onChange={(event) => handleChange('message', event.target.value)}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? 'message-error' : undefined}
          className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-base text-[var(--ink)] outline-none transition-colors focus:border-[var(--coral)] focus:ring-2 focus:ring-[rgba(243,111,94,0.2)]"
          maxLength={5000}
        />
        {errors.message ? (
          <p id="message-error" className="mt-2 text-sm text-red-700">{errors.message}</p>
        ) : null}
      </div>

      <p className="text-sm text-[var(--muted)]">
        Se usará para responder a tu consulta y gestionar la comunicación relacionada con el producto. Consulta nuestra{' '}
        <a href="/politica-privacidad" className="font-medium text-[var(--coral)] underline underline-offset-2">
          política de privacidad
        </a>.
      </p>

      {statusMessage ? (
        <div
          role="status"
          aria-live="polite"
          className={[
            'rounded-xl border px-4 py-3 text-sm',
            statusType === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-800',
          ].join(' ')}
        >
          {statusMessage}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center rounded-full bg-[var(--coral)] px-5 py-3 font-sans text-sm font-bold text-white transition-colors hover:bg-[#d95d4d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Enviando...' : 'Enviar consulta'}
      </button>
    </form>
  );
}
