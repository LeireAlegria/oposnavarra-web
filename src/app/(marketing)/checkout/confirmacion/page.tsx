import { redirect } from 'next/navigation';

import { CheckoutConfirmation } from '@/components/checkout-confirmation';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Confirmación del pago',
  description: 'Consulta el estado de confirmación de tu pago.',
};

type CheckoutConfirmationPageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function CheckoutConfirmationPage({ searchParams }: CheckoutConfirmationPageProps) {
  const { session_id: sessionId } = await searchParams;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  const next = `/checkout/confirmacion?session_id=${encodeURIComponent(sessionId ?? '')}`;
  if (error || !user) redirect(`/acceder?next=${encodeURIComponent(next)}`);
  if (!user.email_confirmed_at) {
    redirect(`/verificar-correo?email=${encodeURIComponent(user.email ?? '')}&next=${encodeURIComponent(next)}`);
  }
  return <CheckoutConfirmation sessionId={sessionId ?? null} />;
}
