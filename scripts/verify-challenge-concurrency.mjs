// Opt-in integration test for a disposable Supabase project with three subscribed test accounts.
// Tokens stay in environment variables and are never printed. No messages or invitations are sent.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const tokens = JSON.parse(process.env.RETO_TEST_ACCESS_TOKENS ?? '[]');
if (tokens.length < 3)
  throw new Error(
    'Provide RETO_TEST_ACCESS_TOKENS with three subscribed test-account access tokens in a disposable Supabase project.',
  );
const clients = tokens
  .slice(0, 3)
  .map((token) =>
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      },
    ),
  );
const call = async (client, name, args = {}) => {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
};
const creator = clients[0];
const created = [];
try {
  const catalog = await call(creator, 'consultar_catalogo_test');
  let config;
  for (const item of catalog) {
    const topicIds = item.topics.map((topic) => topic.id);
    if (!topicIds.length) continue;
    if (
      (await call(creator, 'contar_preguntas_test', {
        p_convocatoria_id: item.id,
        p_temas_seleccionados: topicIds,
      })) >= 2
    ) {
      config = { item, topicIds };
      break;
    }
  }
  assert.ok(config, 'At least two published questions are needed.');
  const create = async (places) => {
    const id = await call(creator, 'crear_reto', {
      p_titulo: 'Integración concurrencia',
      p_convocatoria_id: config.item.id,
      p_temas: config.topicIds,
      p_numero_preguntas: 2,
      p_duracion_segundos: 600,
      p_participantes: places,
      p_nombre_visible: 'Creador de prueba',
    });
    created.push(id);
    return id;
  };
  const id = await create(2);
  const detail = await call(creator, 'consultar_reto', { p_reto_id: id });
  const joins = await Promise.allSettled(
    clients
      .slice(1)
      .map((client, index) =>
        call(client, 'unirse_reto', {
          p_token: detail.invitationToken,
          p_nombre_visible: `Invitado ${index + 1}`,
        }),
      ),
  );
  assert.equal(
    joins.filter((result) => result.status === 'fulfilled').length,
    1,
    'Exactly one simultaneous join wins the last place.',
  );
  const guest = clients[joins[0].status === 'fulfilled' ? 1 : 2];
  const starts = await Promise.all([
    call(creator, 'comenzar_reto', { p_reto_id: id }),
    call(creator, 'comenzar_reto', { p_reto_id: id }),
  ]);
  assert.equal(starts[0], starts[1], 'Concurrent starts reuse one attempt.');
  const guestAttempt = await call(guest, 'comenzar_reto', { p_reto_id: id });
  const exam = await call(guest, 'consultar_intento_test', { p_test_intento_id: guestAttempt });
  const q = exam.questions[0];
  await Promise.allSettled([
    call(guest, 'guardar_respuesta_test', {
      p_test_intento_id: guestAttempt,
      p_pregunta_id: q.id,
      p_respuesta_id: q.options[0].id,
    }),
    call(guest, 'finalizar_intento_test', { p_test_intento_id: guestAttempt }),
    call(creator, 'cerrar_reto', { p_reto_id: id }),
    call(creator, 'cerrar_reto', { p_reto_id: id }),
  ]);
  const closed = await call(creator, 'consultar_reto', { p_reto_id: id });
  assert.equal(closed.status, 'cerrado');
  assert.equal(closed.ranking.length, 2);
  const before = await call(guest, 'consultar_intento_test', { p_test_intento_id: guestAttempt });
  assert.equal(
    await call(guest, 'guardar_respuesta_test', {
      p_test_intento_id: guestAttempt,
      p_pregunta_id: q.id,
      p_respuesta_id: q.options[1].id,
    }),
    false,
  );
  assert.deepEqual(
    await call(guest, 'consultar_intento_test', { p_test_intento_id: guestAttempt }),
    before,
    'No late write changes a closed correction.',
  );
  const enrollmentId = await create(3);
  const enrollment = await call(creator, 'consultar_reto', { p_reto_id: enrollmentId });
  await Promise.allSettled([
    call(clients[1], 'unirse_reto', {
      p_token: enrollment.invitationToken,
      p_nombre_visible: 'Invitado',
    }),
    call(creator, 'cerrar_reto', { p_reto_id: enrollmentId }),
  ]);
  assert.equal(
    (await call(creator, 'consultar_reto', { p_reto_id: enrollmentId })).status,
    'cerrado',
  );
  await assert.rejects(() =>
    call(clients[2], 'unirse_reto', {
      p_token: enrollment.invitationToken,
      p_nombre_visible: 'Tardío',
    }),
  );
  await assert.rejects(() => call(creator, 'comenzar_reto', { p_reto_id: enrollmentId }));
  console.log(
    'Concurrent last-place, start, save/delivery/closure and enrollment/closure tests passed.',
  );
} finally {
  for (const id of created) await call(creator, 'cerrar_reto', { p_reto_id: id }).catch(() => {});
}
