'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Block = { id: string; nombre: string; orden: number; referencia_oficial: string | null };
type Relation = {
  tema_id: string;
  bloque_id: string;
  numero: number;
  orden: number;
  texto_oficial: string | null;
};
type Syllabus = { blocks: Block[]; relations: Relation[] };
const inputClass =
  'mt-1 w-full rounded-lg border border-[#d9d5cc] bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[#bd3734]';
const buttonClass =
  'min-h-10 rounded-lg border border-[#e5e1d8] bg-white px-3 py-2 text-sm font-medium hover:bg-[#f7f5f0] focus-visible:outline-2 focus-visible:outline-[#bd3734] disabled:cursor-not-allowed disabled:opacity-40';

export function ConvocationBlocks({
  convocationId,
  topics,
  onSaved,
}: {
  convocationId: string;
  topics: { id: string; nombre: string }[];
  onSaved: () => void;
}) {
  const [syllabus, setSyllabus] = useState<Syllabus>({ blocks: [], relations: [] });
  const [saved, setSaved] = useState<Syllabus | null>(null);
  const [busy, setBusy] = useState<'loading' | 'saving' | null>('loading');
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [openBlocks, setOpenBlocks] = useState<string[]>([]);
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const { blocks, relations } = syllabus;
  const dirty = saved !== null && JSON.stringify(syllabus) !== JSON.stringify(saved);
  const availableTopics = topics.filter(
    (topic) => !relations.some((relation) => relation.tema_id === topic.id),
  );
  const topicName = (id: string) =>
    topics.find((topic) => topic.id === id)?.nombre ?? 'Tema no disponible';
  const blockRelations = (id: string) =>
    relations.filter((relation) => relation.bloque_id === id).sort((a, b) => a.orden - b.orden);
  function numberError(relation: Relation) {
    if (!Number.isInteger(relation.numero) || relation.numero <= 0)
      return 'Introduce un número entero mayor que cero.';
    if (
      relations.some(
        (item) =>
          item.tema_id !== relation.tema_id &&
          item.bloque_id === relation.bloque_id &&
          item.numero === relation.numero,
      )
    )
      return 'Este número ya está usado en el bloque.';
    return '';
  }
  const invalid =
    !blocks.length ||
    blocks.some((block) => !block.nombre.trim()) ||
    relations.some((relation) => numberError(relation));

  useEffect(() => {
    let active = true;
    setBusy('loading');
    setSaved(null);
    setMessage('');
    setFailed(false);
    setEditingBlock(null);
    const client = createClient();
    void Promise.all([
      client
        .from('convocatoria_bloques')
        .select('*')
        .eq('convocatoria_id', convocationId)
        .order('orden'),
      client
        .from('convocatoria_tema')
        .select('tema_id, bloque_id, numero, orden, texto_oficial')
        .eq('convocatoria_id', convocationId)
        .order('orden'),
    ])
      .then(([blockResult, relationResult]) => {
        if (!active) return;
        if (blockResult.error || relationResult.error) throw new Error();
        const next = { blocks: blockResult.data ?? [], relations: relationResult.data ?? [] };
        setSyllabus(next);
        setSaved(next);
        setOpenBlocks(next.blocks[0] ? [next.blocks[0].id] : []);
      })
      .catch(() => {
        if (active) {
          setMessage('No se pudo cargar el temario. Vuelve a intentarlo.');
          setFailed(true);
        }
      })
      .finally(() => {
        if (active) setBusy(null);
      });
    return () => {
      active = false;
    };
  }, [convocationId, reload]);

  function update(next: Syllabus) {
    setSyllabus(next);
    setMessage('');
    setFailed(false);
  }
  function reorderBlock(index: number, direction: number) {
    const next = [...blocks];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    update({ ...syllabus, blocks: next.map((block, index) => ({ ...block, orden: index + 1 })) });
  }
  function reorderTopic(relation: Relation, direction: number) {
    const entries = blockRelations(relation.bloque_id);
    const index = entries.findIndex((item) => item.tema_id === relation.tema_id);
    [entries[index], entries[index + direction]] = [entries[index + direction], entries[index]];
    update({
      ...syllabus,
      relations: relations.map((item) =>
        item.bloque_id === relation.bloque_id
          ? { ...item, orden: entries.findIndex((entry) => entry.tema_id === item.tema_id) + 1 }
          : item,
      ),
    });
  }
  function moveTopic(relation: Relation, destination: string) {
    update({
      ...syllabus,
      relations: relations.map((item) =>
        item.tema_id === relation.tema_id
          ? {
              ...item,
              bloque_id: destination,
              orden: Math.max(0, ...blockRelations(destination).map((entry) => entry.orden)) + 1,
            }
          : item,
      ),
    });
    setOpenBlocks((current) => [...new Set([...current, destination])]);
  }
  async function save() {
    if (busy || invalid || !dirty) return;
    setBusy('saving');
    setMessage('');
    setFailed(false);
    const next = {
      ...syllabus,
      blocks: blocks.map((block, index) => ({ ...block, orden: index + 1 })),
    };
    try {
      const { error } = await createClient().rpc('guardar_bloques_convocatoria_admin', {
        p_convocatoria_id: convocationId,
        p_bloques: next.blocks,
        p_relaciones: next.relations,
      });
      if (error) throw error;
      setSyllabus(next);
      setSaved(next);
      setMessage('Cambios guardados.');
      onSaved();
    } catch {
      setMessage('No se pudieron guardar los cambios. Se conservan para que puedas reintentarlo.');
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="min-w-0 space-y-4" aria-label="Gestión del temario">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-[#302f2b]">Temario de la convocatoria</h4>
          <p className="mt-1 text-sm text-[#777468]">
            {blocks.length} {blocks.length === 1 ? 'bloque' : 'bloques'} · {relations.length}{' '}
            {relations.length === 1 ? 'tema' : 'temas'}
          </p>
        </div>
        {saved && (
          <button
            type="button"
            className={buttonClass}
            disabled={!!busy}
            onClick={() => {
              const id = crypto.randomUUID();
              update({
                ...syllabus,
                blocks: [
                  ...blocks,
                  { id, nombre: '', referencia_oficial: '', orden: blocks.length + 1 },
                ],
              });
              setOpenBlocks((current) => [...current, id]);
              setEditingBlock(id);
            }}
          >
            + Añadir bloque
          </button>
        )}
      </div>
      {busy === 'loading' && (
        <div role="status" className="rounded-xl bg-[#f7f5f0] p-5 text-sm text-[#777468]">
          Cargando bloques y temas…
        </div>
      )}
      {message && (
        <div
          role={failed ? 'alert' : 'status'}
          className={`rounded-lg border p-3 text-sm ${failed ? 'border-[#edc5bf] bg-[#fff5f2] text-[#a82f2c]' : 'border-[#cbded0] bg-[#f2f8f3] text-[#31583a]'}`}
        >
          {message}
          {!saved && !busy && (
            <button
              type="button"
              className={`${buttonClass} ml-3`}
              onClick={() => setReload((value) => value + 1)}
            >
              Reintentar carga
            </button>
          )}
        </div>
      )}
      {saved && (
        <>
          <p className="text-xs text-[#777468]">
            Abre un bloque para ver sus temas. Las flechas cambian la posición y conservan el número
            oficial.
          </p>
          <fieldset disabled={!!busy} className="min-w-0 space-y-3">
            {!blocks.length && (
              <div className="rounded-xl border border-dashed border-[#d9d5cc] px-5 py-8 text-center">
                <p className="font-medium">Organiza tu temario</p>
                <p className="mt-1 text-sm text-[#777468]">
                  Añade el primer bloque y vincula los temas del catálogo.
                </p>
              </div>
            )}
            {blocks.map((block, index) => {
              const entries = blockRelations(block.id);
              const expanded = openBlocks.includes(block.id);
              const hasErrors =
                !block.nombre.trim() || entries.some((relation) => numberError(relation));
              return (
                <article
                  key={block.id}
                  className={`min-w-0 overflow-hidden rounded-xl border bg-white ${hasErrors ? 'border-[#dca49c]' : 'border-[#e5e1d8]'}`}
                >
                  <div className="flex items-start gap-2 bg-[#faf9f6] p-3">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={`block-${block.id}`}
                      className="flex min-h-11 min-w-0 flex-1 items-start gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-[#bd3734]"
                      onClick={() =>
                        setOpenBlocks(
                          expanded
                            ? openBlocks.filter((id) => id !== block.id)
                            : [...openBlocks, block.id],
                        )
                      }
                    >
                      <span aria-hidden="true" className="mt-1 text-[#8d897e]">
                        {expanded ? '▾' : '▸'}
                      </span>
                      <span className="min-w-0">
                        <span className="text-xs font-medium text-[#8d897e]">
                          BLOQUE {index + 1}
                          {block.referencia_oficial ? ` · ${block.referencia_oficial}` : ''}
                        </span>
                        <span className="mt-1 block break-words text-sm font-semibold text-[#302f2b]">
                          {block.nombre || 'Nuevo bloque'}
                        </span>
                        <span className="mt-1 block text-xs text-[#777468]">
                          {entries.length} {entries.length === 1 ? 'tema' : 'temas'}
                          {hasErrors ? ' · Requiere revisión' : ''}
                        </span>
                      </span>
                    </button>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        className={buttonClass}
                        disabled={!index}
                        aria-label={`Subir bloque ${block.nombre || index + 1}`}
                        onClick={() => reorderBlock(index, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className={buttonClass}
                        disabled={index === blocks.length - 1}
                        aria-label={`Bajar bloque ${block.nombre || index + 1}`}
                        onClick={() => reorderBlock(index, 1)}
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                  <div
                    id={`block-${block.id}`}
                    hidden={!expanded}
                    className="min-w-0 space-y-4 p-3 sm:p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        className="min-h-10 rounded px-2 text-sm font-medium text-[#a82f2c] underline-offset-4 hover:underline"
                        aria-expanded={editingBlock === block.id}
                        onClick={() => setEditingBlock(editingBlock === block.id ? null : block.id)}
                      >
                        {editingBlock === block.id ? 'Cerrar edición del bloque' : 'Editar bloque'}
                      </button>
                      {!entries.length && (
                        <button
                          type="button"
                          className="min-h-10 rounded px-2 text-sm text-[#a82f2c] hover:underline"
                          onClick={() =>
                            update({
                              ...syllabus,
                              blocks: blocks.filter((item) => item.id !== block.id),
                            })
                          }
                        >
                          Eliminar bloque vacío
                        </button>
                      )}
                    </div>
                    {editingBlock === block.id && (
                      <div className="grid gap-3 rounded-lg bg-[#f7f5f0] p-3 sm:grid-cols-2">
                        <label className="text-sm font-medium">
                          Nombre del bloque
                          <input
                            autoFocus
                            className={inputClass}
                            value={block.nombre}
                            aria-invalid={!block.nombre.trim()}
                            onChange={(event) =>
                              update({
                                ...syllabus,
                                blocks: blocks.map((item) =>
                                  item.id === block.id
                                    ? { ...item, nombre: event.target.value }
                                    : item,
                                ),
                              })
                            }
                          />
                          {!block.nombre.trim() && (
                            <span className="mt-1 block text-xs text-[#a82f2c]">
                              Escribe un nombre para el bloque.
                            </span>
                          )}
                        </label>
                        <label className="text-sm font-medium">
                          Referencia oficial{' '}
                          <span className="font-normal text-[#777468]">(opcional)</span>
                          <input
                            placeholder="Ej. Parte I"
                            className={inputClass}
                            value={block.referencia_oficial ?? ''}
                            onChange={(event) =>
                              update({
                                ...syllabus,
                                blocks: blocks.map((item) =>
                                  item.id === block.id
                                    ? { ...item, referencia_oficial: event.target.value }
                                    : item,
                                ),
                              })
                            }
                          />
                        </label>
                      </div>
                    )}
                    {!entries.length && (
                      <p className="rounded-lg bg-[#f7f5f0] p-4 text-sm text-[#777468]">
                        Este bloque aún no tiene temas. Añade uno del catálogo o mueve aquí un tema
                        de otro bloque.
                      </p>
                    )}
                    <ol className="divide-y divide-[#eeeae3]">
                      {entries.map((relation, topicIndex) => {
                        const error = numberError(relation);
                        return (
                          <li key={relation.tema_id} className="min-w-0 py-3 first:pt-0">
                            <div className="flex items-start gap-3">
                              <span
                                className={`mt-1 flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg px-1 text-xs font-semibold ${error ? 'bg-[#fff0ed] text-[#a82f2c]' : 'bg-[#f2efe8] text-[#777468]'}`}
                              >
                                {relation.numero || '—'}
                              </span>
                              <details className="min-w-0 flex-1">
                                <summary className="cursor-pointer break-words rounded py-1 text-sm leading-6 text-[#302f2b] focus-visible:outline-2 focus-visible:outline-[#bd3734]">
                                  {topicName(relation.tema_id)}
                                </summary>
                                <div className="mt-3 space-y-3 rounded-lg bg-[#f7f5f0] p-3">
                                  <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
                                    <label className="text-xs font-medium">
                                      Número oficial
                                      <input
                                        type="number"
                                        min="1"
                                        className={inputClass}
                                        value={relation.numero || ''}
                                        aria-invalid={!!error}
                                        aria-describedby={
                                          error ? `number-error-${relation.tema_id}` : undefined
                                        }
                                        onChange={(event) =>
                                          update({
                                            ...syllabus,
                                            relations: relations.map((item) =>
                                              item.tema_id === relation.tema_id
                                                ? { ...item, numero: Number(event.target.value) }
                                                : item,
                                            ),
                                          })
                                        }
                                      />
                                    </label>
                                    <label className="text-xs font-medium">
                                      Mover a otro bloque
                                      <select
                                        className={inputClass}
                                        value={relation.bloque_id}
                                        onChange={(event) =>
                                          moveTopic(relation, event.target.value)
                                        }
                                      >
                                        {blocks.map((item) => (
                                          <option key={item.id} value={item.id}>
                                            {item.nombre || 'Nuevo bloque'}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                  </div>
                                  {relation.texto_oficial && (
                                    <details>
                                      <summary className="cursor-pointer text-xs font-medium text-[#777468]">
                                        Consultar texto oficial
                                      </summary>
                                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                                        {relation.texto_oficial}
                                      </p>
                                    </details>
                                  )}
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-xs text-[#777468]">
                                      Posición {topicIndex + 1} de {entries.length}
                                    </span>
                                    <button
                                      type="button"
                                      className="min-h-10 rounded px-2 text-xs font-medium text-[#a82f2c] hover:underline"
                                      onClick={() =>
                                        update({
                                          ...syllabus,
                                          relations: relations.filter(
                                            (item) => item.tema_id !== relation.tema_id,
                                          ),
                                        })
                                      }
                                    >
                                      Desvincular de esta convocatoria
                                    </button>
                                  </div>
                                  <p className="text-xs text-[#777468]">
                                    Desvincular conserva el tema del catálogo y sus preguntas.
                                  </p>
                                </div>
                              </details>
                              <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                                <button
                                  type="button"
                                  className={buttonClass}
                                  disabled={!topicIndex}
                                  aria-label={`Subir tema ${relation.numero} de ${block.nombre}`}
                                  onClick={() => reorderTopic(relation, -1)}
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  className={buttonClass}
                                  disabled={topicIndex === entries.length - 1}
                                  aria-label={`Bajar tema ${relation.numero} de ${block.nombre}`}
                                  onClick={() => reorderTopic(relation, 1)}
                                >
                                  ↓
                                </button>
                              </div>
                            </div>
                            {error && (
                              <p
                                id={`number-error-${relation.tema_id}`}
                                className="mt-2 text-xs text-[#a82f2c]"
                              >
                                Tema {relation.numero || 'sin número'}: {error} Abre el tema para
                                corregirlo.
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                    <div className="border-t border-[#eeeae3] pt-3">
                      <label className="block text-xs font-semibold text-[#777468]">
                        Añadir tema del catálogo
                        <select
                          className={inputClass}
                          value=""
                          disabled={!availableTopics.length}
                          onChange={(event) => {
                            if (!event.target.value) return;
                            update({
                              ...syllabus,
                              relations: [
                                ...relations,
                                {
                                  tema_id: event.target.value,
                                  bloque_id: block.id,
                                  numero: Math.max(0, ...entries.map((item) => item.numero)) + 1,
                                  orden: Math.max(0, ...entries.map((item) => item.orden)) + 1,
                                  texto_oficial: null,
                                },
                              ],
                            });
                          }}
                        >
                          <option value="">
                            {availableTopics.length
                              ? 'Selecciona un tema para añadirlo…'
                              : 'Todos los temas del catálogo ya están vinculados'}
                          </option>
                          {availableTopics.map((topic) => (
                            <option key={topic.id} value={topic.id}>
                              {topic.nombre}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                </article>
              );
            })}
          </fieldset>
          <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5e1d8] bg-white p-3 shadow-lg shadow-black/5">
            <p className="text-xs text-[#777468]" aria-live="polite">
              {busy === 'saving'
                ? 'Guardando cambios…'
                : dirty
                  ? invalid
                    ? 'Revisa los campos marcados antes de guardar.'
                    : 'Tienes cambios sin guardar.'
                  : 'Todos los cambios están guardados.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={buttonClass}
                disabled={!dirty || !!busy}
                onClick={() => {
                  setSyllabus(saved);
                  setMessage('');
                  setFailed(false);
                }}
              >
                Descartar cambios
              </button>
              <button
                type="button"
                className="min-h-10 rounded-lg bg-[#bd3734] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a82f2c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd3734] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!dirty || !!busy || !!invalid}
                onClick={() => void save()}
              >
                {busy === 'saving' ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
