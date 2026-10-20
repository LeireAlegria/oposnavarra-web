'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';

import { requestPasswordReset } from '@/lib/auth';

export default function RecoverPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!email) {
      setError('Introduce tu correo electrónico.');
      return;
    }

    setIsSubmitting(true);
    const result = await requestPasswordReset(email);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setSuccess('Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.');
  }

  return (
    <main className="status-page">
      <div className="auth-shell">
        <p className="eyebrow">Recuperación</p>
        <h1>Recuperar contraseña</h1>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <label className="auth-field">
            <span>Correo electrónico</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="auth-input"
              placeholder="tu@correo.es"
            />
          </label>

          <button type="submit" className="form-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Enviando...' : 'Enviar enlace'}
          </button>
        </form>

        <div className="auth-links">
          <Link href="/acceder">Volver al acceso</Link>
        </div>

        {error ? <p className="form-message form-message-error">{error}</p> : null}
        {success ? <p className="form-message form-message-success">{success}</p> : null}
      </div>
    </main>
  );
}
