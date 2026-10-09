'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { updatePassword } from '@/lib/auth';

export default function NewPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasRecoveryCode = Boolean(searchParams.get('code'));
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!hasRecoveryCode) {
      setError('El enlace de recuperación no es válido o ha caducado.');
      return;
    }

    if (!password || !confirmPassword) {
      setError('Completa la nueva contraseña y su confirmación.');
      return;
    }

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setIsSubmitting(true);
    const result = await updatePassword(password);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setSuccess('Contraseña actualizada correctamente.');
    router.push('/acceder?status=reset');
  }

  return (
    <main className="status-page">
      <div className="auth-shell">
        <p className="eyebrow">Nueva contraseña</p>
        <h1>Establece tu contraseña</h1>

        {!hasRecoveryCode ? (
          <p className="form-message form-message-error">
            El enlace de recuperación no es válido o ha caducado. Solicita uno nuevo.
          </p>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <label className="auth-field">
              <span>Contraseña nueva</span>
              <div className="auth-password">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="auth-input"
                  placeholder="Mínimo 8 caracteres"
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

            <label className="auth-field">
              <span>Confirmar contraseña</span>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="auth-input"
                placeholder="Repite la nueva contraseña"
              />
            </label>

            <button type="submit" className="form-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Actualizando...' : 'Guardar contraseña'}
            </button>
          </form>
        )}

        <div className="auth-links">
          <Link href="/acceder">Volver al acceso</Link>
        </div>

        {error ? <p className="form-message form-message-error">{error}</p> : null}
        {success ? <p className="form-message form-message-success">{success}</p> : null}
      </div>
    </main>
  );
}
