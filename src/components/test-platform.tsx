'use client';

import type { ReactNode } from 'react';
import { TestTopicSelection } from './test-topic-selection';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  countAvailableTestQuestions,
  createOfficialTestAttempt,
  createTestAttempt,
  finalizeTestAttempt,
  getTestAttempt,
  getTestCatalog,
  getOfficialExamCatalog,
  getTestHistory,
  listInProgressTestAttempts,
  saveTestAnswer,
  type TestAttempt,
  type TestAttemptSummary,
  type TestConvocation,
  type TestOfficialExam,
} from '@/lib/test-platform-api';

type TabKey = 'crear' | 'oficiales' | 'curso' | 'resultados';
const HISTORY_PAGE_SIZE = 10;
const QUESTION_COUNT_OPTIONS = [10, 20, 30, 40, 50];
const TIME_LIMIT_OPTIONS = [0, 600, 1200, 1800, 2700, 3600];
type TestPlatformProps = {
  accountEmail: string;
  accountPanel: ReactNode;
  canPractice: boolean;
  initialAttemptId?: string;
  challengeId?: string;
};

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

function formatExamDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(value),
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function TestPlatform({
  accountEmail,
  accountPanel,
  canPractice,
  initialAttemptId,
  challengeId,
}: TestPlatformProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>(() => (canPractice ? 'crear' : 'resultados'));
  const [convocations, setConvocations] = useState<TestConvocation[]>([]);
  const [officialExams, setOfficialExams] = useState<TestOfficialExam[]>([]);
  const [convocationId, setConvocationId] = useState('');
  const [officialConvocationId, setOfficialConvocationId] = useState('');
  const [officialExamId, setOfficialExamId] = useState('');
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState<number>(20);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number>(0);
  const [officialTimeLimitSeconds, setOfficialTimeLimitSeconds] = useState<number>(0);
  const [availableQuestions, setAvailableQuestions] = useState<number | null>(null);
  const [activeTests, setActiveTests] = useState<TestAttemptSummary[]>([]);
  const [history, setHistory] = useState<TestAttemptSummary[]>([]);
  const [historyErrorMessage, setHistoryErrorMessage] = useState('');
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [activeAttempt, setActiveAttempt] = useState<TestAttempt | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAttempt, setIsLoadingAttempt] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isStartingAttempt, setIsStartingAttempt] = useState(false);
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);
  const [isFinalizingAttempt, setIsFinalizingAttempt] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isFinishConfirmationOpen, setIsFinishConfirmationOpen] = useState(false);
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const [timeExpired, setTimeExpired] = useState(false);
  const expiredAttemptIdRef = useRef<string | null>(null);
  const selectedConvocation = convocations.find((convocation) => convocation.id === convocationId);
  useEffect(() => {
    if (!challengeId || !activeAttempt || activeAttempt.status !== 'in_progress') return;
    const timer = window.setInterval(() => {
      void getTestAttempt(activeAttempt.id)
        .then((attempt) => {
          if (attempt.status === 'finalized') router.replace(`/retos/${challengeId}`);
        })
        .catch(() => {
          /* Saving and delivery still surface connection errors in the exam UI. */
        });
    }, 15000);
    return () => window.clearInterval(timer);
  }, [challengeId, activeAttempt, router]);
  const availableOfficialExams = officialExams.filter(
    (exam) => exam.convocationId === officialConvocationId,
  );
  const selectedOfficialExam = availableOfficialExams.find((exam) => exam.id === officialExamId);
  const officialConvocations = [
    ...new Map(officialExams.map((exam) => [exam.convocationId, exam])).values(),
  ];
  const availableTopics = [...(selectedConvocation?.topics ?? [])].sort(
    (a, b) => a.blockOrder - b.blockOrder || a.order - b.order,
  );
  const allTopicsSelected =
    availableTopics.length > 0 && topicIds.length === availableTopics.length;

  useEffect(() => {
    let isCurrent = true;

    async function loadPlatform() {
      if (initialAttemptId && challengeId) {
        try {
          const attempt = await getTestAttempt(initialAttemptId);
          if (!isCurrent) return;
          if (attempt.status === 'finalized' && !attempt.result) {
            router.replace('/retos/' + challengeId);
            return;
          }
          setActiveAttempt(attempt);
          setActiveTab('curso');
        } catch (error) {
          if (isCurrent)
            setErrorMessage(getErrorMessage(error, 'No se pudo recuperar el examen del reto.'));
        } finally {
          if (isCurrent) setIsLoading(false);
        }
        return;
      }
      setErrorMessage('');
      setHistoryErrorMessage('');
      setIsLoading(true);
      try {
        try {
          const firstHistoryPage = await getTestHistory(HISTORY_PAGE_SIZE, 0);
          if (!isCurrent) return;
          setHistory(firstHistoryPage.items);
          setHistoryHasMore(firstHistoryPage.hasMore);
          setHistoryErrorMessage('');
        } catch (error) {
          if (!isCurrent) return;
          setHistoryErrorMessage(
            getErrorMessage(error, 'No se pudo cargar el historial. Inténtalo de nuevo.'),
          );
          setErrorMessage('No se pudo cargar el historial. Inténtalo de nuevo.');
        }

        if (canPractice) {
          const [catalog, officialCatalog, inProgress] = await Promise.all([
            getTestCatalog(),
            getOfficialExamCatalog(),
            listInProgressTestAttempts(),
          ]);
          if (!isCurrent) return;
          setConvocations(catalog);
          setOfficialExams(officialCatalog);
          setActiveTests(inProgress);
          if (catalog[0]) {
            setConvocationId(catalog[0].id);
            setTopicIds(catalog[0].topics.map((topic) => topic.id));
          }
          if (officialCatalog[0]) {
            setOfficialConvocationId(officialCatalog[0].convocationId);
            setOfficialExamId(officialCatalog[0].id);
          }

          if (inProgress[0]) {
            const attempt = await getTestAttempt(inProgress[0].id);
            if (!isCurrent) return;
            setActiveAttempt(attempt);
            setActiveTab('curso');
            setCurrentQuestionIndex(0);
          }
        }
      } catch (error) {
        if (isCurrent) {
          setErrorMessage(
            getErrorMessage(error, 'No se pudo cargar la plataforma de tests. Inténtalo de nuevo.'),
          );
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadPlatform();
    return () => {
      isCurrent = false;
    };
  }, [canPractice, initialAttemptId, challengeId, router]);

  useEffect(() => {
    if (challengeId || !canPractice || !convocationId) {
      setAvailableQuestions(null);
      return;
    }

    let isCurrent = true;
    setAvailableQuestions(null);
    countAvailableTestQuestions(convocationId, topicIds)
      .then((count) => {
        if (isCurrent) setAvailableQuestions(count);
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setErrorMessage(
            getErrorMessage(error, 'No se pudo consultar la disponibilidad de preguntas.'),
          );
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [canPractice, convocationId, topicIds, challengeId]);

  useEffect(() => {
    if (!activeAttempt || activeAttempt.status !== 'in_progress') {
      return;
    }

    const updateClock = () => {
      const now = Date.now();
      setElapsedSeconds(
        Math.max(0, Math.floor((now - new Date(activeAttempt.startedAt).getTime()) / 1000)),
      );

      if (
        activeAttempt.timeLimitSeconds &&
        activeAttempt.expiresAt &&
        new Date(activeAttempt.expiresAt).getTime() <= now
      ) {
        if (expiredAttemptIdRef.current === activeAttempt.id) return;
        expiredAttemptIdRef.current = activeAttempt.id;
        void (async () => {
          setIsFinalizingAttempt(true);
          try {
            const finalized = await finalizeTestAttempt(activeAttempt.id);

            if (challengeId) {
              router.replace(`/retos/${challengeId}`);
              return;
            }

            setActiveTests((current) =>
              current.filter((attempt) => attempt.id !== activeAttempt.id),
            );
            setActiveAttempt(null);
            setActiveTab('resultados');
            setTimeExpired(true);
            setHistory((current) => [
              finalized,
              ...current.filter((attempt) => attempt.id !== finalized.id),
            ]);
            setHistoryPage(0);
            const firstHistoryPage = await getTestHistory(HISTORY_PAGE_SIZE, 0);
            setHistory(firstHistoryPage.items);
            setHistoryHasMore(firstHistoryPage.hasMore);
            setHistoryPage(0);
          } catch (error) {
            setErrorMessage(
              getErrorMessage(error, 'No se pudo finalizar automáticamente el test.'),
            );
          } finally {
            setIsFinalizingAttempt(false);
          }
        })();
      }
    };

    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, [activeAttempt, challengeId, router]);

  async function refreshHistory(offset: number, append = false) {
    setIsLoadingHistory(true);
    try {
      const nextPage = await getTestHistory(HISTORY_PAGE_SIZE, offset);
      setHistory((current) => (append ? [...current, ...nextPage.items] : nextPage.items));
      setHistoryHasMore(nextPage.hasMore);
      setHistoryPage(Math.floor(offset / HISTORY_PAGE_SIZE));
      setHistoryErrorMessage('');
      setErrorMessage('');
    } catch (error) {
      const message = getErrorMessage(error, 'No se pudo actualizar el historial.');
      setHistoryErrorMessage(message);
      setErrorMessage(message);
    } finally {
      setIsLoadingHistory(false);
    }
  }

  const handleStartAttempt = async () => {
    if (!canPractice || !convocationId || availableQuestions === null) {
      return;
    }

    if (topicIds.length === 0) {
      setErrorMessage('Selecciona al menos un tema.');
      return;
    }

    if (availableQuestions < 10 || questionCount > availableQuestions) {
      setErrorMessage(
        'El número de preguntas elegido supera la cantidad disponible en los temas seleccionados.',
      );
      return;
    }

    setErrorMessage('');
    setIsStartingAttempt(true);
    try {
      const attemptId = await createTestAttempt({
        convocationId,
        questionCount,
        timeLimitSeconds: timeLimitSeconds || null,
        topicIds,
      });
      const attempt = await getTestAttempt(attemptId);
      setActiveTests((current) => [attempt, ...current.filter((item) => item.id !== attempt.id)]);
      setActiveAttempt(attempt);
      setCurrentQuestionIndex(0);
      setElapsedSeconds(0);
      setTimeExpired(false);
      expiredAttemptIdRef.current = null;
      setActiveTab('curso');
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'No se pudo iniciar el test.'));
    } finally {
      setIsStartingAttempt(false);
    }
  };

  const handleStartOfficialAttempt = async () => {
    if (!canPractice || !selectedOfficialExam) return;

    setErrorMessage('');
    setIsStartingAttempt(true);
    try {
      const attemptId = await createOfficialTestAttempt({
        convocationId: selectedOfficialExam.convocationId,
        examId: selectedOfficialExam.id,
        timeLimitSeconds: officialTimeLimitSeconds || null,
      });
      const attempt = await getTestAttempt(attemptId);
      setActiveTests((current) => [attempt, ...current.filter((item) => item.id !== attempt.id)]);
      setActiveAttempt(attempt);
      setCurrentQuestionIndex(0);
      setElapsedSeconds(0);
      setTimeExpired(false);
      expiredAttemptIdRef.current = null;
      setActiveTab('curso');
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'No se pudo iniciar el test oficial.'));
    } finally {
      setIsStartingAttempt(false);
    }
  };

  const handleAnswerSelection = async (answerId: string) => {
    if (!canPractice || !activeAttempt || activeAttempt.status !== 'in_progress') {
      return;
    }

    const question = activeAttempt.questions[currentQuestionIndex];
    setErrorMessage('');
    setIsSavingAnswer(true);
    try {
      const saved = await saveTestAnswer({
        attemptId: activeAttempt.id,
        questionId: question.id,
        answerId,
      });
      if (!saved) {
        const finalized = await finalizeTestAttempt(activeAttempt.id);

        if (challengeId) {
          router.replace(`/retos/${challengeId}`);
          return;
        }
        setActiveTests((current) => current.filter((attempt) => attempt.id !== activeAttempt.id));
        setActiveAttempt(null);
        setActiveTab('resultados');
        setTimeExpired(true);
        setHistory((current) => [
          finalized,
          ...current.filter((attempt) => attempt.id !== finalized.id),
        ]);
        setHistoryPage(0);
        await refreshHistory(0);
        return;
      }

      setActiveAttempt((current) =>
        current?.id !== activeAttempt.id
          ? current
          : {
              ...current,
              questions: current.questions.map((entry) =>
                entry.id === question.id ? { ...entry, selectedAnswerId: answerId } : entry,
              ),
            },
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'No se pudo guardar tu respuesta.'));
    } finally {
      setIsSavingAnswer(false);
    }
  };

  const handleFinalizeAttempt = async () => {
    if (!canPractice || !activeAttempt || activeAttempt.status !== 'in_progress') {
      return;
    }

    setErrorMessage('');
    setIsFinalizingAttempt(true);
    try {
      const finalized = await finalizeTestAttempt(activeAttempt.id);

      if (challengeId) {
        router.replace(`/retos/${challengeId}`);
        return;
      }
      setActiveTests((current) => current.filter((attempt) => attempt.id !== activeAttempt.id));
      setActiveAttempt(null);
      setIsFinishConfirmationOpen(false);
      setActiveTab('resultados');
      setHistory((current) => [
        finalized,
        ...current.filter((attempt) => attempt.id !== finalized.id),
      ]);
      setHistoryPage(0);
      await refreshHistory(0);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'No se pudo finalizar el test.'));
    } finally {
      setIsFinalizingAttempt(false);
    }
  };

  const handleOpenAttempt = async (attempt: TestAttemptSummary) => {
    setIsLoadingAttempt(true);
    setErrorMessage('');
    try {
      const details = await getTestAttempt(attempt.id);
      setActiveAttempt(details);
      setCurrentQuestionIndex(0);
      setActiveTab('curso');
      setIsNavigationOpen(false);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'No se pudo recuperar el test.'));
    } finally {
      setIsLoadingAttempt(false);
    }
  };

  const currentQuestion = activeAttempt?.questions[currentQuestionIndex] ?? null;
  const selectedTopicNames = activeAttempt?.selectedTopics.map((topic) => topic.name) ?? [];
  const pageTitle =
    activeTab === 'crear'
      ? 'Configura tu test'
      : activeTab === 'oficiales'
        ? 'Test oficiales'
        : activeTab === 'curso'
          ? activeAttempt?.status === 'finalized'
            ? 'Revisión del test'
            : 'Test en curso'
          : 'Historial de tests';
  const pageDescription =
    activeTab === 'crear'
      ? 'Elige los temas, el número de preguntas y el tiempo para empezar.'
      : activeTab === 'oficiales'
        ? 'Elige un examen oficial y responde a sus preguntas en el orden original.'
        : activeTab === 'curso'
          ? activeAttempt?.status === 'finalized'
            ? 'Repasa tus respuestas y consulta la corrección.'
            : 'Responde a tu ritmo y consulta tu progreso en cualquier momento.'
          : 'Consulta los resultados de tus tests finalizados.';
  const answeredCount =
    activeAttempt?.questions.filter((question) => question.selectedAnswerId !== null).length ?? 0;
  const unansweredCount = (activeAttempt?.questions.length ?? 0) - answeredCount;
  return (
    <main className="student-platform-shell min-h-screen bg-[#f8f7f3] text-[#302f2b]">
      <header className="flex min-h-16 items-center justify-between border-b border-[var(--line)] bg-white px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-expanded={isNavigationOpen}
            aria-controls="student-platform-navigation"
            onClick={() => setIsNavigationOpen((open) => !open)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--line)] text-lg lg:hidden"
          >
            <span className="sr-only">
              {isNavigationOpen ? 'Cerrar navegación' : 'Abrir navegación'}
            </span>
            {isNavigationOpen ? '×' : '☰'}
          </button>
          <Link href="/plataforma" className="font-serif text-xl font-semibold tracking-tight">
            OposNavarra
          </Link>
          <span className="hidden border-l border-[var(--line)] pl-3 text-sm text-[var(--muted)] sm:inline">
            Espacio de estudio
          </span>
        </div>
        <details className="relative">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-sm font-medium hover:bg-[#f8f7f3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd3734]">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fbefec] font-semibold text-[#bd3734]"
            >
              {accountEmail.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden max-w-48 truncate sm:inline">{accountEmail}</span>
            <span aria-hidden="true">⌄</span>
          </summary>
          <div className="absolute right-0 z-30 mt-2 max-h-[75vh] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-[var(--line)] bg-white p-4 shadow-xl">
            <p className="mb-3 break-all text-sm font-semibold">{accountEmail}</p>
            {accountPanel}
          </div>
        </details>
      </header>

      <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside
          id="student-platform-navigation"
          className={[
            'flex flex-col border-b border-[var(--line)] bg-[#f2f1eb] p-4 lg:border-b-0 lg:border-r lg:p-6',
            isNavigationOpen ? '' : 'hidden lg:flex',
          ].join(' ')}
        >
          <div className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              Convocatoria
            </p>
            <p className="mt-2 font-sans text-sm font-semibold">
              {(activeTab === 'oficiales'
                ? selectedOfficialExam?.convocationName
                : activeTab === 'curso' && activeAttempt
                  ? activeAttempt.convocationName
                  : selectedConvocation?.name) ??
                (canPractice ? 'Selecciona una convocatoria' : 'Solo consulta de historial')}
            </p>
          </div>
          <nav aria-label="Navegación de la plataforma" className="mt-5 grid gap-1">
            <Link
              href={challengeId ? `/retos/${challengeId}` : '/retos'}
              className="min-h-11 rounded-lg px-3 py-3 text-sm font-semibold text-[#bd3734]"
            >
              {challengeId ? '← Volver al reto' : 'Retos compartidos'}
            </Link>
            {(challengeId
              ? []
              : [
                  { key: 'crear' as const, label: 'Test por temas', icon: '＋' },
                  { key: 'oficiales' as const, label: 'Test oficiales', icon: '★' },
                  { key: 'curso' as const, label: 'Test en curso', icon: '☷' },
                  { key: 'resultados' as const, label: 'Historial de tests', icon: '▥' },
                ]
            ).map((item) => {
              const isUnavailable = !canPractice && item.key !== 'resultados';
              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={isUnavailable}
                  onClick={() => {
                    setActiveTab(item.key);
                    setIsNavigationOpen(false);
                  }}
                  aria-current={activeTab === item.key ? 'page' : undefined}
                  className={[
                    'flex min-h-11 items-center gap-3 rounded-lg px-3 text-left font-sans text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd3734]',
                    activeTab === item.key
                      ? 'bg-[#fbefec] font-semibold text-[#bd3734]'
                      : 'text-[var(--muted)] hover:bg-white',
                    isUnavailable ? 'cursor-not-allowed opacity-50' : '',
                  ].join(' ')}
                >
                  <span aria-hidden="true" className="text-lg leading-none">
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              );
            })}
          </nav>
          {!canPractice ? (
            <p className="mt-5 rounded-lg border border-[#e6d5ce] bg-white p-3 text-xs leading-5 text-[var(--muted)]">
              El acceso a nuevos tests requiere una suscripción activa. Tu historial sigue
              disponible.
            </p>
          ) : null}
          <div className="mt-auto hidden pt-8 text-xs leading-5 text-[var(--muted)] lg:block">
            <p className="font-medium text-[#302f2b]">Un test. Un paso más.</p>
            <p className="mt-2">
              Avanza pregunta a pregunta y revisa tu progreso cuando lo necesites.
            </p>
          </div>
        </aside>

        <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-7">
            <p className="text-xs text-[var(--muted)]">
              Mi espacio <span className="mx-2">/</span>
              {activeTab === 'crear'
                ? 'Test por temas'
                : activeTab === 'oficiales'
                  ? 'Test oficiales'
                  : activeTab === 'curso'
                    ? 'Test en curso'
                    : 'Historial de tests'}
            </p>
            <h1 className="mt-3 font-serif text-3xl font-normal tracking-[-0.04em] sm:text-4xl">
              {pageTitle}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">{pageDescription}</p>
            {activeTab === 'curso' && activeAttempt ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {activeAttempt.officialExamName ? (
                  <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs">
                    Examen oficial: {activeAttempt.officialExamName}
                  </span>
                ) : null}
                <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs">
                  Convocatoria: {activeAttempt.convocationName}
                </span>
                {selectedTopicNames.map((topicName) => (
                  <span
                    key={topicName}
                    className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs"
                  >
                    {topicName}
                  </span>
                ))}
                <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs">
                  {activeAttempt.questions.length} preguntas
                </span>
                <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs">
                  {activeAttempt.timeLimitSeconds
                    ? `Límite: ${formatSeconds(activeAttempt.timeLimitSeconds)}`
                    : 'Sin límite de tiempo'}
                </span>
              </div>
            ) : null}
          </div>

          {errorMessage && !(activeTab === 'resultados' && historyErrorMessage) ? (
            <p
              role="alert"
              className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {errorMessage}
            </p>
          ) : null}

          {isLoading ? (
            <p
              className="rounded-xl border border-[var(--line)] bg-white p-5 text-sm text-[var(--muted)]"
              role="status"
            >
              Cargando tu plataforma…
            </p>
          ) : null}

          {!isLoading && activeTab === 'crear' ? (
            <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(17rem,0.75fr)]">
              <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm sm:p-7">
                <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#bd3734]">
                  Configuración
                </p>
                <h2 className="mt-2 font-serif text-2xl font-normal">
                  {selectedConvocation?.name ?? 'No hay convocatorias disponibles'}
                </h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Selecciona uno o varios temas para tu test.
                </p>

                <div className="mt-6 space-y-5">
                  <label className="block">
                    <span className="mb-2 block font-sans text-sm font-semibold text-[var(--ink)]">
                      Convocatoria
                    </span>
                    <select
                      value={convocationId}
                      onChange={(event) => {
                        const nextConvocation = convocations.find(
                          (convocation) => convocation.id === event.target.value,
                        );
                        setConvocationId(event.target.value);
                        setTopicIds(nextConvocation?.topics.map((topic) => topic.id) ?? []);
                      }}
                      disabled={convocations.length === 0}
                      className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-[var(--ink)] disabled:opacity-60"
                    >
                      {convocations.map((convocation) => (
                        <option key={convocation.id} value={convocation.id}>
                          {convocation.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="font-sans text-sm font-semibold">Temas</p>
                      <button
                        type="button"
                        disabled={availableTopics.length === 0}
                        onClick={() =>
                          setTopicIds((current) =>
                            current.length === availableTopics.length
                              ? []
                              : availableTopics.map((topic) => topic.id),
                          )
                        }
                        className="min-h-10 rounded-md px-2 text-sm font-semibold text-[#a82f2c] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#bd3734]"
                      >
                        {allTopicsSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                      </button>
                    </div>
                    <TestTopicSelection
                      topics={availableTopics}
                      selectedIds={topicIds}
                      onChange={(ids) => {
                        setTopicIds(ids);
                        setErrorMessage('');
                      }}
                    />
                    <p className="mt-3 text-xs text-[var(--muted)]" aria-live="polite">
                      {availableQuestions === null
                        ? 'Calculando disponibilidad…'
                        : `${availableQuestions} preguntas disponibles`}{' '}
                      para {topicIds.length}{' '}
                      {topicIds.length === 1 ? 'tema seleccionado' : 'temas seleccionados'}.
                    </p>
                    {availableQuestions !== null &&
                    availableQuestions < QUESTION_COUNT_OPTIONS[0] ? (
                      <p role="alert" className="mt-2 text-sm text-[#a82f2c]">
                        No hay suficientes preguntas disponibles para iniciar un test.
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block font-sans text-sm font-semibold text-[var(--ink)]">
                        Número de preguntas
                      </span>
                      <select
                        value={questionCount}
                        onChange={(event) => setQuestionCount(Number(event.target.value))}
                        className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-[var(--ink)]"
                      >
                        {QUESTION_COUNT_OPTIONS.map((option) => (
                          <option
                            key={option}
                            value={option}
                            disabled={availableQuestions === null || option > availableQuestions}
                          >
                            {option} preguntas
                            {availableQuestions === null || option > availableQuestions
                              ? ' (no disponibles)'
                              : ''}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block font-sans text-sm font-semibold text-[var(--ink)]">
                        Tiempo
                      </span>
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
                  <p
                    role="alert"
                    className="mt-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                  >
                    {errorMessage}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={handleStartAttempt}
                  disabled={
                    !canPractice ||
                    isStartingAttempt ||
                    !selectedConvocation ||
                    availableQuestions === null ||
                    availableQuestions < 10 ||
                    topicIds.length === 0 ||
                    questionCount > availableQuestions
                  }
                  className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-[#bd3734] px-5 py-3 font-sans text-sm font-semibold text-white transition-colors hover:bg-[#a82f2c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd3734] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isStartingAttempt ? 'Creando test…' : 'Comenzar test'}
                </button>
              </div>

              <div className="rounded-2xl border border-[var(--line)] bg-[#eeede6] p-5 sm:p-7 xl:sticky xl:top-6">
                <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#bd3734]">
                  Resumen del test
                </p>
                <dl className="mt-4 divide-y divide-[#deded7]">
                  <div className="py-3">
                    <dt className="text-xs text-[var(--muted)]">Convocatoria</dt>
                    <dd className="mt-1 font-semibold">
                      {selectedConvocation?.name ?? 'No disponible'}
                    </dd>
                  </div>
                  <div className="py-3">
                    <dt className="text-xs text-[var(--muted)]">Temas seleccionados</dt>
                    <dd className="mt-1 font-medium">
                      {topicIds.length === 0
                        ? 'Ninguno'
                        : allTopicsSelected
                          ? `Todos los temas (${topicIds.length})`
                          : `${topicIds.length} ${topicIds.length === 1 ? 'tema' : 'temas'}`}
                      {topicIds.length > 0 && (
                        <details className="mt-2 text-sm font-normal">
                          <summary className="min-h-11 cursor-pointer rounded-md py-3 font-semibold text-[#a82f2c] focus-visible:outline-2 focus-visible:outline-[#bd3734]">
                            Ver temas seleccionados
                          </summary>
                          <ul className="mt-2 max-h-60 space-y-2 overflow-y-auto rounded-lg bg-white p-3">
                            {availableTopics
                              .filter((topic) => topicIds.includes(topic.id))
                              .map((topic) => (
                                <li key={topic.id} className="break-words leading-6">
                                  {topic.number}. {topic.name}
                                </li>
                              ))}
                          </ul>
                        </details>
                      )}
                    </dd>
                  </div>
                  <div className="grid grid-cols-2 gap-3 py-3">
                    <div>
                      <dt className="text-xs text-[var(--muted)]">Preguntas</dt>
                      <dd className="mt-1 font-semibold">{questionCount}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--muted)]">Tiempo</dt>
                      <dd className="mt-1 font-semibold">
                        {timeLimitSeconds === 0 ? 'Sin límite' : formatSeconds(timeLimitSeconds)}
                      </dd>
                    </div>
                  </div>
                </dl>
                {!canPractice ? (
                  <p className="mt-3 rounded-lg bg-white p-3 text-sm text-[var(--muted)]">
                    Activa una suscripción vigente para iniciar nuevos tests.
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          {!isLoading && activeTab === 'oficiales' ? (
            <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(17rem,0.75fr)]">
              <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm sm:p-7">
                <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#bd3734]">
                  Exámenes oficiales
                </p>
                <h2 className="mt-2 font-serif text-2xl font-normal">
                  Practica con el examen completo
                </h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Las preguntas aparecerán en su orden original. Elige el tiempo antes de empezar.
                </p>

                {officialExams.length === 0 ? (
                  <p className="mt-6 rounded-xl border border-[var(--line)] bg-[#f8f7f3] p-4 text-sm text-[var(--muted)]">
                    Todavía no hay exámenes oficiales disponibles.
                  </p>
                ) : (
                  <div className="mt-6 space-y-5">
                    <label className="block">
                      <span className="mb-2 block font-sans text-sm font-semibold text-[var(--ink)]">
                        Convocatoria
                      </span>
                      <select
                        aria-label="Convocatoria del examen oficial"
                        value={officialConvocationId}
                        onChange={(event) => {
                          const nextConvocationId = event.target.value;
                          const nextExam = officialExams.find(
                            (exam) => exam.convocationId === nextConvocationId,
                          );
                          setOfficialConvocationId(nextConvocationId);
                          setOfficialExamId(nextExam?.id ?? '');
                        }}
                        className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-[var(--ink)]"
                      >
                        {officialConvocations.map((convocation) => (
                          <option key={convocation.convocationId} value={convocation.convocationId}>
                            {convocation.convocationName}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block font-sans text-sm font-semibold text-[var(--ink)]">
                        Examen oficial
                      </span>
                      <select
                        aria-label="Examen oficial"
                        value={selectedOfficialExam?.id ?? ''}
                        onChange={(event) => setOfficialExamId(event.target.value)}
                        className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-[var(--ink)]"
                      >
                        {availableOfficialExams.map((exam) => (
                          <option key={exam.id} value={exam.id}>
                            {exam.name}
                            {exam.date ? ` · ${formatExamDate(exam.date)}` : ''}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block font-sans text-sm font-semibold text-[var(--ink)]">
                        Tiempo
                      </span>
                      <select
                        value={officialTimeLimitSeconds}
                        onChange={(event) =>
                          setOfficialTimeLimitSeconds(Number(event.target.value))
                        }
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
                )}

                <button
                  type="button"
                  onClick={() => void handleStartOfficialAttempt()}
                  disabled={!canPractice || isStartingAttempt || !selectedOfficialExam}
                  className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-[#bd3734] px-5 py-3 font-sans text-sm font-semibold text-white transition-colors hover:bg-[#a82f2c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd3734] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isStartingAttempt ? 'Preparando examen…' : 'Comenzar test oficial'}
                </button>
              </div>

              <div className="rounded-2xl border border-[var(--line)] bg-[#eeede6] p-5 sm:p-7 xl:sticky xl:top-6">
                <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#bd3734]">
                  Resumen del examen
                </p>
                {selectedOfficialExam ? (
                  <dl className="mt-4 divide-y divide-[#deded7]">
                    <div className="py-3">
                      <dt className="text-xs text-[var(--muted)]">Convocatoria</dt>
                      <dd className="mt-1 font-semibold">{selectedOfficialExam.convocationName}</dd>
                    </div>
                    <div className="py-3">
                      <dt className="text-xs text-[var(--muted)]">Examen</dt>
                      <dd className="mt-1 font-semibold">{selectedOfficialExam.name}</dd>
                    </div>
                    <div className="grid grid-cols-2 gap-3 py-3">
                      <div>
                        <dt className="text-xs text-[var(--muted)]">Preguntas</dt>
                        <dd className="mt-1 font-semibold">{selectedOfficialExam.questionCount}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--muted)]">Tiempo</dt>
                        <dd className="mt-1 font-semibold">
                          {officialTimeLimitSeconds === 0
                            ? 'Sin límite'
                            : formatSeconds(officialTimeLimitSeconds)}
                        </dd>
                      </div>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-4 text-sm text-[var(--muted)]">
                    El resumen aparecerá cuando haya un examen disponible.
                  </p>
                )}
              </div>
            </section>
          ) : null}

          {timeExpired && activeTab === 'resultados' ? (
            <p
              role="status"
              className="mb-5 rounded-lg border border-[#e6d5ce] bg-white px-4 py-3 text-sm text-[#302f2b]"
            >
              Se agotó el tiempo y el test se finalizó automáticamente.
            </p>
          ) : null}

          {!isLoading && activeTab === 'curso' ? (
            <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm sm:p-6">
              {activeTests.length > 0 ? (
                <div className="mb-5 rounded-xl bg-[#f8f7f3] p-4">
                  <h2 className="text-sm font-semibold">Tests en curso</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeTests.map((attempt) => (
                      <button
                        key={attempt.id}
                        type="button"
                        onClick={() => void handleOpenAttempt(attempt)}
                        disabled={isLoadingAttempt || activeAttempt?.id === attempt.id}
                        className="min-h-10 rounded-lg border border-[var(--line)] bg-white px-3 text-left text-sm font-medium disabled:cursor-default disabled:border-[#bd3734] disabled:text-[#a82f2c]"
                      >
                        {attempt.officialExamName
                          ? `${attempt.officialExamName} · ${attempt.convocationName}`
                          : attempt.convocationName}{' '}
                        · {attempt.questionCount} preguntas
                        {activeAttempt?.id === attempt.id ? ' · Actual' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {!activeAttempt ? (
                <div>
                  {activeTests.length > 0 ? (
                    <>
                      <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#bd3734]">
                        Elige un test
                      </p>
                      <h2 className="mt-2 font-serif text-2xl font-normal">
                        Selecciona uno de tus tests en curso para continuar.
                      </h2>
                    </>
                  ) : (
                    <>
                      <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#bd3734]">
                        Sin test en curso
                      </p>
                      <h2 className="mt-2 font-serif text-2xl font-normal">
                        No tienes ningún intento activo.
                      </h2>
                    </>
                  )}
                  {canPractice ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab('crear')}
                      className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#bd3734] px-5 py-3 font-sans text-sm font-semibold text-white"
                    >
                      Crear un test
                    </button>
                  ) : null}
                </div>
              ) : activeAttempt.challengeId &&
                activeAttempt.status === 'finalized' &&
                !activeAttempt.result ? (
                <p>
                  Has terminado el reto. Todavía hay participantes pendientes de finalizar.{' '}
                  <Link href={`/retos/${activeAttempt.challengeId}`} className="underline">
                    Ver reto
                  </Link>
                </p>
              ) : !canPractice && activeAttempt.status === 'in_progress' ? (
                <div className="max-w-2xl p-2 sm:p-4">
                  <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#bd3734]">
                    Test en curso bloqueado
                  </p>
                  <h2 className="mt-2 font-serif text-2xl font-normal">
                    Tu acceso no permite continuar este test.
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                    Activa una suscripción vigente para recuperar intentos en curso o revisar
                    preguntas. Los resultados anteriores siguen disponibles en el historial.
                  </p>
                  <Link
                    href="/planes"
                    className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#bd3734] px-5 py-3 font-sans text-sm font-semibold text-white"
                  >
                    Ver planes
                  </Link>
                </div>
              ) : (
                <>
                  <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
                    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
                      <div className="p-5 sm:p-7">
                        {currentQuestion ? (
                          <div className="space-y-6">
                            <p className="font-sans text-sm font-bold text-[#bd3734]">
                              PREGUNTA {String(currentQuestionIndex + 1).padStart(2, '0')}{' '}
                              <span className="ml-2 font-normal text-[var(--muted)]">
                                / {activeAttempt.questions.length}
                              </span>
                            </p>

                            <div>
                              <p className="text-sm text-[var(--muted)]">
                                {currentQuestion.topics.map((topic) => topic.name).join(', ') ||
                                  'Pregunta'}
                              </p>
                              <h3 className="mt-3 text-xl font-semibold leading-relaxed text-[#302f2b] sm:text-2xl">
                                {currentQuestion.text}
                              </h3>
                            </div>

                            <fieldset className="grid gap-3">
                              <legend className="sr-only">
                                {activeAttempt.status === 'finalized'
                                  ? 'Respuestas y corrección'
                                  : 'Selecciona una respuesta'}
                              </legend>
                              {currentQuestion.options.map((option, optionIndex) => {
                                const selected = currentQuestion.selectedAnswerId === option.id;
                                const showCorrection = activeAttempt.status === 'finalized';
                                const isCorrectAnswer = showCorrection && option.isCorrect === true;
                                const isSelectedIncorrect =
                                  showCorrection && selected && option.isCorrect === false;
                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    aria-pressed={selected}
                                    disabled={
                                      !canPractice ||
                                      showCorrection ||
                                      isSavingAnswer ||
                                      isFinalizingAttempt
                                    }
                                    onClick={() => handleAnswerSelection(option.id)}
                                    className={[
                                      'flex min-h-[68px] items-center gap-4 rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd3734] disabled:cursor-default sm:px-5',
                                      isCorrectAnswer
                                        ? 'border-2 border-emerald-700 bg-emerald-50 text-[#302f2b]'
                                        : isSelectedIncorrect
                                          ? 'border-2 border-[#bd3734] bg-[#fbefec] text-[#302f2b]'
                                          : selected
                                            ? 'border-2 border-[#c43b38] bg-[#fbefec] text-[#302f2b]'
                                            : 'border-[var(--line)] bg-white text-[#302f2b] hover:border-[#c43b38]',
                                    ].join(' ')}
                                  >
                                    <span
                                      className={[
                                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-sans text-sm font-semibold',
                                        isCorrectAnswer
                                          ? 'bg-emerald-700 text-white'
                                          : selected
                                            ? 'bg-[#bd3734] text-white'
                                            : 'bg-[#f6f5f0] text-[var(--muted)]',
                                      ].join(' ')}
                                    >
                                      {String.fromCharCode(65 + optionIndex)}
                                    </span>
                                    <span className="flex-1 text-sm leading-6 sm:text-base">
                                      {option.text}
                                    </span>
                                    {showCorrection && isCorrectAnswer ? (
                                      <span className="text-xs font-semibold text-emerald-800">
                                        Correcta
                                      </span>
                                    ) : null}
                                    {showCorrection && isSelectedIncorrect ? (
                                      <span className="text-xs font-semibold text-[#a82f2c]">
                                        Tu respuesta
                                      </span>
                                    ) : null}
                                    <span
                                      aria-hidden="true"
                                      className={[
                                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                                        isCorrectAnswer
                                          ? 'border-emerald-700'
                                          : selected
                                            ? 'border-[#bd3734]'
                                            : 'border-[#deded7]',
                                      ].join(' ')}
                                    >
                                      {selected || isCorrectAnswer ? (
                                        <span
                                          className={[
                                            'h-2.5 w-2.5 rounded-full',
                                            isCorrectAnswer ? 'bg-emerald-700' : 'bg-[#bd3734]',
                                          ].join(' ')}
                                        />
                                      ) : null}
                                    </span>
                                  </button>
                                );
                              })}
                            </fieldset>

                            <p className="text-sm text-[var(--muted)]" aria-live="polite">
                              {isSavingAnswer
                                ? 'Guardando respuesta…'
                                : currentQuestion.selectedAnswerId
                                  ? activeAttempt.status === 'finalized'
                                    ? currentQuestion.status === 'correcta'
                                      ? 'Respuesta correcta.'
                                      : 'Respuesta incorrecta.'
                                    : '✓ Respuesta guardada'
                                  : 'Selecciona una respuesta o déjala en blanco.'}
                            </p>
                          </div>
                        ) : null}
                      </div>

                      <div className="border-t border-[var(--line)] p-5 sm:px-7 sm:py-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                          <button
                            type="button"
                            onClick={() =>
                              setCurrentQuestionIndex((index) => Math.max(0, index - 1))
                            }
                            disabled={currentQuestionIndex === 0}
                            className="min-h-12 rounded-lg border border-[var(--line)] px-5 font-sans text-sm font-semibold text-[#302f2b] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            ← Anterior
                          </button>
                          {currentQuestionIndex < activeAttempt.questions.length - 1 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setCurrentQuestionIndex((index) =>
                                  Math.min(activeAttempt.questions.length - 1, index + 1),
                                )
                              }
                              className="min-h-12 rounded-lg bg-[#bd3734] px-5 font-sans text-sm font-semibold text-white hover:bg-[#a82f2c]"
                            >
                              Siguiente pregunta →
                            </button>
                          ) : activeAttempt.status === 'finalized' ? (
                            <button
                              type="button"
                              onClick={() => setActiveTab('resultados')}
                              className="min-h-12 rounded-lg bg-[#bd3734] px-5 font-sans text-sm font-semibold text-white hover:bg-[#a82f2c]"
                            >
                              Volver al historial
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
                        <p className="mt-5 text-xs text-[var(--muted)]">
                          {activeAttempt.status === 'in_progress'
                            ? 'Verás tus resultados al finalizar el test.'
                            : 'La corrección se muestra después de finalizar el test.'}
                        </p>
                      </div>
                    </div>

                    <aside className="grid gap-4">
                      <section
                        className="rounded-2xl bg-[#eeede6] p-5"
                        aria-label="Tiempo de sesión"
                      >
                        <p className="text-sm text-[var(--muted)]">
                          ◷ <span className="ml-2">Tiempo de sesión</span>
                        </p>
                        <div className="mt-4 flex items-end justify-between gap-2">
                          <p className="font-serif text-3xl text-[#302f2b]">
                            {activeAttempt.timeLimitSeconds !== null && activeAttempt.expiresAt
                              ? formatClock(
                                  Math.max(
                                    0,
                                    Math.ceil(
                                      (new Date(activeAttempt.expiresAt).getTime() - Date.now()) /
                                        1000,
                                    ),
                                  ),
                                )
                              : formatClock(elapsedSeconds)}
                          </p>
                          <p className="text-xs text-[var(--muted)]">
                            {activeAttempt.timeLimitSeconds !== null
                              ? 'Tiempo restante'
                              : 'Tiempo transcurrido'}
                          </p>
                        </div>
                      </section>

                      <section className="rounded-2xl border border-[var(--line)] bg-white p-5">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-sans text-sm font-semibold text-[#302f2b]">
                            Tu progreso
                          </h3>
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
                          <div
                            className="h-full rounded-full bg-[#bd3734]"
                            style={{
                              width: `${(answeredCount / activeAttempt.questions.length) * 100}%`,
                            }}
                          />
                        </div>
                        <p className="mt-3 text-xs text-[var(--muted)]">
                          {answeredCount} de {activeAttempt.questions.length} respondidas ·{' '}
                          {unansweredCount} pendientes
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
                                <span>{String(index + 1).padStart(2, '0')}</span>
                                <span
                                  aria-hidden="true"
                                  className="absolute -right-0.5 -top-1 text-[10px]"
                                >
                                  {isCurrent ? '●' : hasAnswer ? '✓' : '–'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="my-5 border-t border-[var(--line)]" />
                        {activeAttempt.status === 'in_progress' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setIsFinishConfirmationOpen(true)}
                              disabled={isSavingAnswer || isFinalizingAttempt}
                              className="min-h-12 w-full rounded-lg border border-[var(--line)] px-4 font-sans text-sm font-semibold text-[#302f2b] hover:bg-[#f8f7f3]"
                            >
                              {isFinalizingAttempt
                                ? 'Finalizando…'
                                : challengeId
                                  ? 'Entregar examen del reto'
                                  : 'Finalizar y ver resultados'}
                            </button>
                            <p className="mt-3 text-center text-xs leading-5 text-[var(--muted)]">
                              {unansweredCount > 0
                                ? `Tienes ${unansweredCount} preguntas sin responder.`
                                : 'Has respondido todas las preguntas.'}
                            </p>
                          </>
                        ) : null}
                      </section>
                    </aside>
                  </div>
                  {isFinishConfirmationOpen ? (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                      <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="finish-test-title"
                        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
                      >
                        <h2 id="finish-test-title" className="text-xl font-semibold text-[#302f2b]">
                          ¿Finalizar el test?
                        </h2>
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
                            disabled={isFinalizingAttempt || isSavingAnswer}
                            className="min-h-11 rounded-lg bg-[#bd3734] px-4 font-sans text-sm font-semibold text-white"
                          >
                            {isFinalizingAttempt ? 'Finalizando…' : 'Confirmar y finalizar'}
                          </button>
                        </div>
                      </section>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          ) : null}

          {!isLoading && activeTab === 'resultados' ? (
            <section className="space-y-6">
              {history.length === 0 && historyErrorMessage ? (
                <div
                  role="alert"
                  className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 sm:p-8"
                >
                  <p>{historyErrorMessage}</p>
                  <button
                    type="button"
                    onClick={() => void refreshHistory(0)}
                    disabled={isLoadingHistory}
                    className="mt-4 min-h-10 rounded-lg border border-red-300 bg-white px-4 font-semibold disabled:opacity-50"
                  >
                    {isLoadingHistory ? 'Cargando…' : 'Reintentar'}
                  </button>
                </div>
              ) : history.length === 0 ? (
                <div className="rounded-2xl border border-[var(--line)] bg-white p-6 sm:p-8">
                  <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#bd3734]">
                    Historial vacío
                  </p>
                  <h2 className="mt-2 font-serif text-2xl font-normal">
                    Todavía no has realizado ningún test.
                  </h2>
                  {canPractice ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab('crear')}
                      className="mt-5 min-h-11 rounded-lg bg-[#bd3734] px-5 py-3 font-sans text-sm font-semibold text-white"
                    >
                      Configurar un test
                    </button>
                  ) : null}
                </div>
              ) : (
                history.map((attempt) =>
                  attempt.challengeId && !attempt.result ? (
                    <article
                      key={attempt.id}
                      className="rounded-2xl border border-[var(--line)] bg-white p-5"
                    >
                      <p className="text-xs font-semibold text-[#bd3734]">
                        Reto · {attempt.challengeTitle}
                      </p>
                      <p className="mt-3 text-sm">
                        Has terminado el reto. Todavía hay participantes pendientes de finalizar.
                      </p>
                      <Link
                        href={'/retos/' + attempt.challengeId}
                        className="mt-3 inline-block text-sm font-semibold underline"
                      >
                        Abrir reto
                      </Link>
                    </article>
                  ) : (
                    <article
                      key={attempt.id}
                      className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm sm:p-7"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#bd3734]">
                            {attempt.challengeId ? 'Reto' : 'Resultado'} ·{' '}
                            {formatDate(attempt.startedAt)}
                          </p>
                          <h2 className="mt-2 font-serif text-3xl font-normal">
                            {attempt.result?.porcentajeAciertos ?? 0} %
                          </h2>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {attempt.officialExamName ? `${attempt.officialExamName} · ` : ''}
                            Nota {attempt.result?.nota ?? 0} / 10 · {attempt.questionCount}{' '}
                            preguntas
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          {canPractice ? (
                            <button
                              type="button"
                              onClick={() => void handleOpenAttempt(attempt)}
                              disabled={isLoadingAttempt}
                              className="min-h-11 rounded-lg border border-[var(--line)] px-4 py-2 font-sans text-sm font-semibold text-[#302f2b] hover:bg-[#f8f7f3]"
                            >
                              {isLoadingAttempt ? 'Cargando…' : 'Revisar test'}
                            </button>
                          ) : null}
                          {canPractice ? (
                            <button
                              type="button"
                              onClick={() => setActiveTab('crear')}
                              className="min-h-11 rounded-lg bg-[#bd3734] px-4 py-2 font-sans text-sm font-semibold text-white hover:bg-[#a82f2c]"
                            >
                              Crear otro test
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-xl bg-[#f8f7f3] p-4">
                          <p className="text-xs text-[var(--muted)]">Preguntas</p>
                          <p className="mt-2 text-lg font-semibold">{attempt.questionCount}</p>
                        </div>
                        <div className="rounded-xl bg-[#f8f7f3] p-4">
                          <p className="text-xs text-[var(--muted)]">Aciertos</p>
                          <p className="mt-2 text-lg font-semibold">
                            {attempt.result?.aciertos ?? 0}
                          </p>
                        </div>
                        <div className="rounded-xl bg-[#f8f7f3] p-4">
                          <p className="text-xs text-[var(--muted)]">Fallos</p>
                          <p className="mt-2 text-lg font-semibold">
                            {attempt.result?.fallos ?? 0}
                          </p>
                        </div>
                        <div className="rounded-xl bg-[#f8f7f3] p-4">
                          <p className="text-xs text-[var(--muted)]">En blanco</p>
                          <p className="mt-2 text-lg font-semibold">
                            {attempt.result?.enBlanco ?? 0}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--muted)]">
                        <p>
                          <span className="font-medium text-[#302f2b]">Temas: </span>
                          {attempt.selectedTopics.length === 0
                            ? 'Ninguno'
                            : `${attempt.selectedTopics.length} ${attempt.selectedTopics.length === 1 ? 'tema' : 'temas'}`}
                        </p>
                        <p>
                          <span className="font-medium text-[#302f2b]">Convocatoria: </span>
                          {attempt.convocationName}
                        </p>
                        <p>
                          <span className="font-medium text-[#302f2b]">Tiempo: </span>
                          {formatClock(attempt.result?.tiempoEmpleadoSegundos ?? 0)}
                        </p>
                      </div>
                      {attempt.result?.byTopic.length ? (
                        <details className="mt-5 border-t border-[var(--line)] pt-4">
                          <summary className="min-h-11 cursor-pointer rounded-md py-3 text-sm font-semibold text-[#a82f2c] focus-visible:outline-2 focus-visible:outline-[#bd3734]">
                            Ver resultados por tema
                          </summary>
                          <ul className="mt-3 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
                            {attempt.result.byTopic.map((topic) => (
                              <li
                                key={topic.topicId}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#f8f7f3] px-3 py-2 text-sm"
                              >
                                <span className="min-w-0 break-words">{topic.topicName}</span>
                                <span className="shrink-0 font-medium">
                                  {topic.porcentajeAciertos} % · {topic.questionCount} preguntas
                                </span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </article>
                  ),
                )
              )}
              {historyHasMore ? (
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => void refreshHistory((historyPage + 1) * HISTORY_PAGE_SIZE, true)}
                    disabled={isLoadingHistory}
                    className="min-h-11 rounded-lg border border-[var(--line)] bg-white px-4 text-sm font-semibold disabled:opacity-50"
                  >
                    {isLoadingHistory ? 'Cargando…' : 'Ver más tests'}
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
