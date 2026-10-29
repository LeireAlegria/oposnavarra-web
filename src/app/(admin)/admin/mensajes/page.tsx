import { AdminConsole } from '@/components/admin-console';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ContactMessages } from '@/components/contact-messages';

export default async function ContactMessagesPage() {
  const client = await createClient();
  const { data, error } = await client.rpc('es_admin_actual');
  if (error || !data) redirect('/acceder');
  const {
    data: { user },
  } = await client.auth.getUser();
  return (
    <AdminConsole
      adminEmail={user?.email ?? 'Administrador'}
      extension={{
        href: '/admin/mensajes',
        title: 'Mensajes de contacto',
        description: 'Consulta las consultas recibidas y gestiona su estado de lectura.',
        content: <ContactMessages />,
      }}
    />
  );
}
