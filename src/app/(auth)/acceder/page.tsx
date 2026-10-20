'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { signInWithPassword } from '@/lib/auth';
import { getSafeInternalPath } from '@/lib/navigation';

export default function AccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = getSafeInternalPath(searchParams.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const resetMessage = searchParams.get('status') === 'reset' ? 'Contraseña restablecida correctamente. Ya puedes iniciar sesión.' : '';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Introduce tu correo y tu contraseña.');
      return;
    }

    setIsSubmitting(true);
    const result = await signInWithPassword(email, password);
    setIsSubmitting(false);

    if (result.error) {
      if (result.needsVerification) {
        router.push(
          `/verificar-correo?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`,
        );
        return;
      }

      setError(result.error.message);
      return;
    }

    router.push(next);
  }

  return (
    <main className="status-page">
      <div className="auth-shell">
        <p className="eyebrow">Acceso</p>
        <h1>Inicia sesión</h1>

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

          <label className="auth-field">
            <span>Contraseña</span>
            <div className="auth-password">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="auth-input"
                placeholder="Tu contraseña"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </label>

          <button type="submit" className="form-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Accediendo...' : 'Entrar'}
          </button>
        </form>

        <div className="auth-links">
          <Link href={`/registro?next=${encodeURIComponent(next)}`}>Crear cuenta</Link>
          <Link href="/recuperar-contrasena">He olvidado mi contraseña</Link>
        </div>

        {resetMessage ? <p className="form-message form-message-success">{resetMessage}</p> : null}
        {error ? (
          <p role="alert" className="form-message form-message-error">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
