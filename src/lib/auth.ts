import { createClient } from '@/lib/supabase/client';

export type AuthActionResult = {
  data: unknown;
  error: { message: string } | null;
  needsVerification?: boolean;
};

const DEFAULT_ERROR = 'La operación no se pudo completar. Inténtalo de nuevo.';

function normalizeAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes('email not confirmed') || normalized.includes('email_not_confirmed')) {
    return 'Debes verificar tu correo antes de acceder.';
  }

  if (
    normalized.includes('invalid login credentials') ||
    normalized.includes('invalid credentials') ||
    normalized.includes('user not found') ||
    normalized.includes('invalid email or password')
  ) {
    return 'Correo o contraseña incorrectos.';
  }

  if (normalized.includes('password should be at least') || normalized.includes('passwords should')) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }

  if (normalized.includes('user already registered') || normalized.includes('already exists')) {
    return 'No se pudo crear la cuenta. Inténtalo de nuevo.';
  }

  return DEFAULT_ERROR;
}

export async function signInWithPassword(email: string, password: string): Promise<AuthActionResult> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const message = normalizeAuthError(error.message);
    return { data, error: { message }, needsVerification: error.message.toLowerCase().includes('email not confirmed') };
  }

  return { data, error: null };
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthActionResult> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { data, error: { message: normalizeAuthError(error.message) } };
  }

  return { data, error: null };
}

export async function sendVerificationEmail(email: string): Promise<AuthActionResult> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.resend({ type: 'signup', email });

  if (error) {
    return { data, error: { message: normalizeAuthError(error.message) } };
  }

  return { data, error: null };
}

export async function requestPasswordReset(email: string): Promise<AuthActionResult> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback?next=/nueva-contrasena`,
  });

  if (error) {
    return { data, error: { message: normalizeAuthError(error.message) } };
  }

  return { data, error: null };
}

export async function updatePassword(password: string): Promise<AuthActionResult> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { data, error: { message: normalizeAuthError(error.message) } };
  }

  return { data, error: null };
}

export async function signOutUser(): Promise<AuthActionResult> {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { data: null, error: { message: normalizeAuthError(error.message) } };
  }

  return { data: null, error: null };
}
