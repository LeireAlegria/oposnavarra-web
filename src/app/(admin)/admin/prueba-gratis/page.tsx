import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DemoEditor } from '@/components/demo-editor';
export default async function DemoEditorPage() {
  const client = await createClient();
  const { data, error } = await client.rpc('es_admin_actual');
  if (error || !data) redirect('/acceder');
  return (
    <main className="page-shell space-y-6 py-8">
      <Link href="/admin" className="underline">
        Volver al panel
      </Link>
      <h1 className="text-3xl">Prueba gratuita</h1>
      <DemoEditor />
    </main>
  );
}
