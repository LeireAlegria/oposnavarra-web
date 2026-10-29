import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ContactMessages } from '@/components/contact-messages';

export default async function ContactMessagesPage() {
  const client = await createClient();
  const { data, error } = await client.rpc('es_admin_actual');
  if (error || !data) redirect('/acceder');
  return (
    <main className="page-shell space-y-6 py-8">
      <Link href="/admin" className="underline">
        Volver al panel administrativo
      </Link>
      <h1 className="text-3xl">Mensajes de contacto</h1>
      <ContactMessages />
    </main>
  );
}
