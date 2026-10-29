import { AdminConsole } from '@/components/admin-console';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LearningPathEditor } from '@/components/learning-path-editor';
export default async function LearningPathAdminPage() {
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
        href: '/admin/caminos',
        title: 'Caminos de aprendizaje',
        description: 'Configura y publica los recorridos de las convocatorias.',
        content: <LearningPathEditor />,
      }}
    />
  );
}
