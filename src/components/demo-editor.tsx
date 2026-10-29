'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DemoQuestion } from '@/lib/free-demo';
type Candidate = { id: string; text: string };
type Preview = DemoQuestion & {
  explanation: string;
  reference: string | null;
  correctOptionId: string;
};
type Version = {
  id: string;
  version: number;
  name: string;
  published: boolean;
  invalidated: boolean;
  questionIds: string[];
};
const buttonClass = 'min-h-11 rounded-lg border px-4 py-2 disabled:opacity-50';
export function DemoEditor() {
  const [client] = useState(createClient);
  const [convocations, setConvocations] = useState<{ id: string; nombre: string }[]>([]);
  const [convocation, setConvocation] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [chosen, setChosen] = useState<Candidate[]>([]);
  const [preview, setPreview] = useState<Preview[] | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [catalog, versionResult] = await Promise.all([
          client.from('convocatorias').select('id,nombre').eq('activo', true).order('nombre'),
          client.rpc('demo_admin', { p_action: 'list' }),
        ]);
        if (catalog.error || versionResult.error) throw new Error();
        if (current) {
          setConvocations(catalog.data ?? []);
          setVersions(versionResult.data?.versions ?? []);
        }
      } catch {
        if (current) setError('No se pudo cargar la configuración. Reintenta la carga.');
      } finally {
        if (current) setLoading(false);
      }
    }
    void load();
    return () => {
      current = false;
    };
  }, [client, revision]);
  useEffect(() => {
    let current = true;
    setCandidates([]);
    if (!convocation) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data, error } = await client.rpc('demo_candidates', {
          p_convocation: convocation,
          p_search: search,
          p_page: page,
        });
        if (error) throw error;
        if (current) setCandidates(data ?? []);
      } catch {
        if (current) setError('No se pudieron cargar las preguntas. Reintenta la carga.');
      } finally {
        if (current) setLoading(false);
      }
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [client, convocation, search, page, revision]);
  function invalidatePreview() {
    setPreview(null);
    setReviewed(false);
    setMessage('');
  }
  async function operate(
    action: 'random' | 'preview' | 'publish' | 'invalidate',
    versionId?: string,
  ) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { data, error } = await client.rpc('demo_admin', {
        p_action: action,
        p_convocation: convocation || null,
        p_questions: chosen.map((q) => q.id),
        p_version: versionId ?? null,
        p_reviewed: preview,
      });
      if (error) throw error;
      if (action === 'random') {
        setChosen(data.preview.map((q: Preview) => ({ id: q.id, text: q.text })));
        setPreview(data.preview);
        setReviewed(false);
      } else if (action === 'preview') {
        setPreview(data);
        setReviewed(false);
      } else {
        setVersions(data.versions);
        setMessage(
          action === 'publish'
            ? 'Nueva versión publicada. Los intentos en curso conservan su contenido.'
            : 'Versión invalidada. Los visitantes deberán iniciar una prueba nueva.',
        );
        setPreview(null);
        setReviewed(false);
      }
    } catch {
      setError(
        'No se pudo completar la operación. Comprueba que las cinco preguntas tienen cuatro opciones, una única respuesta correcta y explicación.',
      );
    } finally {
      setBusy(false);
    }
  }
  function move(index: number, delta: number) {
    const next = [...chosen];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setChosen(next);
    invalidatePreview();
  }
  return (
    <div className="space-y-6">
      <p>
        Selecciona cinco preguntas publicadas de una convocatoria. Revisa enunciados, soluciones y
        explicaciones antes de publicar. Una nueva publicación conserva las instantáneas de los
        intentos anteriores.
      </p>
      {error && (
        <p role="alert">
          {error}{' '}
          <button className={buttonClass} onClick={() => setRevision((v) => v + 1)}>
            Reintentar carga
          </button>
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {loading && <p role="status">Cargando…</p>}
      <label className="block">
        Convocatoria
        <select
          className="mt-2 block w-full rounded border p-3"
          disabled={busy}
          value={convocation}
          onChange={(e) => {
            setConvocation(e.target.value);
            setChosen([]);
            setPage(0);
            invalidatePreview();
          }}
        >
          <option value="">Selecciona una convocatoria</option>
          {convocations.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>
      {convocation && (
        <>
          <button disabled={busy} className={buttonClass} onClick={() => void operate('random')}>
            Seleccionar cinco al azar
          </button>
          <label className="block">
            Buscar preguntas
            <input
              className="mt-2 block w-full rounded border p-3"
              maxLength={200}
              value={search}
              disabled={busy}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <ul className="space-y-3">
            {candidates.map((q) => (
              <li
                key={q.id}
                className="flex flex-col gap-3 rounded-lg border bg-white p-4 sm:flex-row sm:items-center"
              >
                <p className="min-w-0 flex-1 break-words">{q.text}</p>
                <button
                  className={buttonClass}
                  disabled={busy || chosen.length >= 5 || chosen.some((item) => item.id === q.id)}
                  onClick={() => {
                    setChosen([...chosen, q]);
                    invalidatePreview();
                  }}
                >
                  Añadir
                </button>
              </li>
            ))}
          </ul>
          {!loading && candidates.length === 0 && <p>No hay preguntas para esta selección.</p>}
          <div className="flex flex-wrap gap-3">
            <button
              className={buttonClass}
              disabled={busy || page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <span>Página {page + 1}</span>
            <button
              className={buttonClass}
              disabled={busy || candidates.length < 25}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        </>
      )}
      <h2 className="text-2xl">Selección ordenada ({chosen.length}/5)</h2>
      <ol className="space-y-3">
        {chosen.map((q, index) => (
          <li key={q.id} className="space-y-3 rounded border p-4">
            <p>
              {index + 1}. {q.text}
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                aria-label={`Subir pregunta ${index + 1}`}
                className={buttonClass}
                disabled={busy || index === 0}
                onClick={() => move(index, -1)}
              >
                Subir
              </button>
              <button
                aria-label={`Bajar pregunta ${index + 1}`}
                className={buttonClass}
                disabled={busy || index === chosen.length - 1}
                onClick={() => move(index, 1)}
              >
                Bajar
              </button>
              <button
                className={buttonClass}
                disabled={busy}
                onClick={() => {
                  setChosen(chosen.filter((item) => item.id !== q.id));
                  invalidatePreview();
                }}
              >
                Quitar
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button
        className={buttonClass}
        disabled={busy || chosen.length !== 5}
        onClick={() => void operate('preview')}
      >
        Previsualizar y validar
      </button>
      {preview && (
        <section className="space-y-5">
          <h2 className="text-2xl">Vista previa</h2>
          {preview.map((q, index) => (
            <article key={q.id} className="space-y-3 rounded-xl border bg-white p-5">
              <h3 className="text-xl">
                {index + 1}. {q.text}
              </h3>
              <ul>
                {q.options.map((o) => (
                  <li key={o.id} className="py-2">
                    {o.text}
                    {o.id === q.correctOptionId ? ' · Respuesta correcta' : ''}
                  </li>
                ))}
              </ul>
              <p className="whitespace-pre-wrap">{q.explanation}</p>
              {q.reference && <p>Referencia: {q.reference}</p>}
            </article>
          ))}
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              disabled={busy}
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            He revisado las cinco preguntas, sus explicaciones y referencias.
          </label>
          <button
            className={buttonClass}
            disabled={busy || !reviewed}
            onClick={() => void operate('publish')}
          >
            Publicar nueva versión
          </button>
        </section>
      )}
      <h2 className="text-2xl">Versiones</h2>
      {versions.length === 0 ? (
        <p>No hay versiones publicadas.</p>
      ) : (
        <ul className="space-y-3">
          {versions.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-4 rounded border p-4">
              <p>
                {v.name} · Versión {v.version} ·{' '}
                {v.invalidated ? 'Invalidada' : v.published ? 'Publicada' : 'Sustituida'}
              </p>
              <button
                className={buttonClass}
                disabled={busy || v.invalidated}
                onClick={() => {
                  if (
                    window.confirm(
                      `¿Invalidar la versión ${v.version}? Los intentos afectados mostrarán un aviso para reiniciar.`,
                    )
                  )
                    void operate('invalidate', v.id);
                }}
              >
                Invalidar versión
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
