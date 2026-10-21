import { redirect } from 'next/navigation';
import { Challenges } from '@/components/challenges';
import { createClient } from '@/lib/supabase/server';

export default async function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect(`/acceder?next=${encodeURIComponent(`/retos/${id}`)}`);
  return <Challenges id={id} authenticated />;
}
