'use client';

import { useState } from 'react';
import {
  defaultDecisions,
  MAX_IMPORT_BYTES,
  normalizeImportText,
  reviewRows,
  type ImportDecision,
  type ImportPreview,
  type ImportSettings,
} from '@/lib/question-import/model';

const buttonClass =
  'min-h-10 rounded-lg border border-[#e5e1d8] bg-white px-4 py-2 text-sm font-medium hover:bg-[#f7f5f0] focus-visible:outline-2 focus-visible:outline-[#bd3734] disabled:opacity-40';
const primaryClass =
  'min-h-10 rounded-lg bg-[#bd3734] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a82f2c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd3734] disabled:opacity-40';
const inputClass =
  'mt-1 w-full rounded-lg border border-[#d9d5cc] bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[#bd3734]';

export function QuestionImport({
  exams,
  onSaved,
}: {
  exams: { id: string; nombre: string }[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<ImportSettings['origin'] | ''>('');
  const [reference, setReference] = useState('');
  const [examId, setExamId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [decisions, setDecisions] = useState<ImportDecision[]>([]);
  const [busy, setBusy] = useState<'preview' | 'confirm' | 'template' | null>(null);
  const [message, setMessage] = useState('');
  const [operationId, setOperationId] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [needsReview, setNeedsReview] = useState(false);
  const [result, setResult] = useState<{ created: number; excluded: number } | null>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const rows = preview ? reviewRows(preview, decisions, !!examId) : [];
  const included = rows.filter((item) => item.decision?.included);
  const errors = included.filter((item) => item.issues.length);
  const pendingTopics = included.filter((item) => item.pendingTopic);
  const pendingDuplicates = included.filter((item) => item.pendingDuplicate);
  const canConfirm =
    included.length > 0 &&
    !errors.length &&
    !pendingTopics.length &&
    !pendingDuplicates.length &&
    !needsReview;
  const filtered = rows.filter(
    (item) =>
      (filter === 'all' ||
        (filter === 'errors' && item.issues.length > 0) ||
        (filter === 'topics' && item.pendingTopic) ||
        (filter === 'duplicates' && item.duplicate) ||
        (filter === 'excluded' && !item.decision?.included)) &&
      `${item.row.rowNumber} ${item.row.text} ${item.row.topic}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, totalPages);
  function invalidate() {
    setPreview(null);
    setDecisions([]);
    setConfirming(false);
    setReviewed(false);
    setMessage('');
    setResult(null);
    setUncertain(false);
    setNeedsReview(false);
    setPage(1);
    setFilter('all');
    setSearch('');
  }
  function resolve(rowNumber: number, patch: Partial<ImportDecision>, sameTopic = false) {
    const source = preview?.rows.find((row) => row.rowNumber === rowNumber)?.topic;
    setDecisions((current) =>
      current.map((decision) =>
        decision.rowNumber === rowNumber ||
        (sameTopic &&
          normalizeImportText(
            preview?.rows.find((row) => row.rowNumber === decision.rowNumber)?.topic ?? '',
          ) === normalizeImportText(source ?? ''))
          ? { ...decision, ...patch }
          : decision,
      ),
    );
    setConfirming(false);
    setReviewed(false);
    setMessage('');
  }
  async function template() {
    setBusy('template');
    setMessage('');
    try {
      const response = await fetch('/api/admin/question-import');
      if (!response.ok)
        throw new Error('No se pudo descargar la plantilla. Comprueba tu sesión de administrador.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'plantilla-preguntas.xlsx';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo descargar la plantilla.');
    } finally {
      setBusy(null);
    }
  }
  async function submit(action: 'preview' | 'confirm') {
    if (
      !file ||
      !origin ||
      (origin === 'examen_oficial' && !examId) ||
      (action === 'confirm' && (!canConfirm || !reviewed))
    )
      return;
    setBusy(action);
    setMessage('');
    const form = new FormData();
    form.set('action', action);
    form.set('file', file);
    form.set('settings', JSON.stringify({ origin, reference, examId: examId || null }));
    if (action === 'confirm') {
      form.set('operationId', operationId);
      form.set('reviewed', 'true');
      form.set('decisions', JSON.stringify(decisions));
      form.set(
        'duplicateSnapshots',
        JSON.stringify(
          preview?.catalog.duplicates.map((item) => ({
            rowNumber: item.rowNumber,
            ids: item.candidates.map((candidate) => candidate.id),
            versions: item.candidates.map((candidate) => ({
              id: candidate.id,
              version: candidate.version ?? '',
            })),
          })) ?? [],
        ),
      );
      form.set(
        'topicSnapshots',
        JSON.stringify(
          preview?.catalog.topics.filter((topic) =>
            decisions.some((decision) => decision.included && decision.topicId === topic.id),
          ) ?? [],
        ),
      );
    }
    let receivedResponse = false;
    try {
      const response = await fetch('/api/admin/question-import', { method: 'POST', body: form });
      const data = await response.json();
      receivedResponse = true;
      if (!response.ok) {
        if (action === 'confirm' && data.uncertain) setUncertain(true);
        if (action === 'confirm' && data.needsReview) setNeedsReview(true);
        throw new Error(data.message || 'No se pudo completar la importación.');
      }
      if (action === 'preview') {
        setPreview(data);
        setDecisions(defaultDecisions(data.rows));
        setOperationId(crypto.randomUUID());
        setConfirming(false);
        setReviewed(false);
        setUncertain(false);
        setNeedsReview(false);
        setPage(1);
      } else {
        setResult(data);
        setUncertain(false);
        onSaved();
      }
    } catch (error) {
      if (action === 'confirm' && !receivedResponse) {
        setUncertain(true);
        setMessage(
          'No se pudo recibir el resultado. Reintenta la misma confirmación para recuperar la operación sin duplicarla.',
        );
      } else
        setMessage(
          error instanceof Error
            ? error.message
            : 'No se pudo leer el archivo. Inténtalo de nuevo.',
        );
    } finally {
      setBusy(null);
    }
  }
  return (
    <section
      className="min-w-0 rounded-2xl border border-[#e5e1d8] bg-white p-4 sm:p-6 xl:col-span-2"
      aria-label="Importación masiva de preguntas"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[#302f2b]">Importación desde Excel</h3>
          <p className="mt-1 text-sm text-[#777468]">
            Carga preguntas, revisa las incidencias y confirma el lote.
          </p>
        </div>
        <button
          type="button"
          className={buttonClass}
          aria-expanded={open}
          disabled={!!busy}
          onClick={() => setOpen(!open)}
        >
          {open ? 'Ocultar importación' : 'Importar preguntas'}
        </button>
      </div>
      {open && (
        <div className="mt-6 space-y-5">
          <ol className="flex flex-wrap gap-x-5 gap-y-2 border-b border-[#eeeae3] pb-4 text-sm">
            <li className={!preview ? 'font-semibold text-[#a82f2c]' : 'text-[#777468]'}>
              1. Preparar archivo
            </li>
            <li
              className={
                preview && !confirming && !result
                  ? 'font-semibold text-[#a82f2c]'
                  : 'text-[#777468]'
              }
            >
              2. Revisar preguntas
            </li>
            <li
              className={confirming || result ? 'font-semibold text-[#a82f2c]' : 'text-[#777468]'}
            >
              3. Confirmar importación
            </li>
          </ol>
          {message && (
            <p
              role="alert"
              className="rounded-lg border border-[#edc5bf] bg-[#fff5f2] p-3 text-sm text-[#a82f2c]"
            >
              {message}
            </p>
          )}
          {busy && (
            <p role="status" className="text-sm text-[#777468]">
              {busy === 'preview'
                ? 'Leyendo el Excel y contrastando las preguntas con el banco…'
                : busy === 'template'
                  ? 'Preparando plantilla…'
                  : 'Guardando todas las preguntas del lote…'}
            </p>
          )}
          {result ? (
            <div className="space-y-3 rounded-xl bg-[#f2f8f3] p-5" role="status">
              <h4 className="font-semibold">Importación completada</h4>
              <p>
                {result.created} preguntas creadas en revisión · {result.excluded} filas excluidas.
              </p>
              <p>Las preguntas todavía no están publicadas.</p>
              <a
                className="block font-medium text-[#a82f2c] underline"
                href={`/admin?seccion=preguntas&estado=revision${examId ? `&examen=${examId}` : ''}`}
              >
                Abrir preguntas importadas
              </a>
              <button
                type="button"
                className={buttonClass}
                onClick={() => {
                  invalidate();
                  setFile(null);
                }}
              >
                Preparar otra importación
              </button>
            </div>
          ) : (
            <>
              <fieldset disabled={!!busy || uncertain} className="space-y-4">
                {!preview && (
                  <>
                    <div className="rounded-xl bg-[#f7f5f0] p-4">
                      <p className="text-sm">
                        Un único archivo <strong>.xlsx</strong>, hasta{' '}
                        <strong>5 MiB y 1.000 preguntas</strong>. Cuatro opciones y una respuesta
                        correcta por fila. Sin fórmulas ni imágenes.
                      </p>
                      <button
                        type="button"
                        className={`${buttonClass} mt-3`}
                        onClick={() => void template()}
                      >
                        Descargar plantilla .xlsx
                      </button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="text-sm font-medium">
                        Procedencia
                        <select
                          className={inputClass}
                          value={origin}
                          onChange={(event) => {
                            invalidate();
                            setOrigin(event.target.value as typeof origin);
                          }}
                        >
                          <option value="">Selecciona la procedencia…</option>
                          <option value="examen_oficial">Examen oficial</option>
                          <option value="generada_documentacion">
                            Generadas desde documentación
                          </option>
                        </select>
                      </label>
                      <label className="text-sm font-medium">
                        Examen de destino{' '}
                        {origin === 'examen_oficial' ? '(obligatorio)' : '(opcional)'}
                        <select
                          className={inputClass}
                          value={examId}
                          onChange={(event) => {
                            invalidate();
                            setExamId(event.target.value);
                          }}
                        >
                          <option value="">Sin examen asociado</option>
                          {exams.map((exam) => (
                            <option key={exam.id} value={exam.id}>
                              {exam.nombre}
                            </option>
                          ))}
                        </select>
                        {!exams.length && (
                          <span className="mt-1 block text-xs text-[#777468]">
                            No hay exámenes. Créalo antes de importar preguntas oficiales.
                          </span>
                        )}
                      </label>
                    </div>
                    <label className="block text-sm font-medium">
                      Referencia de la fuente (opcional)
                      <input
                        className={inputClass}
                        value={reference}
                        onChange={(event) => {
                          invalidate();
                          setReference(event.target.value);
                        }}
                        placeholder="Documento, URL o versión utilizada"
                      />
                    </label>
                  </>
                )}
                <div className="flex flex-wrap items-end gap-3">
                  <label className="min-w-0 flex-1 text-sm font-medium">
                    {preview
                      ? 'Sustituir Excel e iniciar una nueva revisión'
                      : 'Archivo de preguntas'}
                    <input
                      key={result ? 'done' : 'file'}
                      type="file"
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-[#f2efe8] file:px-3 file:py-1`}
                      onChange={(event) => {
                        const selected = event.target.files?.[0] ?? null;
                        invalidate();
                        setFile(null);
                        if (
                          selected &&
                          (!/\.xlsx$/i.test(selected.name) ||
                            selected.size > MAX_IMPORT_BYTES ||
                            !selected.size)
                        ) {
                          setMessage('Selecciona un archivo .xlsx con datos de hasta 5 MiB.');
                          return;
                        }
                        setFile(selected);
                      }}
                    />
                  </label>
                  <button
                    className={primaryClass}
                    type="button"
                    disabled={!file || !origin || (origin === 'examen_oficial' && !examId)}
                    onClick={() => void submit('preview')}
                  >
                    {preview ? 'Volver a revisar el archivo' : 'Validar y revisar'}
                  </button>
                </div>
                {preview && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#777468]">
                    <p>
                      {file?.name} ·{' '}
                      {origin === 'examen_oficial'
                        ? 'Examen oficial'
                        : 'Generadas desde documentación'}{' '}
                      · {preview.catalog.examName || 'Sin examen'}
                      {preview.catalog.convocationNames.length > 0
                        ? ` · Convocatorias: ${preview.catalog.convocationNames.join(', ')}`
                        : ''}
                    </p>
                    <button type="button" className={buttonClass} onClick={invalidate}>
                      Cambiar preparación
                    </button>
                  </div>
                )}
              </fieldset>
              {preview && (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    {[
                      [preview.rows.length, 'Detectadas'],
                      [included.length - errors.length, 'Válidas incluidas'],
                      [errors.length, 'Con errores'],
                      [pendingTopics.length, 'Temas pendientes'],
                      [included.filter((item) => item.duplicate).length, 'Posibles duplicados'],
                      [rows.length - included.length, 'Excluidas'],
                    ].map(([count, label]) => (
                      <div key={label} className="rounded-lg bg-[#f7f5f0] p-3">
                        <p className="text-xl font-semibold">{count}</p>
                        <p className="mt-1 text-xs text-[#777468]">{label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-[#777468]">
                    Las validaciones no comprueban la corrección académica. Corrige enunciados y
                    opciones en Excel y vuelve a subirlo. Sin tema:{' '}
                    {
                      included.filter(
                        (item) => item.decision?.topicResolved && !item.decision.topicId,
                      ).length
                    }{' '}
                    preguntas.
                  </p>
                  <fieldset disabled={!!busy || uncertain} className="min-w-0 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-medium">
                        Buscar fila, contenido o tema
                        <input
                          className={inputClass}
                          value={search}
                          onChange={(event) => {
                            setSearch(event.target.value);
                            setPage(1);
                          }}
                        />
                      </label>
                      <label className="text-xs font-medium">
                        Mostrar
                        <select
                          className={inputClass}
                          value={filter}
                          onChange={(event) => {
                            setFilter(event.target.value);
                            setPage(1);
                          }}
                        >
                          <option value="all">Todas las filas</option>
                          <option value="errors">Con errores</option>
                          <option value="topics">Con tema pendiente</option>
                          <option value="duplicates">Posibles duplicados</option>
                          <option value="excluded">Excluidas</option>
                        </select>
                      </label>
                    </div>
                    <div className="divide-y divide-[#eeeae3] rounded-xl border border-[#e5e1d8]">
                      {filtered.slice((currentPage - 1) * 20, currentPage * 20).map((item) => {
                        const { row, decision } = item;
                        const candidates = preview.catalog.topics.filter(
                          (topic) =>
                            normalizeImportText(topic.nombre) === normalizeImportText(row.topic),
                        );
                        const selected = preview.catalog.topics.find(
                          (topic) => topic.id === decision?.topicId,
                        );
                        return (
                          <article
                            key={row.rowNumber}
                            className={`min-w-0 p-3 sm:p-4 ${!decision?.included ? 'bg-[#f7f5f0]' : ''}`}
                          >
                            <div className="flex items-start gap-3">
                              <label className="flex shrink-0 items-center gap-2 py-1 text-xs">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-[#bd3734]"
                                  checked={decision?.included ?? false}
                                  onChange={(event) =>
                                    resolve(row.rowNumber, { included: event.target.checked })
                                  }
                                />
                                Fila {row.rowNumber}
                              </label>
                              <details className="min-w-0 flex-1">
                                <summary className="cursor-pointer break-words text-sm font-medium leading-6">
                                  {row.text
                                    ? row.text.slice(0, 180) + (row.text.length > 180 ? '…' : '')
                                    : 'Sin enunciado'}
                                  <span className="mt-1 block text-xs font-normal text-[#777468]">
                                    {!decision?.included
                                      ? 'Excluida'
                                      : item.issues.length
                                        ? `${item.issues.length} incidencias`
                                        : item.pendingTopic
                                          ? 'Tema pendiente'
                                          : item.pendingDuplicate
                                            ? 'Revisar duplicado'
                                            : 'Lista para importar'}
                                    {row.number !== null ? ` · Número ${row.number}` : ''}
                                  </span>
                                </summary>
                                <div className="mt-4 space-y-3">
                                  <p className="whitespace-pre-wrap break-words text-sm">
                                    {row.text}
                                  </p>
                                  <ol className="space-y-2">
                                    {row.options.map((option, index) => (
                                      <li
                                        key={index}
                                        className={`whitespace-pre-wrap break-words rounded-lg p-3 text-sm ${row.correctAnswer === 'ABCD'[index] ? 'bg-[#edf5ef] text-[#31583a]' : 'bg-[#f7f5f0]'}`}
                                      >
                                        <strong>{'ABCD'[index]}.</strong> {option || '(vacía)'}
                                        {row.correctAnswer === 'ABCD'[index] && (
                                          <span className="ml-2 text-xs font-semibold">
                                            Respuesta correcta
                                          </span>
                                        )}
                                      </li>
                                    ))}
                                  </ol>
                                  {row.explanation && (
                                    <p className="whitespace-pre-wrap break-words text-sm">
                                      <strong>Explicación:</strong> {row.explanation}
                                    </p>
                                  )}
                                  {item.issues.length > 0 && (
                                    <ul className="space-y-1 rounded-lg bg-[#fff5f2] p-3 text-xs text-[#a82f2c]">
                                      {item.issues.map((issue, index) => (
                                        <li key={index}>
                                          Fila {row.rowNumber} · {issue.column}: {issue.message}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                  <div className="rounded-lg border border-[#e5e1d8] p-3">
                                    <p className="text-xs text-[#777468]">
                                      Tema en Excel: {row.topic || 'Vacío: se importará sin tema'}
                                    </p>
                                    {row.topic && (
                                      <>
                                        <label className="mt-2 block text-xs font-medium">
                                          Resolver tema de fila {row.rowNumber}
                                          <select
                                            className={inputClass}
                                            value={
                                              decision?.topicResolved
                                                ? decision.topicId || 'none'
                                                : 'pending'
                                            }
                                            onChange={(event) =>
                                              resolve(row.rowNumber, {
                                                topicResolved: event.target.value !== 'pending',
                                                topicId: ['pending', 'none'].includes(
                                                  event.target.value,
                                                )
                                                  ? null
                                                  : event.target.value,
                                              })
                                            }
                                          >
                                            <option value="pending">
                                              Selecciona un tema o decide dejarla sin tema…
                                            </option>
                                            <option value="none">
                                              Dejar explícitamente sin tema
                                            </option>
                                            {candidates.length > 0 && (
                                              <optgroup
                                                label={
                                                  candidates.length === 1
                                                    ? 'Coincidencia propuesta (requiere aceptar)'
                                                    : 'Coincidencias: elige el contenido adecuado'
                                                }
                                              >
                                                {candidates.map((topic) => (
                                                  <option key={topic.id} value={topic.id}>
                                                    {topic.nombre}
                                                    {topic.descripcion
                                                      ? ` — ${topic.descripcion.slice(0, 120)}`
                                                      : ' — Sin descripción'}
                                                  </option>
                                                ))}
                                              </optgroup>
                                            )}
                                            <optgroup label="Otros temas del catálogo">
                                              {preview.catalog.topics
                                                .filter((topic) => !candidates.includes(topic))
                                                .map((topic) => (
                                                  <option key={topic.id} value={topic.id}>
                                                    {topic.nombre}
                                                    {topic.descripcion
                                                      ? ` — ${topic.descripcion.slice(0, 120)}`
                                                      : ' — Sin descripción'}
                                                  </option>
                                                ))}
                                            </optgroup>
                                          </select>
                                        </label>
                                        {!candidates.length && (
                                          <p className="mt-2 text-xs text-[#a82f2c]">
                                            No se encontró una coincidencia. Elige un tema existente
                                            o deja la pregunta sin tema.
                                          </p>
                                        )}
                                        {selected && (
                                          <p className="mt-2 whitespace-pre-wrap text-xs text-[#777468]">
                                            Contenido del tema:{' '}
                                            {selected.descripcion || 'Sin descripción disponible.'}
                                          </p>
                                        )}
                                        <button
                                          type="button"
                                          className={`${buttonClass} mt-2`}
                                          disabled={!decision?.topicResolved}
                                          onClick={() =>
                                            resolve(
                                              row.rowNumber,
                                              {
                                                topicResolved: true,
                                                topicId: decision?.topicId ?? null,
                                              },
                                              true,
                                            )
                                          }
                                        >
                                          Aplicar a todas las filas con «{row.topic}»
                                        </button>
                                      </>
                                    )}
                                  </div>
                                  {item.duplicate && (
                                    <div className="space-y-3 rounded-lg border border-[#e4c998] bg-[#fffbf2] p-3">
                                      <h5 className="text-sm font-semibold">Posibles duplicados</h5>
                                      {item.internalDuplicates.map((other) => (
                                        <details key={other.rowNumber}>
                                          <summary className="cursor-pointer text-xs">
                                            Coincide con la fila {other.rowNumber} del archivo
                                          </summary>
                                          <p className="mt-2 whitespace-pre-wrap text-xs">
                                            {other.text}
                                          </p>
                                          {other.options.map((option, index) => (
                                            <p key={index} className="whitespace-pre-wrap text-xs">
                                              {'ABCD'[index]}. {option}
                                              {other.correctAnswer === 'ABCD'[index]
                                                ? ' · Correcta'
                                                : ''}
                                            </p>
                                          ))}
                                        </details>
                                      ))}
                                      {item.candidates.map((candidate) => (
                                        <details key={candidate.id}>
                                          <summary className="cursor-pointer break-words text-xs">
                                            Banco: {candidate.text.slice(0, 180)} ·{' '}
                                            {candidate.exact
                                              ? 'Enunciado y opciones coinciden'
                                              : 'Enunciado coincidente'}
                                          </summary>
                                          {candidate.options.map((option, index) => (
                                            <p
                                              key={index}
                                              className="mt-2 whitespace-pre-wrap break-words text-xs"
                                            >
                                              {'ABCD'[index]}. {option.text}
                                              {option.correct ? ' · Correcta' : ''}
                                            </p>
                                          ))}
                                        </details>
                                      ))}
                                      <label className="flex items-start gap-2 text-xs">
                                        <input
                                          type="checkbox"
                                          checked={decision?.duplicateAccepted ?? false}
                                          onChange={(event) =>
                                            resolve(row.rowNumber, {
                                              duplicateAccepted: event.target.checked,
                                            })
                                          }
                                        />
                                        He revisado las coincidencias y confirmo crear esta fila
                                        como pregunta nueva.
                                      </label>
                                      <p className="text-xs">
                                        También puedes excluir la fila desmarcando su casilla.
                                        Confirmar un duplicado no permite repetir números del
                                        examen.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </details>
                            </div>
                          </article>
                        );
                      })}
                      {!filtered.length && (
                        <p className="p-5 text-sm text-[#777468]">No hay filas con este filtro.</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-[#777468]">
                        {filtered.length} filas · Página {currentPage} de {totalPages}
                      </p>
                      <div className="flex gap-2">
                        <button
                          className={buttonClass}
                          type="button"
                          disabled={currentPage === 1}
                          onClick={() => setPage(currentPage - 1)}
                        >
                          Anterior
                        </button>
                        <button
                          className={buttonClass}
                          type="button"
                          disabled={currentPage === totalPages}
                          onClick={() => setPage(currentPage + 1)}
                        >
                          Siguiente
                        </button>
                      </div>
                    </div>
                  </fieldset>
                  {confirming && (
                    <section
                      className="space-y-3 rounded-xl border border-[#d9d5cc] bg-[#f7f5f0] p-4"
                      aria-label="Confirmar lote"
                    >
                      <h4 className="font-semibold">Confirmar importación</h4>
                      <p className="text-sm">
                        Se crearán {included.length} preguntas en revisión y se excluirán{' '}
                        {rows.length - included.length} filas. Examen:{' '}
                        {preview.catalog.examName || 'Sin examen asociado'}. Fuente:{' '}
                        {reference || 'Sin referencia adicional'}.
                      </p>
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={reviewed}
                          disabled={!!busy || uncertain}
                          onChange={(event) => setReviewed(event.target.checked)}
                        />
                        He revisado el contenido, las respuestas correctas, los temas y los posibles
                        duplicados.
                      </label>
                    </section>
                  )}
                  <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5e1d8] bg-white p-3 shadow-lg shadow-black/5">
                    <p className="text-xs text-[#777468]">
                      {needsReview
                        ? 'El catálogo ha cambiado o el lote fue rechazado. Vuelve a revisar el archivo.'
                        : !included.length
                          ? 'Incluye al menos una fila.'
                          : !canConfirm
                            ? `${errors.length} filas con errores · ${pendingTopics.length} temas pendientes · ${pendingDuplicates.length} duplicados pendientes`
                            : `${included.length} preguntas listas para importar en revisión.`}
                    </p>
                    <button
                      className={primaryClass}
                      type="button"
                      disabled={!!busy || !canConfirm || (confirming && !reviewed)}
                      onClick={() => {
                        if (!confirming) {
                          setConfirming(true);
                          setReviewed(false);
                        } else void submit('confirm');
                      }}
                    >
                      {busy === 'confirm'
                        ? 'Importando…'
                        : uncertain
                          ? 'Recuperar resultado de la importación'
                          : `Importar ${included.length} preguntas`}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
