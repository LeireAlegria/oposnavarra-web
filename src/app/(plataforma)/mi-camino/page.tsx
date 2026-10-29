import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LearningPath } from '@/components/learning-path';
import { ChallengePlatformShell } from '@/components/challenge-platform-shell';
export const metadata = { title: 'Mi camino' };
export default async function LearningPathPage({
  searchParams,
}: {
  searchParams: Promise<{ attempt?: string }>;
}) {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect('/acceder?next=/mi-camino');
  if (!user.email_confirmed_at) redirect('/verificar-correo?next=/mi-camino');
  const { attempt } = await searchParams;
  return (
    <ChallengePlatformShell activeArea="camino">
      <LearningPath
        initialAttemptId={attempt && /^[a-f0-9-]{36}$/i.test(attempt) ? attempt : undefined}
      />
    </ChallengePlatformShell>
  );
}
