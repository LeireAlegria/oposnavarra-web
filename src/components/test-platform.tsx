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
    if (!activeAttempt || activeAttempt.status !== 'in_progress' || activeAttempt.timeLimitSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      if (!activeAttempt.expiresAt) {
        return;
      }

      const remaining = Math.max(0, Math.ceil((new Date(activeAttempt.expiresAt).getTime() - Date.now()) / 1000));

      if (remaining <= 0) {
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
        return;
      }

      setActiveAttempt((current) => {
        if (!current) {
          return current;
        }

        return { ...current, expiresAt: current.expiresAt };
      });
    }, 1000);

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
    setActiveTab('resultados');
  };

  const currentQuestion = activeAttempt?.questions[currentQuestionIndex] ?? null;
  const completedAttempts = attempts.filter((attempt) => attempt.status === 'finalizado');

  return (
    <main className="page-shell py-10 md:py-14">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Plataforma</p>
          <h1 className="text-4xl font-normal tracking-[-0.06em] text-[var(--ink)] md:text-6xl">
            Tu preparación
          </h1>
        </div>
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
        <section className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-6 shadow-[0_26px_70px_rgba(23,60,58,0.04)] md:p-8">
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
              <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="eyebrow">Pregunta {currentQuestionIndex + 1} / {activeAttempt.questions.length}</p>
                  <h2 className="text-2xl font-normal text-[var(--ink)]">{demoExam.name}</h2>
                </div>
                {activeAttempt.timeLimitSeconds > 0 ? (
                  <div className="rounded-full bg-[rgba(243,111,94,0.08)] px-4 py-2 font-sans text-sm font-semibold text-[var(--coral)]">
                    {(() => {
                      const remaining = Math.max(0, Math.ceil((new Date(activeAttempt.expiresAt ?? Date.now()).getTime() - Date.now()) / 1000));
                      return `Quedan ${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, '0')}`;
                    })()}
                  </div>
                ) : null}
              </div>

              {currentQuestion ? (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-[var(--line)] bg-[rgba(22,31,29,0.03)] p-5 md:p-6">
                    <p className="text-lg font-semibold text-[var(--ink)]">{currentQuestion.text}</p>
                  </div>

                  <div className="grid gap-3">
                    {currentQuestion.options.map((option) => {
                      const selected = currentQuestion.selectedAnswerId === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => handleAnswerSelection(option.id)}
                          className={[
                            'rounded-2xl border px-4 py-3 text-left font-sans text-sm transition-colors',
                            selected
                              ? 'border-[var(--coral)] bg-[rgba(243,111,94,0.08)] text-[var(--ink)]'
                              : 'border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--coral)]',
                          ].join(' ')}
                        >
                          {option.text}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                    <button
                      type="button"
                      onClick={() => setCurrentQuestionIndex((index) => Math.max(0, index - 1))}
                      disabled={currentQuestionIndex === 0}
                      className="rounded-full border border-[var(--line)] px-5 py-3 font-sans text-sm font-semibold text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Anterior
                    </button>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setCurrentQuestionIndex((index) => Math.min(activeAttempt.questions.length - 1, index + 1))}
                        className="rounded-full border border-[var(--ink)] px-5 py-3 font-sans text-sm font-semibold text-[var(--ink)]"
                      >
                        Siguiente
                      </button>
                      <button
                        type="button"
                        onClick={handleFinalizeAttempt}
                        className="rounded-full bg-[var(--coral)] px-5 py-3 font-sans text-sm font-semibold text-white"
                      >
                        Finalizar test
                      </button>
                    </div>
                  </div>
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
