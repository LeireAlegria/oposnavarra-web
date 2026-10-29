'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  getLearningPath,
  getPathAttempt,
  startPathChallenge,
  savePathAnswer,
  finishPathAttempt,
  abandonPathAttempt,
  challengeRequirement,
  type PathMap,
  type PathAttempt,
  type PathChallenge,
} from '@/lib/learning-path';
import { TestAnswerOptions } from '@/components/test-answer-options';
import { PathConfirmation } from '@/components/path-confirmation';
const buttonClass =
  'inline-flex min-h-12 items-center justify-center rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold disabled:opacity-50';
const primaryClass = buttonClass + ' !border-[#173c3a] !bg-[#173c3a] !text-white';
function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'No se pudo completar la operación. Vuelve a intentarlo.';
}
export function LearningPath({ initialAttemptId }: { initialAttemptId?: string }) {
  const [map, setMap] = useState<PathMap | null>(null);
  const [pathId, setPathId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<PathAttempt | null>(null);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<{ questionId: string; answerId: string | null } | null>(
    null,
  );
  const [conflict, setConflict] = useState(false);
  const [confirmation, setConfirmation] = useState<'finish' | 'abandon' | null>(null);
  const lock = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    let current = true;
    async function load() {
      try {
        let id: string | null = null;
        if (initialAttemptId) {
          const restored = await getPathAttempt(initialAttemptId);
          if (current) setAttempt(restored);
          id = restored.pathId;
        }
        const data = await getLearningPath(id);
        if (current) {
          setMap(data);
          setPathId(data.path?.id ?? null);
        }
      } catch (problem) {
        if (current) setError(message(problem));
      } finally {
        if (current) setLoading(false);
      }
    }
    void load();
    return () => {
      current = false;
      initialized.current = false;
    };
  }, [initialAttemptId]);
  useEffect(() => {
    if (!loading) headingRef.current?.focus();
  }, [index, attempt?.pathState, loading]);
  useEffect(() => {
    if (!pending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pending]);
  async function refresh(id = pathId) {
    const data = await getLearningPath(id);
    setMap(data);
    setPathId(data.path?.id ?? null);
  }
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (problem) {
      setError(message(problem));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function open(challenge: PathChallenge) {
    void run(async () => {
      const data = challenge.activeAttemptId
        ? await getPathAttempt(challenge.activeAttemptId)
        : await startPathChallenge(challenge.id);
      setAttempt(data);
      setIndex(0);
      setPending(null);
      setConflict(false);
      await refresh(data.pathId);
    });
  }
  function save(questionId: string, answerId: string | null) {
    if (!attempt || lock.current) return;
    setPending({ questionId, answerId });
    void run(async () => {
      const data = await savePathAnswer(attempt, questionId, answerId);
      setAttempt(data);
      if (data.conflict) {
        setConflict(true);
        setError(
          'Otra pestaña ha cambiado el intento. Hemos recuperado el estado confirmado. Revisa antes de aplicar tu selección.',
        );
      } else {
        setPending(null);
        setConflict(false);
      }
    });
  }
  function finalize() {
    setConfirmation(null);
    if (!attempt) return;
    void run(async () => {
      const data = await finishPathAttempt(attempt);
      setAttempt(data);
      if (data.conflict) {
        setConflict(true);
        setError(
          'El intento cambió en otra pestaña. Revisa las respuestas confirmadas antes de entregar.',
        );
      } else {
        setPending(null);
        setConflict(false);
        await refresh(data.pathId);
      }
    });
  }
  const path = map?.path;
  const all = path?.stops.flatMap((stop) => stop.challenges) ?? [];
  const active = all.find((challenge) => challenge.activeAttemptId);
  const next = active ?? all.find((challenge) => !challenge.completed && challenge.available);
  const question = attempt?.questions[index];
  const unanswered = attempt?.questions.filter((q) => !q.selectedAnswerId).length ?? 0;
  const ongoing = attempt?.pathState === 'en_curso';
  const result = attempt?.result;
  const currentChallenge = all.find((challenge) => challenge.id === attempt?.pathChallengeId);
  const currentStop = path?.stops.find((stop) =>
    stop.challenges.some((challenge) => challenge.id === attempt?.pathChallengeId),
  );
  const completedStop = Boolean(currentStop?.challenges.every((challenge) => challenge.completed));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow !text-[#a8392f]">Un paso cada día</p>
          <h1 ref={headingRef} tabIndex={-1} className="text-3xl sm:text-4xl">
            Mi camino
          </h1>
          <p className="mt-3 max-w-2xl text-[var(--muted)]">
            Tu avance en este recorrido no garantiza el dominio del temario ni una probabilidad de
            aprobar.
          </p>
        </div>
        <Link href="/plataforma?section=crear" className={buttonClass}>
          Test libres
        </Link>
      </div>
      {loading && <p role="status">Cargando tu camino…</p>}
      {error && (
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900"
        >
          <p>{error}</p>
          {!pending && (
            <button
              className={buttonClass}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (attempt) setAttempt(await getPathAttempt(attempt.id));
                  await refresh();
                  setLoading(false);
                })
              }
            >
              Recuperar estado confirmado
            </button>
          )}
        </div>
      )}
      {map && !attempt && (
        <>
          <label className="block text-sm font-semibold">
            Convocatoria
            <select
              className="mt-2 block min-h-12 w-full rounded-xl border bg-white p-3"
              value={pathId ?? ''}
              disabled={busy}
              onChange={(event) => {
                const id = event.target.value;
                setPathId(id);
                void run(() => refresh(id));
              }}
            >
              <option value="" disabled>
                Selecciona un recorrido
              </option>
              {map.paths.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.convocationName} · {item.title}
                  {item.state === 'archivado' ? ' (archivado)' : ''}
                </option>
              ))}
            </select>
          </label>
          {map.unavailableConvocations.map((name) => (
            <p key={name}>
              {name}: el recorrido de esta convocatoria todavía no está disponible. Puedes practicar
              con test libres.
            </p>
          ))}
        </>
      )}
      {map && (
        <section
          aria-label="Tu progreso"
          className="grid gap-3 rounded-2xl border border-[var(--line)] bg-white p-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div>
            <p className="text-sm text-[var(--muted)]">Temas completados</p>
            <p className="mt-1 text-xl">
              {path?.completedTopics ?? 0} de {path?.totalTopics ?? 0}
            </p>
          </div>
          <div>
            <p className="text-sm text-[var(--muted)]">Retos y repasos superados</p>
            <p className="mt-1 text-xl">
              {path?.completedChallenges ?? 0} de {path?.totalChallenges ?? 0} ·{' '}
              {path?.percentage ?? 0}%
            </p>
          </div>
          <div>
            <p className="text-sm text-[var(--muted)]">XP de este camino</p>
            <p className="mt-1 text-xl">{path?.xp ?? 0} XP</p>
          </div>
          <div>
            <p>
              Racha: {map.activity.current} días · Mejor: {map.activity.best}
            </p>
            <p role="status" className="mt-1 text-sm">
              {map.activity.dailyDone
                ? 'Objetivo de hoy cumplido'
                : 'Finaliza un test con al menos una respuesta para cumplir tu objetivo de hoy y mantener la racha.'}
            </p>
          </div>
        </section>
      )}
      {map && !map.canPractice && (
        <div className="rounded-xl border p-5">
          <p>
            Tu progreso y tus resultados se conservan. Necesitas una suscripción activa para
            iniciar, reanudar o finalizar intentos.
          </p>
          <Link className="mt-3 inline-block underline" href="/planes">
            Ver planes
          </Link>
        </div>
      )}
      {path?.state === 'archivado' && (
        <p role="status">
          Este camino está archivado. Puedes consultar tus logros y resultados y abandonar un
          intento pendiente.
        </p>
      )}
      {!attempt && path && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <h2 className="text-2xl">{path.title}</h2>
            {next && (
              <button
                className={primaryClass}
                disabled={busy || !map?.canPractice || path.state !== 'publicado'}
                onClick={() => open(next)}
              >
                Continuar · {next.title}
              </button>
            )}
          </div>
          {path.completedChallenges === path.totalChallenges && path.totalChallenges > 0 && (
            <p role="status" className="rounded-xl bg-emerald-50 p-5">
              ¡Camino completado! Puedes repetir los retos sin obtener XP adicional.
            </p>
          )}
          <ol className="ml-4 space-y-8 border-l-2 border-[#d3ddd5] pl-6 sm:ml-6 sm:pl-8">
            {path.stops.map((stop, stopIndex) => {
              const completed = stop.challenges.filter((challenge) => challenge.completed).length;
              const current = stop.challenges.some((challenge) => challenge.id === next?.id);
              return (
                <li key={stop.id} className="relative">
                  <span
                    aria-hidden="true"
                    className={`absolute -left-[34px] top-4 h-4 w-4 rounded-full border-2 border-white sm:-left-[42px] ${completed === stop.challenges.length ? 'bg-emerald-700' : current ? 'bg-[#b83b34]' : 'bg-slate-400'}`}
                  />
                  {(stopIndex === 0 || path.stops[stopIndex - 1].blockId !== stop.blockId) && (
                    <h2 className="mb-4 text-2xl">{stop.blockName}</h2>
                  )}
                  <section
                    className={`rounded-2xl border bg-white p-4 sm:p-6 ${current ? 'border-[#b83b34]' : 'border-[var(--line)]'}`}
                    aria-label={stop.title}
                  >
                    <p className="text-sm">
                      {stop.type === 'repaso_bloque'
                        ? 'Repaso obligatorio de bloque'
                        : `${completed} de 4 retos`}
                      {current ? ' · Tu parada actual' : ''}
                    </p>
                    <h3 className="mt-2 text-xl">{stop.title}</h3>
                    <p className="mt-2 text-sm">
                      {completed === stop.challenges.length
                        ? '✓ Parada completada'
                        : stop.challenges.some((challenge) => challenge.available)
                          ? '○ Parada disponible'
                          : '🔒 Parada bloqueada'}
                    </p>
                    <ol className="mt-5 space-y-4">
                      {stop.challenges.map((challenge) => (
                        <li key={challenge.id} className="space-y-3 border-t pt-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="font-semibold">{challenge.title}</h4>
                            <span>
                              {challenge.completed
                                ? '✓ Completado'
                                : challenge.available
                                  ? '○ Disponible'
                                  : '🔒 Bloqueado'}
                            </span>
                          </div>
                          <p className="text-sm">
                            {challenge.questionCount} preguntas · Sin límite de tiempo ·{' '}
                            {challenge.xp} XP en la primera superación.
                          </p>
                          <p className="text-sm">{challengeRequirement(challenge)}</p>
                          <p className="text-sm text-[var(--muted)]">
                            Estimación orientativa: {Math.ceil(challenge.questionCount / 2)}–
                            {challenge.questionCount} minutos; varía según tu ritmo de lectura y
                            respuesta.
                          </p>
                          {challenge.best !== null && <p>Mejor resultado: {challenge.best}%</p>}
                          {!challenge.available && !challenge.completed && (
                            <p className="text-sm">
                              Supera el reto o repaso anterior para abrir este paso.
                            </p>
                          )}
                          <div className="flex flex-wrap gap-3">
                            {(challenge.available || challenge.completed) && (
                              <button
                                className={buttonClass}
                                disabled={busy || !map?.canPractice || path.state !== 'publicado'}
                                onClick={() => open(challenge)}
                              >
                                {challenge.activeAttemptId
                                  ? 'Reanudar'
                                  : challenge.completed
                                    ? 'Repetir'
                                    : 'Empezar'}
                              </button>
                            )}
                            {challenge.activeAttemptId && (
                              <button
                                className={buttonClass}
                                disabled={busy}
                                onClick={() =>
                                  void run(async () => {
                                    setAttempt(await getPathAttempt(challenge.activeAttemptId!));
                                    setIndex(0);
                                  })
                                }
                              >
                                Ver intento pendiente
                              </button>
                            )}
                            {challenge.lastAttemptId && (
                              <button
                                className={buttonClass}
                                disabled={busy}
                                onClick={() =>
                                  void run(async () => {
                                    setAttempt(await getPathAttempt(challenge.lastAttemptId!));
                                    setIndex(0);
                                  })
                                }
                              >
                                Ver resultado
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                </li>
              );
            })}
          </ol>
        </>
      )}
      {!loading && !path && !attempt && (
        <p>
          El recorrido de esta convocatoria todavía no está disponible.{' '}
          <Link className="underline" href="/plataforma?section=crear">
            Ir a test libres
          </Link>
          .
        </p>
      )}
      {attempt && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl">{attempt.pathTitle}</h2>
            <button
              className={buttonClass}
              disabled={busy || Boolean(pending)}
              onClick={() => {
                setAttempt(null);
                setIndex(0);
              }}
            >
              Volver al mapa · Conservar intento
            </button>
          </div>
          <p>
            {challengeRequirement({
              ...attempt.pathEvaluation,
              questionCount: attempt.questionCount,
            })}
          </p>
          {attempt.pathState === 'invalidado' && (
            <div role="status" className="rounded-xl border bg-amber-50 p-5">
              El contenido cambió durante este intento. Se ha invalidado sin suspenso, XP ni
              actividad diaria. Puedes empezar otro.
            </div>
          )}
          {attempt.pathState === 'abandonado' && (
            <p role="status">Has abandonado este intento sin penalización ni recompensa.</p>
          )}
          {result && attempt.pathState === 'finalizado' && (
            <section
              aria-label="Resultado del camino"
              className="space-y-4 rounded-2xl border bg-white p-5"
            >
              <h3 className="text-2xl">
                {attempt.pathPassed ? '¡Reto superado!' : 'Sigue practicando, puedes reintentarlo'}
              </h3>
              <p>
                {result.aciertos} aciertos · {result.fallos} errores · {result.enBlanco} en blanco ·{' '}
                {result.porcentajeAciertos}%
              </p>
              <p>
                Duración: {Math.floor(result.tiempoEmpleadoSegundos / 60)} min{' '}
                {result.tiempoEmpleadoSegundos % 60} s.
              </p>
              <p>
                XP obtenida en este intento: {attempt.pathXpEarned ?? 0}. Mejor marca:{' '}
                {currentChallenge?.best ?? result.porcentajeAciertos}%.
              </p>
              {!attempt.pathPassed && (
                <p>
                  {attempt.pathEvaluation.criterion === 'finalizacion'
                    ? 'Responde al menos una pregunta para completar esta iniciación.'
                    : `Te faltaron ${Math.max(0, attempt.pathEvaluation.minimum - result.aciertos)} aciertos para alcanzar el mínimo.`}
                </p>
              )}
              {(attempt.pathXpEarned ?? 0) > 0 && completedStop && (
                <p role="status">
                  {path?.completedChallenges === path?.totalChallenges
                    ? '¡Has completado el camino!'
                    : currentStop?.type === 'repaso_bloque'
                      ? '¡Bloque completado! Se abre el siguiente tramo.'
                      : '¡Tema completado! Se abre tu siguiente paso.'}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                {!attempt.pathPassed && currentChallenge && (
                  <button
                    className={primaryClass}
                    disabled={busy || !attempt.canPractice}
                    onClick={() => open(currentChallenge)}
                  >
                    Reintentar
                  </button>
                )}
                {attempt.pathPassed && next && (
                  <button
                    className={primaryClass}
                    disabled={busy || !attempt.canPractice}
                    onClick={() => open(next)}
                  >
                    Continuar · {next.title}
                  </button>
                )}
              </div>
            </section>
          )}
          {pending && (
            <div role="status" className="space-y-3 rounded-xl border bg-amber-50 p-4">
              <p>
                {conflict
                  ? 'Conflicto entre pestañas: la selección pendiente aún no se ha aplicado.'
                  : 'Tienes una respuesta pendiente de sincronizar. No se ha confirmado su guardado.'}
              </p>
              <button
                className={buttonClass}
                disabled={busy}
                onClick={() => save(pending.questionId, pending.answerId)}
              >
                {conflict ? 'Aplicar mi selección tras revisar' : 'Reintentar guardado'}
              </button>
              <button
                className={buttonClass}
                disabled={busy}
                onClick={() => {
                  setPending(null);
                  setConflict(false);
                }}
              >
                Descartar cambio no guardado
              </button>
            </div>
          )}
          {question && (
            <div className="space-y-5 rounded-2xl border bg-white p-5 sm:p-7">
              <p aria-live="polite">
                Pregunta {index + 1} de {attempt.questions.length}
              </p>
              <progress
                className="w-full accent-[#173c3a]"
                max={attempt.questionCount}
                value={attempt.questions.filter((q) => q.selectedAnswerId).length}
                aria-label="Preguntas respondidas"
              />
              <h3 className="text-xl leading-8">{question.text}</h3>
              {question.contentChanged && (
                <p role="status" className="rounded border bg-amber-50 p-3">
                  El contenido se ha modificado desde este intento. La revisión muestra la versión
                  actual; el resultado histórico no cambia.
                </p>
              )}
              <TestAnswerOptions
                question={
                  pending?.questionId === question.id
                    ? { ...question, selectedAnswerId: pending.answerId }
                    : question
                }
                showCorrection={attempt.pathState === 'finalizado'}
                disabled={busy || !ongoing || !attempt.canPractice || conflict}
                onAnswer={(id) => save(question.id, id)}
              />
              {question.explanation && attempt.pathState === 'finalizado' && (
                <p className="whitespace-pre-wrap leading-7">{question.explanation}</p>
              )}
              <p role="status">
                {busy
                  ? 'Procesando…'
                  : pending
                    ? 'Pendiente de sincronizar'
                    : ongoing && question.selectedAnswerId
                      ? 'Respuesta guardada en el servidor'
                      : ''}
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  className={buttonClass}
                  disabled={index === 0 || busy || Boolean(pending)}
                  onClick={() => setIndex((value) => value - 1)}
                >
                  Anterior
                </button>
                <button
                  className={buttonClass}
                  disabled={index >= attempt.questions.length - 1 || busy || Boolean(pending)}
                  onClick={() => setIndex((value) => value + 1)}
                >
                  Siguiente pregunta
                </button>
              </div>
              <nav aria-label="Navegación por preguntas" className="flex flex-wrap gap-2">
                {attempt.questions.map((q, n) => (
                  <button
                    key={q.id}
                    className={buttonClass}
                    disabled={busy || Boolean(pending)}
                    aria-current={n === index ? 'step' : undefined}
                    aria-label={`Pregunta ${n + 1}${q.selectedAnswerId ? ', respondida' : ', en blanco'}`}
                    onClick={() => setIndex(n)}
                  >
                    {n + 1}
                    {q.selectedAnswerId ? ' ✓' : ''}
                  </button>
                ))}
              </nav>
            </div>
          )}
          {ongoing && (
            <div className="flex flex-wrap gap-3">
              <button
                className={primaryClass}
                disabled={busy || !attempt.canPractice || Boolean(pending)}
                onClick={() => {
                  if (unanswered > 0) setConfirmation('finish');
                  else finalize();
                }}
              >
                Entregar test
              </button>
              <button
                className={buttonClass}
                disabled={busy}
                onClick={() => setConfirmation('abandon')}
              >
                Abandonar intento
              </button>
            </div>
          )}
        </section>
      )}
      {confirmation && (
        <PathConfirmation
          title={
            confirmation === 'finish'
              ? '¿Entregar con preguntas en blanco?'
              : '¿Abandonar este intento?'
          }
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            if (confirmation === 'finish') finalize();
            else {
              setConfirmation(null);
              if (attempt)
                void run(async () => {
                  setAttempt(await abandonPathAttempt(attempt.id));
                  setPending(null);
                  await refresh(attempt.pathId);
                });
            }
          }}
        >
          {confirmation === 'finish'
            ? `Quedan ${unanswered} preguntas sin contestar. Los blancos cuentan como no acertados.`
            : 'Conservarás tus logros anteriores. Este intento no dará XP ni contará para el objetivo diario.'}
        </PathConfirmation>
      )}
    </div>
  );
}
