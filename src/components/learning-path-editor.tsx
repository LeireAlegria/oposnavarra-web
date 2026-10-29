'use client';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { pathRpc } from '@/lib/learning-path';
import { PathConfirmation } from '@/components/path-confirmation';
const ruleSchema = z.object({
  id: z.string(),
  title: z.string(),
  questionCount: z.number(),
  criterion: z.enum(['finalizacion', 'porcentaje']),
  threshold: z.number(),
  xp: z.number(),
});
const pathsSchema = z.array(
  z.object({
    id: z.string(),
    convocationId: z.string(),
    title: z.string(),
    state: z.string(),
    stops: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        type: z.string(),
        blockId: z.string(),
        challenges: z.array(ruleSchema),
      }),
    ),
  }),
);
type EditablePath = z.infer<typeof pathsSchema>[number];
const buttonClass = 'min-h-11 rounded-lg border bg-white px-4 py-2 disabled:opacity-50';
export function LearningPathEditor() {
  const [convocations, setConvocations] = useState<{ id: string; nombre: string }[]>([]);
  const [convocation, setConvocation] = useState('');
  const [paths, setPaths] = useState<EditablePath[]>([]);
  const [selected, setSelected] = useState('');
  const [draft, setDraft] = useState<EditablePath | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState<'publish' | 'archive' | 'regenerate' | null>(
    null,
  );
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    async function load() {
      setLoading(true);
      try {
        const client = createClient();
        const [catalog, items] = await Promise.all([
          client.from('convocatorias').select('id,nombre').eq('activo', true).order('nombre'),
          pathRpc('camino_admin', { p_action: 'list' }, pathsSchema),
        ]);
        if (catalog.error) throw catalog.error;
        if (current) {
          setConvocations(catalog.data ?? []);
          setPaths(items);
          setError('');
        }
      } catch {
        if (current) setError('No se pudieron cargar los caminos. Reintenta la carga.');
      } finally {
        if (current) setLoading(false);
      }
    }
    void load();
    return () => {
      current = false;
    };
  }, [revision]);
  async function operate(action: 'generate' | 'save' | 'publish' | 'archive' | 'regenerate') {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    setConfirmation(null);
    try {
      const data = await pathRpc(
        'camino_admin',
        {
          p_action: action,
          p_path: draft?.id ?? null,
          p_convocation: convocation || null,
          p_title: draft?.title ?? null,
          p_rules:
            (action === 'save' || action === 'publish') && draft?.state === 'borrador'
              ? draft.stops.flatMap((stop) => stop.challenges)
              : null,
        },
        pathsSchema,
      );
      setPaths(data);
      const updated = data.find((path) => path.id === selected) ?? data[0];
      setSelected(updated?.id ?? '');
      setDraft(updated ?? null);
      setNotice(
        action === 'publish'
          ? 'Camino publicado: estructura y reglas congeladas.'
          : action === 'archive'
            ? 'Camino archivado. El progreso y los resultados se conservan.'
            : action === 'generate' || action === 'regenerate'
              ? 'Borrador generado. Revisa la configuración antes de publicar.'
              : 'Cambios guardados.',
      );
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'No se pudo completar la operación.');
    } finally {
      setBusy(false);
    }
  }
  function changeRule(
    id: string,
    field: 'questionCount' | 'threshold' | 'xp' | 'criterion',
    value: string,
  ) {
    if (!draft) return;
    setDraft({
      ...draft,
      stops: draft.stops.map((stop) => ({
        ...stop,
        challenges: stop.challenges.map((rule) =>
          rule.id === id
            ? { ...rule, [field]: field === 'criterion' ? value : Number(value) }
            : rule,
        ),
      })),
    });
  }
  return (
    <div className="space-y-6">
      <p>
        Genera explícitamente un borrador a partir de los bloques y temas del catálogo. Publicar
        valida preguntas distintas suficientes, cuatro retos por tema y un repaso equilibrado por
        bloque. Un camino publicado no se puede reordenar, regenerar ni reiniciar.
      </p>
      {loading && <p role="status">Cargando caminos…</p>}
      {error && (
        <p role="alert">
          {error}{' '}
          <button className={buttonClass} onClick={() => setRevision((value) => value + 1)}>
            Reintentar carga
          </button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <section className="space-y-4 rounded-xl border p-5">
        <h2 className="text-xl">Nuevo borrador</h2>
        <label className="block">
          Convocatoria
          <select
            value={convocation}
            disabled={busy}
            className="mt-2 block w-full rounded border bg-white p-3"
            onChange={(event) => setConvocation(event.target.value)}
          >
            <option value="">Selecciona una convocatoria</option>
            {convocations.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <button
          className={buttonClass}
          disabled={busy || !convocation}
          onClick={() => void operate('generate')}
        >
          Generar borrador
        </button>
      </section>
      <label className="block">
        Camino
        <select
          value={selected}
          disabled={busy}
          className="mt-2 block w-full rounded border bg-white p-3"
          onChange={(event) => {
            setSelected(event.target.value);
            setDraft(paths.find((path) => path.id === event.target.value) ?? null);
            setNotice('');
          }}
        >
          <option value="">Selecciona un camino</option>
          {paths.map((path) => (
            <option key={path.id} value={path.id}>
              {path.title} · {path.state}
            </option>
          ))}
        </select>
      </label>
      {!loading && paths.length === 0 && <p>No hay caminos. Genera un borrador para empezar.</p>}
      {draft && (
        <section className="space-y-6">
          <label className="block">
            Título
            <input
              value={draft.title}
              maxLength={200}
              disabled={busy}
              className="mt-2 block w-full rounded border p-3"
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </label>
          <p>
            Estado: {draft.state}.{' '}
            {draft.state !== 'borrador'
              ? 'Solo puedes corregir el título o archivar; el progreso se conserva.'
              : 'Las cantidades no se reducen automáticamente si falta contenido.'}
          </p>
          {draft.stops.map((stop) => (
            <section key={stop.id} className="space-y-4 rounded-xl border bg-white p-5">
              <h2 className="text-xl">
                {stop.title} · {stop.type === 'tema' ? 'Tema' : 'Repaso obligatorio'}
              </h2>
              {stop.challenges.map((rule) => (
                <fieldset
                  key={rule.id}
                  disabled={busy || draft.state !== 'borrador'}
                  className="grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4"
                >
                  <legend className="pt-4 font-semibold">{rule.title}</legend>
                  <label>
                    Preguntas
                    <input
                      type="number"
                      min={1}
                      value={rule.questionCount}
                      className="mt-1 block w-full rounded border p-2"
                      onChange={(event) => changeRule(rule.id, 'questionCount', event.target.value)}
                    />
                  </label>
                  <label>
                    Criterio
                    <select
                      value={rule.criterion}
                      className="mt-1 block w-full rounded border p-2"
                      onChange={(event) => changeRule(rule.id, 'criterion', event.target.value)}
                    >
                      <option value="finalizacion">Finalizar y responder</option>
                      <option value="porcentaje">Porcentaje de aciertos</option>
                    </select>
                  </label>
                  <label>
                    Mínimo (%)
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={rule.threshold}
                      className="mt-1 block w-full rounded border p-2"
                      onChange={(event) => changeRule(rule.id, 'threshold', event.target.value)}
                    />
                  </label>
                  <label>
                    XP
                    <input
                      type="number"
                      min={0}
                      value={rule.xp}
                      className="mt-1 block w-full rounded border p-2"
                      onChange={(event) => changeRule(rule.id, 'xp', event.target.value)}
                    />
                  </label>
                </fieldset>
              ))}
            </section>
          ))}
          <div className="flex flex-wrap gap-3">
            <button
              className={buttonClass}
              disabled={busy || !draft.title.trim()}
              onClick={() => void operate('save')}
            >
              Guardar cambios
            </button>
            {draft.state === 'borrador' && (
              <>
                <button
                  className={buttonClass}
                  disabled={busy}
                  onClick={() => setConfirmation('publish')}
                >
                  Validar y publicar
                </button>
                <button
                  className={buttonClass}
                  disabled={busy}
                  onClick={() => setConfirmation('regenerate')}
                >
                  Regenerar borrador desde el catálogo
                </button>
              </>
            )}
            {draft.state !== 'archivado' && (
              <button
                className={buttonClass}
                disabled={busy}
                onClick={() => setConfirmation('archive')}
              >
                Archivar camino
              </button>
            )}
          </div>
        </section>
      )}
      {confirmation && (
        <PathConfirmation
          title={
            confirmation === 'publish'
              ? '¿Publicar este camino?'
              : confirmation === 'regenerate'
                ? '¿Regenerar el borrador?'
                : '¿Archivar el camino?'
          }
          onCancel={() => setConfirmation(null)}
          onConfirm={() => void operate(confirmation)}
        >
          {confirmation === 'publish'
            ? 'Se comprobará la disponibilidad y se congelarán la estructura, las reglas y las recompensas.'
            : confirmation === 'regenerate'
              ? 'Se sustituirá la configuración del borrador por el orden actual del catálogo y los valores iniciales. Solo se permite sin intentos asociados.'
              : 'No se podrán iniciar, reanudar ni finalizar intentos. Se conservarán el progreso y los resultados.'}
        </PathConfirmation>
      )}
    </div>
  );
}
