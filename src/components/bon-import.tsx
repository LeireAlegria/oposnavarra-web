'use client';

import { useState } from 'react';
import { draftSchema, type BonDraft, type BonTopic } from '@/lib/bon/draft';

type CatalogTopic = { id: string; nombre: string; descripcion?: string | null };
const inputClass = 'w-full rounded-lg border border-[var(--line)] bg-white p-2';
const buttonClass = 'rounded-lg border border-[var(--line)] px-3 py-2 text-sm disabled:opacity-40';

export function BonImport({ topics, onSaved }: { topics: CatalogTopic[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [draft, setDraft] = useState<BonDraft | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [existingId, setExistingId] = useState('');
  const [savedId, setSavedId] = useState('');
  const [operationId, setOperationId] = useState('');
  const [attempted, setAttempted] = useState(false);
  const total = draft?.blocks.reduce((sum, block) => sum + block.topics.length, 0) ?? 0;
  const validation = draft ? draftSchema.safeParse(draft) : null;
  function change(next: BonDraft) {
    setDraft({ ...next, reviewed: false });
  }
  function updateTopic(blockIndex: number, topicIndex: number, patch: Partial<BonTopic>) {
    if (!draft) return;
    change({
      ...draft,
      blocks: draft.blocks.map((block, index) =>
        index === blockIndex
          ? {
              ...block,
              topics: block.topics.map((topic, index) =>
                index === topicIndex ? { ...topic, ...patch } : topic,
              ),
            }
          : block,
      ),
    });
  }
  async function submit(action: 'extract' | 'confirm') {
    if (action === 'confirm' && !validation?.success) return;
    setBusy(true);
    setMessage('');
    setExistingId('');
    if (action === 'confirm') setAttempted(true);
    try {
      const response = await fetch('/api/admin/bon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          action === 'extract' ? { action, url } : { action, draft, operationId },
        ),
      });
      const result = await response.json();
      if (!response.ok) {
        setAttempted(false);
        setExistingId(result.existingId ?? '');
        throw new Error(result.message ?? 'No se pudo completar la operación.');
      }
      if (action === 'extract') {
        setDraft(result.draft);
        setWarnings(result.warnings);
        setOperationId(crypto.randomUUID());
        setSavedId('');
        setAttempted(false);
      } else {
        setSavedId(result.id);
        onSaved();
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo conectar. El borrador se conserva para reintentar.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mb-6 rounded-2xl border border-[var(--line)] bg-white p-4 xl:col-span-2">
      <button
        className={buttonClass}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        Importar desde el BON
      </button>
      {open && (
        <div className="mt-4 space-y-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit('extract');
            }}
            className="space-y-3"
          >
            <label className="block">
              URL del anuncio del BON
              <input
                type="url"
                required
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                className={inputClass}
                disabled={busy || !!draft}
              />
            </label>
            <button className={buttonClass} disabled={busy || !!draft}>
              {busy ? 'Procesando…' : 'Extraer convocatoria'}
            </button>
          </form>
          {message && <p role="alert">{message}</p>}
          {existingId && (
            <a className="underline" href={`/admin?convocatoria=${existingId}`}>
              Ver convocatoria existente
            </a>
          )}
          {savedId ? (
            <div role="status">
              Importación completada: {draft?.name}. {draft?.blocks.length} bloques y {total} temas.{' '}
              <a className="underline" href={`/admin?convocatoria=${savedId}`}>
                Ver convocatoria creada
              </a>
            </div>
          ) : (
            draft && (
              <>
                <a href={draft.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                  Consultar anuncio original
                </a>
                {warnings.length > 0 && (
                  <ul className="list-disc pl-5">
                    {warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                )}
                {attempted && (
                  <p>
                    Si perdiste la respuesta, reintenta la confirmación con este borrador para
                    recuperar el resultado.
                  </p>
                )}
                <fieldset disabled={busy || attempted} className="space-y-4 disabled:opacity-70">
                  <p>
                    La propuesta de nombre conserva el texto completo; puedes cambiar el nombre de
                    presentación. El contenido oficial se guarda por separado.
                  </p>
                  {(
                    [
                      'name',
                      'description',
                      'organization',
                      'group',
                      'publicationDate',
                      'resolution',
                      'announcementCode',
                    ] as const
                  ).map((field, index) => (
                    <label className="block" key={field}>
                      {
                        [
                          'Nombre de presentación',
                          'Denominación oficial / descripción',
                          'Administración convocante',
                          'Nivel',
                          'Fecha de publicación',
                          'Referencia de resolución',
                          'Código del anuncio',
                        ][index]
                      }
                      <input
                        className={inputClass}
                        type={field === 'publicationDate' ? 'date' : 'text'}
                        value={draft[field]}
                        onChange={(event) => change({ ...draft, [field]: event.target.value })}
                      />
                    </label>
                  ))}
                  <p>
                    {draft.blocks.length} bloques · {total} temas
                  </p>
                  {draft.blocks.map((block, bi) => (
                    <section
                      key={block.key}
                      className="space-y-3 rounded-xl border border-[var(--line)] p-3"
                    >
                      <label className="block">
                        Nombre del bloque
                        <input
                          className={inputClass}
                          value={block.name}
                          onChange={(event) =>
                            change({
                              ...draft,
                              blocks: draft.blocks.map((item, index) =>
                                index === bi ? { ...item, name: event.target.value } : item,
                              ),
                            })
                          }
                        />
                      </label>
                      <label className="block">
                        Referencia oficial
                        <input
                          className={inputClass}
                          value={block.reference}
                          onChange={(event) =>
                            change({
                              ...draft,
                              blocks: draft.blocks.map((item, index) =>
                                index === bi ? { ...item, reference: event.target.value } : item,
                              ),
                            })
                          }
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={buttonClass}
                          disabled={!bi}
                          onClick={() => {
                            const blocks = [...draft.blocks];
                            [blocks[bi - 1], blocks[bi]] = [blocks[bi], blocks[bi - 1]];
                            change({ ...draft, blocks });
                          }}
                        >
                          Subir bloque
                        </button>
                        <button
                          type="button"
                          className={buttonClass}
                          disabled={bi === draft.blocks.length - 1}
                          onClick={() => {
                            const blocks = [...draft.blocks];
                            [blocks[bi + 1], blocks[bi]] = [blocks[bi], blocks[bi + 1]];
                            change({ ...draft, blocks });
                          }}
                        >
                          Bajar bloque
                        </button>
                        <button
                          type="button"
                          className={buttonClass}
                          onClick={() => {
                            if (
                              !block.topics.length ||
                              window.confirm(
                                '¿Eliminar el bloque y sus temas del borrador? También puedes mover los temas a otro bloque antes de eliminarlo.',
                              )
                            )
                              change({
                                ...draft,
                                blocks: draft.blocks.filter((_, index) => index !== bi),
                              });
                          }}
                        >
                          Eliminar bloque
                        </button>
                      </div>
                      {block.topics.map((topic, ti) => {
                        const selected = topics.find((item) => item.id === topic.topicId);
                        const candidates = topics.filter(
                          (item) =>
                            item.nombre.toLowerCase().includes(topic.name.toLowerCase()) ||
                            topic.text.toLowerCase().includes(item.nombre.toLowerCase()) ||
                            item.descripcion?.toLowerCase() === topic.text.toLowerCase(),
                        );
                        return (
                          <article
                            key={topic.key}
                            className="space-y-2 border-t border-[var(--line)] pt-3"
                          >
                            <label className="block">
                              Número oficial
                              <input
                                type="number"
                                min="1"
                                className={inputClass}
                                value={topic.number}
                                onChange={(event) =>
                                  updateTopic(bi, ti, { number: Number(event.target.value) })
                                }
                              />
                            </label>
                            <label className="block">
                              Texto oficial completo
                              <textarea
                                className={inputClass}
                                rows={4}
                                value={topic.text}
                                onChange={(event) =>
                                  updateTopic(bi, ti, { text: event.target.value })
                                }
                              />
                            </label>
                            <label className="block">
                              Nombre del tema propuesto
                              <textarea
                                className={inputClass}
                                value={topic.name}
                                onChange={(event) =>
                                  updateTopic(bi, ti, { name: event.target.value })
                                }
                              />
                            </label>
                            <label className="block">
                              Reutilización
                              <select
                                className={inputClass}
                                value={
                                  topic.decision === 'existing'
                                    ? (topic.topicId ?? '')
                                    : topic.decision
                                }
                                onChange={(event) =>
                                  updateTopic(
                                    bi,
                                    ti,
                                    event.target.value === 'new' || event.target.value === 'pending'
                                      ? { decision: event.target.value, topicId: null }
                                      : { decision: 'existing', topicId: event.target.value },
                                  )
                                }
                              >
                                <option value="pending">Decisión pendiente</option>
                                <option value="new">Crear tema nuevo</option>
                                <optgroup label="Candidatos por contenido o nombre">
                                  {candidates.map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.nombre}
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="Todos los temas existentes">
                                  {topics
                                    .filter((item) => !candidates.includes(item))
                                    .map((item) => (
                                      <option key={item.id} value={item.id}>
                                        {item.nombre}
                                      </option>
                                    ))}
                                </optgroup>
                              </select>
                            </label>
                            {selected && (
                              <div>
                                <p>
                                  Contenido existente: {selected.descripcion || selected.nombre}
                                </p>
                                <p>
                                  Vincular reutiliza también sus preguntas actuales y no modifica el
                                  tema.
                                </p>
                                {(selected.descripcion || selected.nombre) !== topic.text && (
                                  <p role="status">
                                    El contenido existente difiere del publicado. Comprueba que sus
                                    preguntas son adecuadas o crea otro tema.
                                  </p>
                                )}
                              </div>
                            )}
                            <label className="block">
                              Mover a bloque
                              <select
                                className={inputClass}
                                value={bi}
                                onChange={(event) => {
                                  const destination = Number(event.target.value);
                                  change({
                                    ...draft,
                                    blocks: draft.blocks.map((item, index) => ({
                                      ...item,
                                      topics:
                                        index === bi
                                          ? item.topics.filter((_, index) => index !== ti)
                                          : index === destination
                                            ? [...item.topics, topic]
                                            : item.topics,
                                    })),
                                  });
                                }}
                              >
                                {draft.blocks.map((item, index) => (
                                  <option key={item.key} value={index}>
                                    {item.name || `Bloque ${index + 1}`}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <button
                                className={buttonClass}
                                type="button"
                                disabled={!ti}
                                onClick={() => {
                                  const entries = [...block.topics];
                                  [entries[ti - 1], entries[ti]] = [entries[ti], entries[ti - 1]];
                                  change({
                                    ...draft,
                                    blocks: draft.blocks.map((item, index) =>
                                      index === bi ? { ...item, topics: entries } : item,
                                    ),
                                  });
                                }}
                              >
                                Subir tema
                              </button>
                              <button
                                className={buttonClass}
                                type="button"
                                disabled={ti === block.topics.length - 1}
                                onClick={() => {
                                  const entries = [...block.topics];
                                  [entries[ti + 1], entries[ti]] = [entries[ti], entries[ti + 1]];
                                  change({
                                    ...draft,
                                    blocks: draft.blocks.map((item, index) =>
                                      index === bi ? { ...item, topics: entries } : item,
                                    ),
                                  });
                                }}
                              >
                                Bajar tema
                              </button>
                              <button
                                className={buttonClass}
                                type="button"
                                onClick={() =>
                                  change({
                                    ...draft,
                                    blocks: draft.blocks.map((item, index) =>
                                      index === bi
                                        ? {
                                            ...item,
                                            topics: item.topics.filter((_, index) => index !== ti),
                                          }
                                        : item,
                                    ),
                                  })
                                }
                              >
                                Eliminar tema
                              </button>
                            </div>
                          </article>
                        );
                      })}
                      <button
                        className={buttonClass}
                        type="button"
                        onClick={() =>
                          change({
                            ...draft,
                            blocks: draft.blocks.map((item, index) =>
                              index === bi
                                ? {
                                    ...item,
                                    topics: [
                                      ...item.topics,
                                      {
                                        key: crypto.randomUUID(),
                                        number: item.topics.length + 1,
                                        text: '',
                                        name: '',
                                        decision: 'new',
                                        topicId: null,
                                      },
                                    ],
                                  }
                                : item,
                            ),
                          })
                        }
                      >
                        Añadir tema
                      </button>
                    </section>
                  ))}
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={() =>
                      change({
                        ...draft,
                        blocks: [
                          ...draft.blocks,
                          { key: crypto.randomUUID(), name: '', reference: '', topics: [] },
                        ],
                      })
                    }
                  >
                    Añadir bloque
                  </button>
                  <label className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={draft.reviewed}
                      onChange={(event) => setDraft({ ...draft, reviewed: event.target.checked })}
                    />
                    He contrastado el temario completo y las advertencias con el anuncio original.
                  </label>
                </fieldset>
                {validation && !validation.success && (
                  <p role="status">
                    Revisa los campos obligatorios, bloques vacíos, números o contenidos repetidos y
                    decisiones pendientes. Confirma la revisión del anuncio.
                  </p>
                )}
                <p>
                  Se creará una convocatoria con {draft.blocks.length} bloques,{' '}
                  {draft.blocks.flatMap((b) => b.topics).filter((t) => t.decision === 'new').length}{' '}
                  temas nuevos y{' '}
                  {
                    draft.blocks.flatMap((b) => b.topics).filter((t) => t.decision === 'existing')
                      .length
                  }{' '}
                  temas reutilizados.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={busy || !validation?.success}
                    onClick={() => void submit('confirm')}
                  >
                    {busy
                      ? 'Guardando…'
                      : attempted
                        ? 'Reintentar confirmación'
                        : 'Confirmar importación'}
                  </button>
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={busy}
                    onClick={() => {
                      setDraft(null);
                      setAttempted(false);
                      setMessage('');
                    }}
                  >
                    Cancelar borrador
                  </button>
                </div>
              </>
            )
          )}
        </div>
      )}
    </section>
  );
}
