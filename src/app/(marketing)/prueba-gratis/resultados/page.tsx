import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { demoAttemptSchema } from '@/lib/free-demo';
export const metadata = { title: 'Mis pruebas gratuitas', robots: { index: false, follow: false } };
export default async function DemoResultsPage() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect('/acceder?next=/prueba-gratis/resultados');
  const { data, error } = await client.rpc('demo_my_results');
  const results = demoAttemptSchema.array().safeParse(data);
  return (
    <main className="page-shell max-w-3xl space-y-6 py-8">
      <Link href="/plataforma" className="underline">
        Mi área personal
      </Link>
      <h1 className="text-3xl">Mis pruebas gratuitas</h1>
      <p>Estos resultados están separados de tus tests y estadísticas de preparación.</p>
      {error || !results.success ? (
        <p role="alert">
          No se pudieron cargar los resultados. Actualiza la página para reintentarlo.
        </p>
      ) : results.data.length === 0 ? (
        <p>Todavía no has guardado ninguna prueba gratuita.</p>
      ) : (
        results.data.map((attempt) => (
          <article key={attempt.id} className="space-y-4 rounded-xl border bg-white p-5">
            <h2 className="text-2xl">
              Prueba gratuita · {attempt.score} de 5 ({attempt.score * 20}%)
            </h2>
            <p>
              {attempt.name} · Versión {attempt.version}
            </p>
            {attempt.invalidated && (
              <p role="status">
                Esta versión se ha retirado. Conservamos el resultado original; puedes iniciar una
                prueba nueva para consultar el contenido vigente.
              </p>
            )}
            {attempt.results.map((result) => (
              <details key={result.id} className="border-t py-3">
                <summary>{result.text}</summary>
                <p className="mt-3">
                  Tu respuesta:{' '}
                  {result.options.find((option) => option.id === result.selectedOptionId)?.text}
                </p>
                <p>
                  Respuesta correcta:{' '}
                  {result.options.find((option) => option.id === result.correctOptionId)?.text}
                </p>
                <p className="whitespace-pre-wrap">{result.explanation}</p>
                {result.reference && <p>{result.reference}</p>}
              </details>
            ))}
          </article>
        ))
      )}
      <Link href="/prueba-gratis" className="underline">
        Volver a la prueba gratuita
      </Link>
    </main>
  );
}
