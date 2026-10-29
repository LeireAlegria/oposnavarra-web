import Link from 'next/link';
import type { PublicCatalog } from '@/lib/free-demo';
export function PublicCatalogContent({ catalog }: { catalog: PublicCatalog | null }) {
  if (catalog === null)
    return (
      <p role="alert">
        No se pudo cargar el contenido disponible. Actualiza la página para reintentarlo.
      </p>
    );
  if (catalog.length === 0)
    return (
      <p>
        No hay convocatorias publicadas en este momento.{' '}
        <Link className="underline" href="/contacto">
          Consulta con nosotros
        </Link>
        .
      </p>
    );
  return (
    <div className="grid gap-6">
      {catalog.map((convocation) => {
        const available = convocation.topics.filter((topic) => topic.count > 0);
        return (
          <article
            key={convocation.id}
            className="rounded-xl border border-[var(--line)] bg-white p-5 sm:p-7"
          >
            <p className="eyebrow !text-[#a8392f]">
              {available.length > 0 ? 'Disponible' : 'Próximamente'}
            </p>
            <h3 className="text-2xl">{convocation.name}</h3>
            <p className="mt-3 text-sm">
              {available.length > 0 && available.length < convocation.topics.length
                ? 'Disponibilidad parcial: puedes practicar los temas que indican preguntas publicadas.'
                : available.length > 0
                  ? 'Consulta las preguntas publicadas por tema.'
                  : 'Todavía no hay preguntas publicadas para practicar.'}
            </p>
            <ul className="mt-4 space-y-2">
              {convocation.topics.map((topic) => (
                <li key={topic.number}>
                  {topic.number}. {topic.name} ·{' '}
                  {topic.count > 0 ? `${topic.count} preguntas publicadas` : 'Próximamente'}
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
