import Link from 'next/link';
import { redirect } from 'next/navigation';
import { TestPlatform } from '@/components/test-platform';
import { createClient } from '@/lib/supabase/server';

export default async function ChallengeExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect(`/acceder?next=${encodeURIComponent(`/retos/${id}/examen`)}`);
  const { data, error } = await client.rpc('consultar_reto', { p_reto_id: id });
  if (error || !data?.attemptId || (data.status === 'abierto' && data.attemptStatus === 'finalizado')) redirect(`/retos/${id}`);
  return <TestPlatform accountEmail={user.email ?? ''} accountPanel={<Link href={`/retos/${id}`}>Volver al reto</Link>} canPractice initialAttemptId={data.attemptId} challengeId={id} />;
}
