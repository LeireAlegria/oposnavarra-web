'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  QUESTION_COUNT_OPTIONS,
  TIME_LIMIT_OPTIONS,
  demoExam,
  finalizeAttempt,
  generateAttempt,
  getExamAvailableQuestionCount,
  updateAttemptAnswer,
  type AttemptRecord,
} from '@/lib/exam-engine';

const STORAGE_KEY = 'oposnavarra-test-platform-v1';

type TabKey = 'crear' | 'curso' | 'resultados';

function formatSeconds(seconds: number) {
  if (!seconds || Number.isNaN(seconds)) {
    return 'Sin límite';
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function TestPlatform() {
  const [activeTab, setActiveTab] = useState<TabKey>('crear');
  const [topicIds, setTopicIds] = useState<string[]>(demoExam.topics.map((topic) => topic.id));
  const [questionCount, setQuestionCount] = useState<number>(20);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number>(0);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [activeAttempt, setActiveAttempt] = useState<AttemptRecord | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isFinishConfirmationOpen, setIsFinishConfirmationOpen] = useState(false);

  const availableQuestions = useMemo(() => getExamAvailableQuestionCount(topicIds), [topicIds]);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      setIsReady(true);
      return;
    }

    try {
      const parsed = JSON.parse(saved) as AttemptRecord[];
      setAttempts(parsed);
      const lastInProgress = parsed.find((entry) => entry.status === 'in_progress') ?? null;
      if (lastInProgress) {
        setActiveAttempt(lastInProgress);
        setActiveTab('curso');
      }
    } catch {
      setAttempts([]);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));
  }, [attempts, isReady]);

  useEffect(() => {
    if (!activeAttempt || activeAttempt.status !== 'in_progress') {
      return;
    }

    const updateClock = () => {
      const now = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((now - new Date(activeAttempt.startedAt).getTime()) / 1000)));

      if (
        activeAttempt.timeLimitSeconds > 0 &&
        activeAttempt.expiresAt &&
        new Date(activeAttempt.expiresAt).getTime() <= now
      ) {
        const finalAttempt = finalizeAttempt({
          ...activeAttempt,
          questions: activeAttempt.questions.map((question) => ({
            ...question,
            selectedAnswerId: question.selectedAnswerId ?? null,
          })),
          status: 'finalizado',
        });

        setAttempts((current) => current.map((entry) => (entry.id === finalAttempt.id ? finalAttempt : entry)));
        setActiveAttempt(finalAttempt);
        setActiveTab('resultados');
      }
    };

    updateClock();
    const timer = window.setInterval(updateClock, 1000);

    return () => window.clearInterval(timer);
  }, [activeAttempt]);

  const toggleTopic = (topicId: string) => {
    setTopicIds((current) => {
      if (current.includes(topicId)) {
        return current.filter((value) => value !== topicId);
      }
      return [...current, topicId];
    });
  };

  const handleStartAttempt = () => {
    if (topicIds.length === 0) {
      setErrorMessage('Selecciona al menos un tema.');
      return;
    }

    if (questionCount > availableQuestions) {
      setErrorMessage('El número de preguntas elegido supera la cantidad disponible en los temas seleccionados.');
      return;
    }

    const result = generateAttempt({
      topicIds,
      questionCount,
      timeLimitSeconds,
    });

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    setErrorMessage('');
    setAttempts((current) => [result.attempt, ...current]);
    setActiveAttempt(result.attempt);
    setCurrentQuestionIndex(0);
    setActiveTab('curso');
  };

  const saveAttemptToState = (nextAttempt: AttemptRecord) => {
    setAttempts((current) => current.map((entry) => (entry.id === nextAttempt.id ? nextAttempt : entry)));
    setActiveAttempt(nextAttempt);
  };

  const handleAnswerSelection = (answerId: string) => {
    if (!activeAttempt || activeAttempt.status !== 'in_progress') {
      return;
    }

    const question = activeAttempt.questions[currentQuestionIndex];
    const updatedAttempt = updateAttemptAnswer(activeAttempt, question.id, answerId);
    saveAttemptToState(updatedAttempt);
  };

  const handleFinalizeAttempt = () => {
    if (!activeAttempt || activeAttempt.status !== 'in_progress') {
      return;
    }

    const finished = finalizeAttempt({
      ...activeAttempt,
      questions: activeAttempt.questions.map((question) => ({
        ...question,
        selectedAnswerId: question.selectedAnswerId ?? null,
      })),
      status: 'finalizado',
    });

    setAttempts((current) => current.map((entry) => (entry.id === finished.id ? finished : entry)));
    setActiveAttempt(finished);
    setIsFinishConfirmationOpen(false);
    setActiveTab('resultados');
  };

  const currentQuestion = activeAttempt?.questions[currentQuestionIndex] ?? null;
  const completedAttempts = attempts.filter((attempt) => attempt.status === 'finalizado');
  const answeredCount = activeAttempt?.questions.filter((question) => question.selectedAnswerId).length ?? 0;
  const unansweredCount = (activeAttempt?.questions.length ?? 0) - answeredCount;
  const isPracticeInProgress = activeTab === 'curso' && activeAttempt?.status === 'in_progress';

  return (
    <main className={isPracticeInProgress ? 'min-h-[70vh] overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-[#f8f7f3]' : 'page-shell py-10 md:py-14'}>
      {!isPracticeInProgress ? (
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Plataforma</p>
          <h1 className="text-4xl font-normal tracking-[-0.06em] text-[var(--ink)] md:text-6xl">
            Tu preparación
          </h1>
        </div>
        ) : null}
        <div className="inline-flex rounded-full border border-[var(--line)] bg-white/70 p-1">
          {[
            { key: 'crear', label: 'Crear test' },
            { key: 'curso', label: 'Test en curso' },
            { key: 'resultados', label: 'Mis resultados' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={[
                'rounded-full px-4 py-2 font-sans text-sm font-semibold transition-colors',
                activeTab === tab.key ? 'bg-[var(--coral)] text-white' : 'text-[var(--muted)]',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'crear' ? (
        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-6 shadow-[0_26px_70px_rgba(23,60,58,0.04)] md:p-8">
            <p className="eyebrow">Convocatoria</p>
            <h2 className="text-2xl font-normal text-[var(--ink)]">{demoExam.name}</h2>

            <div className="mt-6 space-y-5">
              <div>
                <p className="mb-3 font-sans text-sm font-semibold text-[var(--ink)]">Temas</p>
                <div className="flex flex-wrap gap-2">
                  {demoExam.topics.map((topic) => (
                    <label key={topic.id} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-[rgba(22,31,29,0.02)] px-3 py-2 text-sm text-[var(--ink)]">
                      <input
                        type="checkbox"
                        checked={topicIds.includes(topic.id)}
                        onChange={() => toggleTopic(topic.id)}
                      />
                      <span>{topic.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block font-sans text-sm font-semibold text-[var(--ink)]">Número de preguntas</span>
                  <select
                    value={questionCount}
                    onChange={(event) => setQuestionCount(Number(event.target.value))}
                    className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-[var(--ink)]"
                  >
                    {QUESTION_COUNT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block font-sans text-sm font-semibold text-[var(--ink)]">Tiempo</span>
                  <select
                    value={timeLimitSeconds}
                    onChange={(event) => setTimeLimitSeconds(Number(event.target.value))}
                    className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-[var(--ink)]"
                  >
                    {TIME_LIMIT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option === 0 ? 'Sin límite' : `${Math.floor(option / 60)} minutos`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {errorMessage ? (
              <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleStartAttempt}
              className="mt-7 inline-flex w-full items-center justify-center rounded-full bg-[var(--coral)] px-5 py-3 font-sans text-sm font-semibold text-white transition-colors hover:bg-[#d95d4d]"
            >
              Comenzar test
            </button>
          </div>

          <div className="rounded-[2rem] border border-[var(--line)] bg-[rgba(22,31,29,0.03)] p-6 md:p-8">
            <p className="eyebrow">Resumen</p>
            <div className="space-y-4">
              <div className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
                <p className="text-sm text-[var(--muted)]">Convocatoria</p>
                <p className="mt-2 text-lg font-semibold text-[var(--ink)]">{demoExam.name}</p>
              </div>
              <div className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
                <p className="text-sm text-[var(--muted)]">Número de preguntas</p>
                <p className="mt-2 text-lg font-semibold text-[var(--ink)]">{questionCount}</p>
              </div>
              <div className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
                <p className="text-sm text-[var(--muted)]">Tiempo</p>
                <p className="mt-2 text-lg font-semibold text-[var(--ink)]">{timeLimitSeconds === 0 ? 'Sin límite' : formatSeconds(timeLimitSeconds)}</p>
              </div>
              <div className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
                <p className="text-sm text-[var(--muted)]">Temas seleccionados</p>
                <p className="mt-2 text-lg font-semibold text-[var(--ink)]">{topicIds.length}</p>
              </div>
              <div className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
                <p className="text-sm text-[var(--muted)]">Preguntas disponibles</p>
                <p className="mt-2 text-lg font-semibold text-[var(--ink)]">{availableQuestions}</p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === 'curso' ? (
        <section className={activeAttempt ? 'grid lg:min-h-[760px] lg:grid-cols-[230px_minmax(0,1fr)]' : 'rounded-[2rem] border border-[var(--line)] bg-white/80 p-6 shadow-[0_26px_70px_rgba(23,60,58,0.04)] md:p-8'}>
          {!activeAttempt ? (
            <div>
              <p className="eyebrow">Sin test en curso</p>
              <h2 className="text-2xl font-normal text-[var(--ink)]">No tienes ningún intento activo.</h2>
              <button
                type="button"
                onClick={() => setActiveTab('crear')}
                className="mt-6 inline-flex items-center justify-center rounded-full bg-[var(--coral)] px-5 py-3 font-sans text-sm font-semibold text-white"
              >
                Crear un test
              </button>
            </div>
          ) : (
            <>
              <aside className="flex flex-col border-b border-[var(--line)] bg-[#f6f5f0] p-5 lg:border-b-0 lg:border-r lg:p-6">
                <div className="rounded-xl bg-[#eeede6] p-4">
                  <p className="font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Mi oposición</p>
                  <p className="mt-2 font-sans text-sm font-semibold text-[var(--ink)]">{demoExam.name}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">Gobierno de Navarra</p>
                </div>
                <nav aria-label="Navegación de la plataforma" className="mt-5 grid gap-1">
                  {[
                    { key: 'crear' as const, label: 'Crear test', icon: '＋' },
                    { key: 'curso' as const, label: 'Mi test', icon: '☷' },
                    { key: 'resultados' as const, label: 'Mis resultados', icon: '▥' },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveTab(item.key)}
                      className={[
                        'flex min-h-11 items-center gap-3 rounded-lg px-3 text-left font-sans text-sm transition-colors',
                        item.key === 'curso' ? 'bg-[#fbefec] font-semibold text-[#bd3734]' : 'text-[var(--muted)] hover:bg-white',
                      ].join(' ')}
                    >
                      <span aria-hidden="true" className="text-lg leading-none">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </nav>
                <div className="mt-auto hidden pt-8 text-xs leading-5 text-[var(--muted)] lg:block">
                  <p className="font-medium text-[var(--ink)]">Un test. Un paso más.</p>
                  <p className="mt-2">Avanza pregunta a pregunta y revisa tu progreso cuando lo necesites.</p>
                </div>
              </aside>

              <div className="min-w-0 p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                  <p className="text-xs text-[var(--muted)]">Mis test <span className="mx-2">/</span> {demoExam.name} <span className="mx-2">/</span> Test por tema</p>
                  <p className="eyebrow mt-6">Tu momento de práctica</p>
                  <h2 className="font-serif text-3xl font-normal tracking-[-0.04em] text-[#302f2b] sm:text-4xl">{demoExam.name}</h2>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {activeAttempt.questions.length} preguntas · Una única respuesta correcta
                  </p>
                </div>

                <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
                  <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
                    <div className="p-5 sm:p-7">
                      {currentQuestion ? (
                        <div className="space-y-6">
                          <p className="font-sans text-sm font-bold text-[#bd3734]">
                            PREGUNTA {String(currentQuestionIndex + 1).padStart(2, '0')} <span className="ml-2 font-normal text-[var(--muted)]">/ {activeAttempt.questions.length}</span>
                          </p>

                          <div>
                            <p className="text-sm text-[var(--muted)]">
                              {demoExam.topics.find((topic) => topic.id === currentQuestion.topicId)?.name ?? 'Pregunta'}
                            </p>
                            <h3 className="mt-3 text-xl font-semibold leading-relaxed text-[#302f2b] sm:text-2xl">{currentQuestion.text}</h3>
                          </div>

                          <fieldset className="grid gap-3">
                            <legend className="sr-only">Selecciona una respuesta</legend>
                            {currentQuestion.options.map((option, optionIndex) => {
                              const selected = currentQuestion.selectedAnswerId === option.id;
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  aria-pressed={selected}
                                  onClick={() => handleAnswerSelection(option.id)}
                                  className={[
                                    'flex min-h-[68px] items-center gap-4 rounded-lg border px-4 py-3 text-left transition-colors sm:px-5',
                                    selected
                                      ? 'border-2 border-[#c43b38] bg-[#fbefec] text-[#302f2b]'
                                      : 'border-[var(--line)] bg-white text-[#302f2b] hover:border-[#c43b38]',
                                  ].join(' ')}
                                >
                                  <span className={[
                                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-sans text-sm font-semibold',
                                    selected ? 'bg-[#bd3734] text-white' : 'bg-[#f6f5f0] text-[var(--muted)]',
                                  ].join(' ')}>
                                    {String.fromCharCode(65 + optionIndex)}
                                  </span>
                                  <span className="flex-1 text-sm leading-6 sm:text-base">{option.text}</span>
                                  <span aria-hidden="true" className={[
                                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                                    selected ? 'border-[#bd3734]' : 'border-[#deded7]',
                                  ].join(' ')}>
                                    {selected ? <span className="h-2.5 w-2.5 rounded-full bg-[#bd3734]" /> : null}
                                  </span>
                                </button>
                              );
                            })}
                          </fieldset>

                          <p className="text-sm text-[var(--muted)]" aria-live="polite">
                            {currentQuestion.selectedAnswerId ? '✓ Respuesta guardada en este dispositivo' : 'Selecciona una respuesta o déjala en blanco.'}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    <div className="border-t border-[var(--line)] p-5 sm:px-7 sm:py-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                        <button
                          type="button"
                          onClick={() => setCurrentQuestionIndex((index) => Math.max(0, index - 1))}
                          disabled={currentQuestionIndex === 0}
                          className="min-h-12 rounded-lg border border-[var(--line)] px-5 font-sans text-sm font-semibold text-[#302f2b] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          ← Anterior
                        </button>
                        {currentQuestionIndex < activeAttempt.questions.length - 1 ? (
                          <button
                            type="button"
                            onClick={() => setCurrentQuestionIndex((index) => Math.min(activeAttempt.questions.length - 1, index + 1))}
                            className="min-h-12 rounded-lg bg-[#bd3734] px-5 font-sans text-sm font-semibold text-white hover:bg-[#a82f2c]"
                          >
                            Siguiente pregunta →
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsFinishConfirmationOpen(true)}
                            className="min-h-12 rounded-lg bg-[#bd3734] px-5 font-sans text-sm font-semibold text-white hover:bg-[#a82f2c]"
                          >
                            Finalizar test
                          </button>
                        )}
                      </div>
                      <p className="mt-5 text-xs text-[var(--muted)]">Verás tus resultados al finalizar el test.</p>
                    </div>
                  </div>

                  <aside className="grid gap-4">
                    <section className="rounded-2xl bg-[#eeede6] p-5" aria-label="Tiempo de sesión">
                      <p className="text-sm text-[var(--muted)]">◷ <span className="ml-2">Tiempo de sesión</span></p>
                      <div className="mt-4 flex items-end justify-between gap-2">
                        <p className="font-serif text-3xl text-[#302f2b]">
                          {activeAttempt.timeLimitSeconds > 0 && activeAttempt.expiresAt
                            ? formatClock(Math.max(0, Math.ceil((new Date(activeAttempt.expiresAt).getTime() - Date.now()) / 1000)))
                            : formatClock(elapsedSeconds)}
                        </p>
                        <p className="text-xs text-[var(--muted)]">
                          {activeAttempt.timeLimitSeconds > 0 ? 'Tiempo restante' : 'Sin límite de tiempo'}
                        </p>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-[var(--line)] bg-white p-5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-sans text-sm font-semibold text-[#302f2b]">Tu progreso</h3>
                        <span className="text-sm font-semibold text-[#bd3734]">
                          {Math.round((answeredCount / activeAttempt.questions.length) * 100)} %
                        </span>
                      </div>
                      <div
                        className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#eeede6]"
                        role="progressbar"
                        aria-label="Progreso del test"
                        aria-valuemin={0}
                        aria-valuemax={activeAttempt.questions.length}
                        aria-valuenow={answeredCount}
                      >
                        <div className="h-full rounded-full bg-[#bd3734]" style={{ width: `${(answeredCount / activeAttempt.questions.length) * 100}%` }} />
                      </div>
                      <p className="mt-3 text-xs text-[var(--muted)]">
                        {answeredCount} de {activeAttempt.questions.length} respondidas · {unansweredCount} pendientes
                      </p>

                      <div className="my-5 border-t border-[var(--line)]" />
                      <p className="mb-3 text-sm font-medium text-[#302f2b]">Ir a la pregunta</p>
                      <div className="grid grid-cols-5 gap-2">
                        {activeAttempt.questions.map((question, index) => {
                          const isCurrent = index === currentQuestionIndex;
                          const hasAnswer = Boolean(question.selectedAnswerId);
                          return (
                            <button
                              key={question.id}
                              type="button"
                              onClick={() => setCurrentQuestionIndex(index)}
                              aria-current={isCurrent ? 'step' : undefined}
                              aria-label={`Ir a la pregunta ${index + 1}, ${hasAnswer ? 'respondida' : 'pendiente'}${isCurrent ? ', actual' : ''}`}
                              className={[
                                'relative aspect-square rounded-md border font-sans text-sm font-medium transition-colors',
                                isCurrent
                                  ? 'border-[#bd3734] bg-[#bd3734] text-white'
                                  : hasAnswer
                                    ? 'border-transparent bg-[#eeede6] text-[#302f2b] hover:border-[#bd3734]'
                                    : 'border-[var(--line)] bg-white text-[var(--muted)] hover:border-[#bd3734]',
                              ].join(' ')}
                            >
                              {String(index + 1).padStart(2, '0')}
                            </button>
                          );
                        })}
                      </div>
                      <div className="my-5 border-t border-[var(--line)]" />
                      <button
                        type="button"
                        onClick={() => setIsFinishConfirmationOpen(true)}
                        className="min-h-12 w-full rounded-lg border border-[var(--line)] px-4 font-sans text-sm font-semibold text-[#302f2b] hover:bg-[#f8f7f3]"
                      >
                        Finalizar y ver resultados
                      </button>
                      <p className="mt-3 text-center text-xs leading-5 text-[var(--muted)]">
                        {unansweredCount > 0 ? `Tienes ${unansweredCount} preguntas sin responder.` : 'Has respondido todas las preguntas.'}
                      </p>
                    </section>
                  </aside>
                </div>
              </div>
              {isFinishConfirmationOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                  <section
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="finish-test-title"
                    className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
                  >
                    <h2 id="finish-test-title" className="text-xl font-semibold text-[#302f2b]">¿Finalizar el test?</h2>
                    <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                      {unansweredCount > 0
                        ? `Tienes ${unansweredCount} ${unansweredCount === 1 ? 'pregunta sin responder' : 'preguntas sin responder'}. ¿Quieres entregar el test ahora?`
                        : 'Has respondido todas las preguntas. ¿Quieres entregar el test ahora?'}
                    </p>
                    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={() => setIsFinishConfirmationOpen(false)}
                        className="min-h-11 rounded-lg border border-[var(--line)] px-4 font-sans text-sm font-semibold text-[#302f2b]"
                      >
                        Seguir practicando
                      </button>
                      <button
                        type="button"
                        onClick={handleFinalizeAttempt}
                        className="min-h-11 rounded-lg bg-[#bd3734] px-4 font-sans text-sm font-semibold text-white"
                      >
                        Confirmar y finalizar
                      </button>
                    </div>
                  </section>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {activeTab === 'resultados' ? (
        <section className="space-y-6">
          {completedAttempts.length === 0 ? (
            <div className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-6 md:p-8">
              <p className="eyebrow">Sin resultados</p>
              <h2 className="text-2xl font-normal text-[var(--ink)]">Todavía no has realizado ningún test.</h2>
            </div>
          ) : (
            completedAttempts.map((attempt) => (
              <div key={attempt.id} className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-6 shadow-[0_26px_70px_rgba(23,60,58,0.04)] md:p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="eyebrow">Resultado</p>
                    <h2 className="text-2xl font-normal text-[var(--ink)]">{attempt.resultado?.nota ?? 0} / 10</h2>
                    <p className="mt-2 text-sm text-[var(--muted)]">{formatDate(attempt.startedAt)}</p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveAttempt(attempt);
                        setActiveTab('curso');
                      }}
                      className="rounded-full border border-[var(--ink)] px-5 py-3 font-sans text-sm font-semibold text-[var(--ink)]"
                    >
                      Revisar test
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('crear')}
                      className="rounded-full bg-[var(--coral)] px-5 py-3 font-sans text-sm font-semibold text-white"
                    >
                      Crear otro test
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[var(--line)] bg-[rgba(22,31,29,0.03)] p-4">
                    <p className="text-sm text-[var(--muted)]">Aciertos</p>
                    <p className="mt-2 text-xl font-semibold text-[var(--ink)]">{attempt.resultado?.aciertos ?? 0}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--line)] bg-[rgba(22,31,29,0.03)] p-4">
                    <p className="text-sm text-[var(--muted)]">Fallos</p>
                    <p className="mt-2 text-xl font-semibold text-[var(--ink)]">{attempt.resultado?.fallos ?? 0}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--line)] bg-[rgba(22,31,29,0.03)] p-4">
                    <p className="text-sm text-[var(--muted)]">En blanco</p>
                    <p className="mt-2 text-xl font-semibold text-[var(--ink)]">{attempt.resultado?.enBlanco ?? 0}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      ) : null}
    </main>
  );
}
