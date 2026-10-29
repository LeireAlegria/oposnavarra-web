'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { demoOperation, type DemoAttempt, type DemoAvailable } from '@/lib/free-demo';
import { trackDemoEvent } from '@/lib/demo-analytics';
import { DemoTrackedLink } from '@/components/demo-measurement';

const STORAGE_KEY = 'oposnavarra_demo_recovery';
const buttonClass =
  'inline-flex min-h-12 items-center justify-center rounded-lg bg-[#b94235] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50';
function newToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
function reportSaved(attempt: DemoAttempt) {
  trackDemoEvent({
    name: 'result_saved',
    demoVersion: attempt.version,
    eventId: attempt.claimEventId ?? undefined,
  });
  if (attempt.registeredFromDemo)
    trackDemoEvent({
      name: 'registration_completed',
      demoVersion: attempt.version,
      eventId: attempt.claimEventId ?? undefined,
    });
}
export function FreeDemo({
  available,
  authenticated = false,
  autoRestore = true,
}: {
  available: DemoAvailable | null;
  authenticated?: boolean;
  autoRestore?: boolean;
}) {
  const [attempt, setAttempt] = useState<DemoAttempt | null>(null);
  const [token, setToken] = useState('');
  const tokenRef = useRef('');
  const [selection, setSelection] = useState('');
  const [feedback, setFeedback] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [storageWarning, setStorageWarning] = useState(false);
  const [recoveryChecked, setRecoveryChecked] = useState(!autoRestore);
  const [claimOnReturn, setClaimOnReturn] = useState(false);
  const [recoveryFailed, setRecoveryFailed] = useState(false);
  const busyRef = useRef(false);
  const initialized = useRef(false);
  const contentRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (attempt && !busy) contentRef.current?.focus();
  }, [attempt, feedback, busy]);
  const saveToken = useCallback((value: string) => {
    tokenRef.current = value;
    setToken(value);
    try {
      sessionStorage.setItem(STORAGE_KEY, value);
    } catch {
      setStorageWarning(true);
    }
    // The fragment is not sent in HTTP requests and never contains answers.
    window.history.replaceState(null, '', `${window.location.pathname}#token=${value}`);
  }, []);
  const restore = useCallback(
    async (value: string, claim: boolean) => {
      busyRef.current = true;
      setBusy(true);
      setError('');
      setRecoveryFailed(false);
      try {
        const restored = await demoOperation({ action: 'restore', token: value });
        setAttempt(restored);
        saveToken(value);
        if (claim && authenticated && restored.state === 'completed') {
          try {
            const claimed = await demoOperation({ action: 'claim', token: value });
            setAttempt(claimed);
            reportSaved(claimed);
          } catch (problem) {
            setError(
              problem instanceof Error
                ? problem.message
                : 'No se pudo guardar el resultado. Puedes reintentarlo.',
            );
          }
        }
      } catch (problem) {
        setRecoveryFailed(true);
        setError(problem instanceof Error ? problem.message : 'No se pudo recuperar la prueba.');
      } finally {
        busyRef.current = false;
        setBusy(false);
        setRecoveryChecked(true);
      }
    },
    [authenticated, saveToken],
  );
  useEffect(() => {
    if (!autoRestore || initialized.current) return;
    initialized.current = true;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    let saved = fragment.get('token');
    const claim = fragment.get('guardar') === '1';
    setClaimOnReturn(claim);
    try {
      saved = saved ?? sessionStorage.getItem(STORAGE_KEY);
    } catch {
      setStorageWarning(true);
    }
    if (saved && /^[a-f0-9]{64}$/.test(saved)) {
      tokenRef.current = saved;
      setToken(saved);
      void restore(saved, claim);
    } else setRecoveryChecked(true);
  }, [autoRestore, restore]);
  async function checkAnswer() {
    if (!selection || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      let current = attempt;
      let credential = tokenRef.current;
      if (!credential) {
        credential = newToken();
        saveToken(credential);
      }
      if (!current) {
        current = await demoOperation({ action: 'start', token: credential });
        setAttempt(current);
        trackDemoEvent({
          name: 'demo_started',
          demoVersion: current.version,
          audience: authenticated ? 'authenticated' : 'anonymous',
        });
      }
      const result = await demoOperation({
        action: 'answer',
        token: credential,
        position: current.answered,
        option: selection,
      });
      setAttempt(result);
      setFeedback(result.state === 'started');
      trackDemoEvent({
        name: 'question_completed',
        demoVersion: result.version,
        position: result.answered,
      });
      if (result.state === 'completed')
        trackDemoEvent({
          name: 'demo_completed',
          demoVersion: result.version,
          eventId: result.completionEventId ?? undefined,
        });
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : 'No se pudo comprobar. Vuelve a intentarlo.',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function claim() {
    if (!token || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const claimed = await demoOperation({ action: 'claim', token });
      setAttempt(claimed);
      reportSaved(claimed);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : 'No se pudo guardar el resultado. Vuelve a intentarlo.',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function restart() {
    setAttempt(null);
    setToken('');
    tokenRef.current = '';
    setSelection('');
    setFeedback(false);
    setError('');
    setClaimOnReturn(false);
    setRecoveryFailed(false);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
    window.history.replaceState(null, '', window.location.pathname);
  }
  const question = attempt?.question ?? available?.question;
  const completed = attempt && (attempt.state === 'completed' || attempt.state === 'claimed');
  const last = attempt?.results.at(-1);
  const returnPath = `/prueba-gratis#token=${token}&guardar=1`;
  return (
    <section
      ref={contentRef}
      tabIndex={-1}
      aria-label="Prueba gratuita"
      className="min-w-0 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm sm:p-7"
    >
      <p className="eyebrow !text-[#a8392f]">Cinco preguntas · Sin registro · Sin tarjeta</p>
      <p className="mb-5 text-sm text-[var(--muted)]">
        Demostración sin cronómetro ni penalización. No es una simulación oficial de examen.
      </p>
      {storageWarning && (
        <p role="status" className="mb-4">
          La recuperación automática no está disponible. Conserva el enlace de continuidad para
          volver desde otro dispositivo.
        </p>
      )}
      {!recoveryChecked || busy ? (
        <p role="status">{busy ? 'Procesando…' : 'Recuperando tu prueba…'}</p>
      ) : null}
      {error && (
        <p role="alert" className="my-4 rounded-lg bg-red-50 p-3 text-red-900">
          {error}
        </p>
      )}
      {claimOnReturn && !authenticated && (
        <p className="my-3">
          Tu cuenta sigue disponible.{' '}
          <Link className="underline" href={`/acceder?next=${encodeURIComponent(returnPath)}`}>
            Inicia sesión para guardar el resultado
          </Link>
          .
        </p>
      )}
      {completed ? (
        <div className="space-y-5">
          <h2 className="text-3xl" tabIndex={-1}>
            Tu resultado: {attempt.score} de 5
          </h2>
          <p role="status">
            {attempt.score * 20}% de aciertos en esta prueba. Cinco preguntas no permiten valorar tu
            nivel general.
          </p>
          {attempt.state === 'claimed' ? (
            <div className="rounded-lg bg-emerald-50 p-4">
              <p role="status">Resultado guardado como «Prueba gratuita».</p>
              <Link className="underline" href="/prueba-gratis/resultados">
                Ver mis pruebas gratuitas
              </Link>
              <p>No se incorpora a tus estadísticas de preparación.</p>
            </div>
          ) : authenticated ? (
            <button disabled={busy} className={buttonClass} onClick={claim}>
              Guardar resultado
            </button>
          ) : (
            <div className="space-y-3">
              <DemoTrackedLink
                className={buttonClass}
                href={`/registro?next=${encodeURIComponent(returnPath)}`}
                name="registration_started"
                location="result"
              >
                Crea tu cuenta y guarda este resultado
              </DemoTrackedLink>
              <p className="text-sm">
                Registrarte no contrata una suscripción. Consulta los planes para acceder al
                contenido de pago.
              </p>
              <Link
                className="block underline"
                href={`/acceder?next=${encodeURIComponent(returnPath)}`}
              >
                Ya tengo cuenta
              </Link>
            </div>
          )}
          <DemoTrackedLink
            href="/planes"
            className="block underline"
            name="plans_opened"
            location="result"
          >
            Ver qué incluye la suscripción
          </DemoTrackedLink>
          <ol className="space-y-6">
            {attempt.results.map((result, index) => (
              <li key={result.id} className="space-y-2 border-t pt-5">
                <h3 className="text-lg">
                  {index + 1}. {result.text}
                </h3>
                <p className="font-semibold">
                  {result.correct ? 'Respuesta correcta' : 'Respuesta incorrecta'}
                </p>
                <p>
                  Tu respuesta:{' '}
                  {result.options.find((option) => option.id === result.selectedOptionId)?.text}
                </p>
                <p>
                  Respuesta correcta:{' '}
                  {result.options.find((option) => option.id === result.correctOptionId)?.text}
                </p>
                <p className="whitespace-pre-wrap">{result.explanation}</p>
                {result.reference && <p className="text-sm">Referencia: {result.reference}</p>}
              </li>
            ))}
          </ol>
          <p className="text-sm">
            La repetición utiliza las mismas preguntas y no representa una nueva evaluación.
          </p>
          <button className={buttonClass} disabled={busy} onClick={restart}>
            Repetir la prueba
          </button>
          <Link className="ml-4 underline" href="/plataforma">
            Ir a mi área personal
          </Link>
        </div>
      ) : feedback && last ? (
        <div className="space-y-4" aria-live="polite">
          <h2 className="text-2xl">
            {last.correct ? 'Respuesta correcta' : 'Respuesta incorrecta'}
          </h2>
          <p>
            Respuesta correcta:{' '}
            {last.options.find((option) => option.id === last.correctOptionId)?.text}
          </p>
          <p className="whitespace-pre-wrap">{last.explanation}</p>
          {last.reference && <p>Referencia: {last.reference}</p>}
          <button
            className={buttonClass}
            onClick={() => {
              setFeedback(false);
              setSelection('');
            }}
          >
            Siguiente pregunta
          </button>
        </div>
      ) : question && recoveryChecked && !recoveryFailed ? (
        <div className="space-y-5">
          <p aria-live="polite">Pregunta {(attempt?.answered ?? 0) + 1} de 5</p>
          <progress
            className="w-full accent-[#173c3a]"
            max={5}
            value={attempt?.answered ?? 0}
            aria-label="Preguntas comprobadas"
          />
          <fieldset disabled={busy} className="space-y-3">
            <legend className="mb-5 text-xl leading-relaxed">{question.text}</legend>
            {question.options.map((option) => (
              <label
                key={option.id}
                className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border p-3 ${selection === option.id ? 'border-[#173c3a] bg-[#f0f5f1]' : 'border-[var(--line)]'}`}
              >
                <input
                  className="mt-1 accent-[#173c3a]"
                  type="radio"
                  name="demo-answer"
                  value={option.id}
                  checked={selection === option.id}
                  onChange={() => setSelection(option.id)}
                />
                <span className="min-w-0 break-words">{option.text}</span>
              </label>
            ))}
          </fieldset>
          <button className={buttonClass} disabled={busy || !selection} onClick={checkAnswer}>
            Comprobar respuesta
          </button>
        </div>
      ) : recoveryChecked && !busy ? (
        <div className="space-y-3">
          <h2 className="text-xl">La prueba gratuita no está disponible en este momento</h2>
          <p>Necesitamos cinco preguntas válidas para ofrecerte esta demostración.</p>
          <Link href="/tests" className="underline">
            Consultar el temario disponible
          </Link>
          <Link href="/contacto" className="ml-4 underline">
            Contactar
          </Link>
        </div>
      ) : null}
      {token && (
        <div className="mt-6 space-y-2 border-t pt-4 text-sm">
          <p>
            El enlace de continuidad permite recuperar esta prueba durante 24 horas. Consérvalo de
            forma privada.
          </p>
          <a
            href={`/prueba-gratis#token=${token}`}
            className="underline"
            referrerPolicy="no-referrer"
          >
            Enlace de continuidad
          </a>
          {!completed && (
            <button
              disabled={busy}
              className="ml-4 underline"
              onClick={() => void restore(token, false)}
            >
              Recuperar avance
            </button>
          )}
          <button disabled={busy} className="ml-4 underline" onClick={restart}>
            Iniciar una prueba nueva
          </button>
        </div>
      )}
    </section>
  );
}
