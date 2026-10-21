import { Challenges } from '@/components/challenges';
import { createClient } from '@/lib/supabase/server';

export default async function ChallengeInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  return <Challenges token={token} authenticated={!!user} />;
}
