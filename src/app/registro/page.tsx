'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { signUpWithEmail } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
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

    if (!email || !password || !confirmPassword) {
      setError('Completa todos los campos para continuar.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Introduce un correo electrónico válido.');
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
    const result = await signUpWithEmail(email, password);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setSuccess('Revisa tu correo para activar tu cuenta');
    router.push(`/verificar-correo?email=${encodeURIComponent(email)}`);
  }

  return (
    <main className="status-page">
      <div className="auth-shell">
        <p className="eyebrow">Registro</p>
        <h1>Crear cuenta</h1>

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
              placeholder="Repite la contraseña"
            />
          </label>

          <button type="submit" className="form-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <div className="auth-links">
          <Link href="/acceder">Ya tengo cuenta</Link>
        </div>

        {error ? (
          <p role="alert" className="form-message form-message-error">
            {error}
          </p>
        ) : null}
        {success ? <p className="form-message form-message-success">{success}</p> : null}
      </div>
    </main>
  );
}
