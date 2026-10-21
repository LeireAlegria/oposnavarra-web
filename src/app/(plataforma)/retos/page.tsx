import { redirect } from 'next/navigation';
import { Challenges } from '@/components/challenges';
import { createClient } from '@/lib/supabase/server';

export default async function ChallengesPage() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect('/acceder?next=%2Fretos');
  const { data } = await client.rpc('comprobar_acceso_suscripcion', { p_usuario_id: user.id });
  return <Challenges authenticated canCreate={data === true} />;
}
