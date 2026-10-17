'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { signOutUser } from '@/lib/auth';

export function LogoutButton() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleClick() {
    setError('');
    setIsSubmitting(true);
    const result = await signOutUser();
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <>
      <button type="button" className="form-submit" onClick={handleClick} disabled={isSubmitting}>
        {isSubmitting ? 'Cerrando sesión...' : 'Cerrar sesión'}
      </button>
      {error ? <p className="form-message form-message-error">{error}</p> : null}
    </>
  );
}
