'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { sendVerificationEmail } from '@/lib/auth';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get('email') ?? '';
  const [email, setEmail] = useState(initialEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleResend() {
    const targetEmail = email.trim();
    if (!targetEmail) {
      setError('Introduce tu correo electrónico para reenvíar el enlace.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setMessage('');

    const result = await sendVerificationEmail(targetEmail);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setMessage('Se ha reenviado el enlace de verificación.');
  }

  return (
    <main className="status-page">
      <div className="auth-shell">
        <p className="eyebrow">Verificación</p>
        <h1>Revisa tu correo</h1>
        <p>
          Te hemos enviado un enlace para activar tu cuenta. Si no lo has recibido, puedes solicitar
          otro enlace.
        </p>

        <div className="auth-form">
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
        </div>

        <div className="status-actions">
          <button type="button" className="form-submit" onClick={handleResend} disabled={isSubmitting}>
            {isSubmitting ? 'Enviando...' : 'Reenviar correo'}
          </button>
          <Link href="/acceder" className="secondary-button button-link">
            Volver a acceder
          </Link>
        </div>

        {message ? <p className="form-message form-message-success">{message}</p> : null}
        {error ? <p className="form-message form-message-error">{error}</p> : null}
      </div>
    </main>
  );
}
