import { PublicCatalogContent } from '@/components/public-catalog';
import { getPublicCatalog } from '@/lib/free-demo-server';
export const metadata = {
  title: 'Temario y tests disponibles',
  description: 'Convocatorias, temas y preguntas publicadas en OposNavarra.',
};
export default async function AvailableTestsPage() {
  return (
    <main className="page-shell space-y-7 py-10">
      <h1 className="text-4xl">Temario y tests disponibles</h1>
      <p>
        La suscripción incluye el contenido publicado. Los temas sin preguntas se muestran como
        próximos y todavía no pueden practicarse.
      </p>
      <PublicCatalogContent catalog={await getPublicCatalog()} />
    </main>
  );
}
