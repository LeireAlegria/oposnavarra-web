import { AdminConsole } from '@/components/admin-console';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DemoEditor } from '@/components/demo-editor';
export default async function DemoEditorPage() {
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
        href: '/admin/prueba-gratis',
        title: 'Prueba gratuita',
        description: 'Selecciona y revisa las cinco preguntas de la demostración pública.',
        content: <DemoEditor />,
      }}
    />
  );
}
