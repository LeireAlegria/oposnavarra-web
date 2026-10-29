import { FreeDemo } from '@/components/free-demo';
import { getDemoAvailable } from '@/lib/free-demo-server';
import { createClient } from '@/lib/supabase/server';
export const metadata = {
  title: 'Prueba cinco preguntas gratis',
  robots: { index: false, follow: false },
  referrer: 'no-referrer' as const,
};
export default async function FreeDemoPage() {
  const client = await createClient();
  const { data } = await client.auth.getUser();
  return (
    <main className="page-shell max-w-3xl space-y-6 py-8">
      <h1 className="text-3xl">Prueba gratuita</h1>
      <FreeDemo available={await getDemoAvailable()} authenticated={Boolean(data.user)} />
    </main>
  );
}
