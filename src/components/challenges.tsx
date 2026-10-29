'use client';

import Link from 'next/link';
import { ChallengePlatformShell } from './challenge-platform-shell';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CLOSE_CHALLENGE_WARNING,
  closeChallenge,
  createChallenge,
  getChallenge,
  getInvitation,
  joinChallenge,
  listChallenges,
  startChallenge,
  type Challenge,
} from '@/lib/challenges';
import {
  countAvailableTestQuestions,
  getTestCatalog,
  type TestConvocation,
} from '@/lib/test-platform-api';

const buttonClass =
  'min-h-11 rounded-lg border border-[#e5e1d8] bg-white px-4 py-2 text-sm font-semibold hover:bg-[#f7f5f0] disabled:opacity-40';
const primaryClass =
  'min-h-11 rounded-lg bg-[#bd3734] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a82f2c] disabled:opacity-40';
const inputClass = 'mt-1 w-full rounded-lg border border-[#d9d5cc] bg-white px-3 py-2 text-sm';
const duration = (seconds: number | null) =>
  seconds ? `${seconds / 60} minutos` : 'Sin límite de tiempo';
const time = (seconds: number | null) =>
  seconds === null ? '—' : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

function ChallengeSummary({ challenge }: { challenge: Challenge }) {
  return (
    <div className="space-y-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-[#a82f2c]">
        Reto {challenge.status}
      </span>
      <h1 className="break-words font-serif text-3xl sm:text-4xl">{challenge.title}</h1>
      <p className="text-sm text-[#777468]">
        Creado por {challenge.creatorName} · {challenge.convocationName}
      </p>
      <p className="text-sm">
        {challenge.questionCount} preguntas · {duration(challenge.durationSeconds)}
      </p>
      <details>
        <summary className="cursor-pointer text-sm">
          Temas del reto ({challenge.topics.length})
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#777468]">
          {challenge.topics.map((topic, index) => (
            <li key={index}>{topic}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function Challenges({
  id,
  token,
  authenticated,
  canCreate = false,
}: {
  id?: string;
  token?: string;
  authenticated: boolean;
  canCreate?: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Challenge[]>([]);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState('all');
  const [copied, setCopied] = useState(false);
  const load = useCallback(async () => {
    try {
      if (token) setChallenge(await getInvitation(token));
      else if (id) setChallenge(await getChallenge(id));
      else setItems(await listChallenges());
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudieron cargar los retos.');
    } finally {
      setLoading(false);
    }
  }, [id, token]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!challenge || challenge.status === 'cerrado' || !challenge.isParticipant) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [challenge, load]);
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await work();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo completar la operación.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <ChallengePlatformShell>
      <div className="space-y-6">
        <nav className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/plataforma" className="text-sm font-semibold text-[#a82f2c]">
            ← Plataforma
          </Link>
          <Link href="/retos" className="text-sm font-semibold">
            Mis retos
          </Link>
        </nav>
        {loading && <p role="status">Cargando retos…</p>}
        {message && (
          <div
            role="alert"
            className="rounded-xl border border-[#edc5bf] bg-[#fff5f2] p-4 text-sm text-[#a82f2c]"
          >
            {message}
            <button type="button" className={`${buttonClass} ml-3`} onClick={() => void load()}>
              Actualizar
            </button>
          </div>
        )}
        {!loading && !id && !token && (
          <>
            <header className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#a82f2c]">
                  Practica en compañía
                </p>
                <h1 className="mt-2 font-serif text-4xl">Tus retos</h1>
                <p className="mt-2 text-sm text-[#777468]">
                  El mismo examen, a vuestro ritmo. Resultados al cerrar el reto.
                </p>
              </div>
              <button
                className={primaryClass}
                type="button"
                disabled={!canCreate}
                onClick={() => setShowCreate(!showCreate)}
              >
                {showCreate ? 'Cerrar configuración' : 'Crear reto'}
              </button>
            </header>
            {!canCreate && (
              <p className="rounded-xl bg-white p-4 text-sm">
                Necesitas una suscripción activa para crear o unirte a retos. Puedes consultar tus
                resultados y cerrar los que has creado.
              </p>
            )}
            {showCreate && (
              <CreateChallengeForm
                onCreated={(challengeId) => router.push(`/retos/${challengeId}`)}
              />
            )}
            <label className="block max-w-xs text-sm">
              Mostrar
              <select
                className={inputClass}
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                <option value="all">Todos los retos</option>
                <option value="abierto">Abiertos</option>
                <option value="cerrado">Cerrados</option>
                <option value="created">Creados por mí</option>
              </select>
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              {items
                .filter(
                  (item) =>
                    filter === 'all' ||
                    item.status === filter ||
                    (filter === 'created' && item.isCreator),
                )
                .map((item) => (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-[#e5e1d8] bg-white p-5"
                  >
                    <p className="text-xs font-semibold text-[#a82f2c]">
                      {item.status === 'abierto' ? 'Abierto' : 'Cerrado'} ·{' '}
                      {item.isCreator ? 'Creado por ti' : 'Participas'}
                    </p>
                    <h2 className="mt-2 break-words text-xl font-semibold">{item.title}</h2>
                    <p className="mt-2 text-sm text-[#777468]">
                      {item.questionCount} preguntas · {item.convocationName}
                    </p>
                    <Link className={`${buttonClass} mt-4 inline-block`} href={`/retos/${item.id}`}>
                      Abrir reto
                    </Link>
                  </article>
                ))}
            </div>
            {!items.filter(
              (item) =>
                filter === 'all' ||
                item.status === filter ||
                (filter === 'created' && item.isCreator),
            ).length && (
              <p className="rounded-xl border border-dashed border-[#d9d5cc] p-8 text-center text-sm text-[#777468]">
                No hay retos en esta vista. Crea uno o únete mediante un enlace de invitación.
              </p>
            )}
          </>
        )}
        {challenge && (
          <article className="space-y-6 rounded-2xl border border-[#e5e1d8] bg-white p-5 sm:p-8">
            <ChallengeSummary challenge={challenge} />
            {!challenge.isParticipant ? (
              <div className="space-y-4 border-t border-[#eeeae3] pt-5">
                <p className="text-sm">
                  {challenge.status === 'cerrado'
                    ? 'Este reto está cerrado.'
                    : challenge.canJoin
                      ? 'El reto admite incorporaciones. Al unirte ocuparás una plaza y podrás realizar un único intento.'
                      : 'El reto no tiene plazas disponibles.'}
                </p>
                {!authenticated ? (
                  <div className="flex flex-wrap gap-3">
                    <Link
                      className={primaryClass}
                      href={`/acceder?next=${encodeURIComponent(`/retos/invitacion/${token}`)}`}
                    >
                      Iniciar sesión para unirme
                    </Link>
                    <Link
                      className={buttonClass}
                      href={`/registro?next=${encodeURIComponent(`/retos/invitacion/${token}`)}`}
                    >
                      Crear cuenta
                    </Link>
                  </div>
                ) : (
                  challenge.canJoin && (
                    <form
                      className="space-y-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void action(async () =>
                          router.push(`/retos/${await joinChallenge(token!, name)}`),
                        );
                      }}
                    >
                      <label className="block max-w-md text-sm">
                        Nombre visible en el reto
                        <input
                          className={inputClass}
                          required
                          maxLength={80}
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          placeholder="Elige un alias; no uses tu correo"
                        />
                      </label>
                      <button className={primaryClass} disabled={busy}>
                        Unirme al reto
                      </button>
                    </form>
                  )
                )}
              </div>
            ) : (
              <>
                {token && (
                  <Link className={`${buttonClass} inline-block`} href={`/retos/${challenge.id}`}>
                    Abrir mi reto
                  </Link>
                )}
                {challenge.status === 'abierto' && (
                  <div className="space-y-4 rounded-xl bg-[#f7f5f0] p-4">
                    {challenge.attemptStatus === 'finalizado' ? (
                      <p role="status">
                        Has terminado el reto. Todavía hay participantes pendientes de finalizar.
                      </p>
                    ) : (
                      <>
                        <p className="text-sm">
                          {challenge.attemptId
                            ? 'Tu intento está guardado. El tiempo sigue transcurriendo aunque salgas.'
                            : 'El tiempo empieza cuando comiences. Solo tienes un intento y no se reinicia al salir.'}
                        </p>
                        <button
                          className={primaryClass}
                          disabled={busy}
                          onClick={() =>
                            void action(async () => {
                              await startChallenge(challenge.id);
                              router.push(`/retos/${challenge.id}/examen`);
                            })
                          }
                        >
                          {busy
                            ? 'Preparando…'
                            : challenge.attemptId
                              ? 'Retomar mi examen'
                              : 'Comenzar mi examen'}
                        </button>
                      </>
                    )}
                  </div>
                )}
                {challenge.isCreator && challenge.status === 'abierto' && (
                  <section className="space-y-4 border-t border-[#eeeae3] pt-5">
                    <h2 className="font-semibold">Invitación y cierre</h2>
                    <p className="text-sm text-[#777468]">
                      Puedes compartir el enlace antes de hacer tu examen. Las soluciones estarán
                      ocultas hasta el cierre.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        className={buttonClass}
                        disabled={busy}
                        onClick={() =>
                          void action(async () => {
                            await navigator.clipboard.writeText(
                              `${window.location.origin}/retos/invitacion/${challenge.invitationToken}`,
                            );
                            setCopied(true);
                          })
                        }
                      >
                        {copied ? 'Enlace copiado' : 'Copiar enlace'}
                      </button>
                      <button
                        className={buttonClass}
                        disabled={busy}
                        onClick={() => setConfirmClose(true)}
                      >
                        Cerrar reto y publicar resultados
                      </button>
                    </div>
                    {confirmClose && (
                      <div className="space-y-4 rounded-xl border border-[#e4c998] bg-[#fffbf2] p-4">
                        <h3 className="font-semibold">¿Cerrar el reto definitivamente?</h3>
                        <p className="text-sm leading-6">{CLOSE_CHALLENGE_WARNING}</p>
                        <div className="flex flex-wrap gap-3">
                          <button
                            className={buttonClass}
                            disabled={busy}
                            onClick={() => setConfirmClose(false)}
                          >
                            Seguir con el reto abierto
                          </button>
                          <button
                            className={primaryClass}
                            disabled={busy}
                            onClick={() =>
                              void action(async () => {
                                setChallenge(await closeChallenge(challenge.id));
                                setConfirmClose(false);
                              })
                            }
                          >
                            {busy ? 'Cerrando…' : 'Confirmar cierre y publicar'}
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                )}
                {challenge.status === 'cerrado' && (
                  <section className="space-y-4 border-t border-[#eeeae3] pt-5">
                    <h2 className="font-serif text-2xl">Clasificación del reto</h2>
                    <p className="text-sm text-[#777468]">
                      Nota descendente y menor tiempo en caso de empate. Los empates completos
                      comparten posición.
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr>
                            {[
                              'Posición',
                              'Participante',
                              'Nota',
                              'Aciertos',
                              'Errores',
                              'Blancos',
                              'Tiempo',
                              'Entrega',
                            ].map((heading) => (
                              <th key={heading} className="whitespace-nowrap border-b p-3">
                                {heading}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {challenge.ranking?.map((entry, index) => (
                            <tr key={index} className={entry.isMe ? 'bg-[#fbefec]' : ''}>
                              <td className="p-3">{entry.position ?? '—'}</td>
                              <td className="p-3">
                                {entry.name}
                                {entry.isMe ? ' (tú)' : ''}
                              </td>
                              <td className="p-3">{entry.score ?? '—'}</td>
                              <td className="p-3">{entry.correct ?? '—'}</td>
                              <td className="p-3">{entry.incorrect ?? '—'}</td>
                              <td className="p-3">{entry.blank ?? '—'}</td>
                              <td className="whitespace-nowrap p-3">{time(entry.seconds)}</td>
                              <td className="whitespace-nowrap p-3">
                                {entry.notStarted
                                  ? 'No realizado'
                                  : entry.deliveryReason === 'cierre_reto'
                                    ? 'Cierre del creador'
                                    : entry.deliveryReason === 'tiempo_agotado'
                                      ? 'Tiempo agotado'
                                      : 'Entregado'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {challenge.attemptId && (
                      <Link
                        className={`${primaryClass} inline-block`}
                        href={`/retos/${challenge.id}/examen`}
                      >
                        Revisar mi corrección
                      </Link>
                    )}
                  </section>
                )}
              </>
            )}
          </article>
        )}
      </div>
    </ChallengePlatformShell>
  );
}

function CreateChallengeForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [catalog, setCatalog] = useState<TestConvocation[]>([]);
  const [convocationId, setConvocationId] = useState('');
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [name, setName] = useState('');
  const [count, setCount] = useState(20);
  const [seconds, setSeconds] = useState(600);
  const [participants, setParticipants] = useState(2);
  const [available, setAvailable] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    void getTestCatalog()
      .then((items) => {
        if (active) {
          setCatalog(items);
          setConvocationId(items[0]?.id ?? '');
          setTopicIds(items[0]?.topics.map((topic) => topic.id) ?? []);
        }
      })
      .catch(() => {
        if (active)
          setMessage('No se pudo cargar el catálogo. Cierra y vuelve a abrir la configuración.');
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setAvailable(null);
    if (convocationId && topicIds.length)
      void countAvailableTestQuestions(convocationId, topicIds)
        .then((total) => {
          if (active) setAvailable(total);
        })
        .catch(() => {
          if (active) setMessage('No se pudo comprobar la disponibilidad.');
        });
    return () => {
      active = false;
    };
  }, [convocationId, topicIds]);
  return (
    <form
      className="space-y-4 rounded-2xl border border-[#e5e1d8] bg-white p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage('');
        try {
          onCreated(
            await createChallenge({
              title,
              name,
              convocationId,
              topicIds,
              questionCount: count,
              durationSeconds: seconds || null,
              participants,
            }),
          );
        } catch (error) {
          setMessage(error instanceof Error ? error.message : 'No se pudo crear el reto.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-xl font-semibold">Crear un reto</h2>
      {message && (
        <p role="alert" className="text-sm text-[#a82f2c]">
          {message}
        </p>
      )}
      <fieldset disabled={busy} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Título
            <input
              className={inputClass}
              required
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="text-sm">
            Tu nombre visible
            <input
              className={inputClass}
              required
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Alias, sin correo electrónico"
            />
          </label>
        </div>
        <label className="block text-sm">
          Convocatoria
          <select
            className={inputClass}
            value={convocationId}
            onChange={(event) => {
              setConvocationId(event.target.value);
              setTopicIds(
                catalog
                  .find((item) => item.id === event.target.value)
                  ?.topics.map((topic) => topic.id) ?? [],
              );
            }}
          >
            {catalog.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-semibold">
            Temas · Todos seleccionados inicialmente
          </legend>
          {catalog
            .find((item) => item.id === convocationId)
            ?.topics.map((topic, index, topics) => (
              <div key={topic.id}>
                {(index === 0 || topic.blockId !== topics[index - 1].blockId) && (
                  <h3 className="mb-2 text-xs font-semibold text-[#777468]">{topic.blockName}</h3>
                )}
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={topicIds.includes(topic.id)}
                    onChange={(event) =>
                      setTopicIds(
                        event.target.checked
                          ? [...topicIds, topic.id]
                          : topicIds.filter((id) => id !== topic.id),
                      )
                    }
                  />
                  {topic.number}. {topic.name}
                </label>
              </div>
            ))}
        </fieldset>
        <p className="text-xs text-[#777468]">
          {!topicIds.length
            ? 'Selecciona al menos un tema.'
            : available === null
              ? 'Comprobando preguntas…'
              : `${available} preguntas elegibles, sin repeticiones.`}
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm">
            Preguntas
            <input
              className={inputClass}
              type="number"
              min={1}
              max={Math.min(available ?? 0, 999)}
              required
              value={count}
              onChange={(event) => setCount(Number(event.target.value))}
            />
          </label>
          <label className="text-sm">
            Tiempo por participante
            <select
              className={inputClass}
              value={seconds}
              onChange={(event) => setSeconds(Number(event.target.value))}
            >
              {[0, 600, 1200, 1800, 2700, 3600].map((value) => (
                <option key={value} value={value}>
                  {duration(value || null)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Plazas totales (te incluyen)
            <input
              className={inputClass}
              type="number"
              required
              min={2}
              step={1}
              value={participants}
              onChange={(event) => setParticipants(Number(event.target.value))}
            />
          </label>
        </div>
        <p className="text-xs text-[#777468]">
          La configuración se bloqueará al crear el reto. Podrás compartirlo antes de comenzar tu
          intento.
        </p>
        <button
          className={primaryClass}
          disabled={!available || !topicIds.length || count > available || count < 1 || count > 999}
        >
          {busy ? 'Creando…' : 'Crear reto y obtener enlace'}
        </button>
      </fieldset>
    </form>
  );
}
