// Optional local PostgreSQL smoke test. PGLITE_MODULE_PATH points at a temporary PGlite installation.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

if (!process.env.PGLITE_MODULE_PATH)
  throw new Error('Set PGLITE_MODULE_PATH to the installed @electric-sql/pglite entry point.');
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href);
const db = new PGlite();
await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth; CREATE SCHEMA extensions;
  CREATE TABLE auth.users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb, aud text, role text, encrypted_password text);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
  CREATE FUNCTION public.comprobar_acceso_suscripcion(uuid DEFAULT auth.uid()) RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.access',true),'true') = 'true' $$;
  CREATE FUNCTION public.es_admin_actual() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
  CREATE FUNCTION public.exigir_rol_admin() RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;
  -- PGlite has no pgcrypto/pg_cron. Replace only randomness and the scheduling adapter in this smoke test.
  CREATE FUNCTION extensions.gen_random_bytes(integer) RETURNS bytea LANGUAGE sql AS $$ SELECT decode(replace(gen_random_uuid()::text || gen_random_uuid()::text,'-',''),'hex') $$;
`);
for (const file of [
  '20261004000100_database_foundation.sql',
  '20261009000001_user_authentication_profiles.sql',
  '20261013000000_test_application.sql',
  '20261015000000_secure_test_platform.sql',
  '20261018000001_official_test_mode.sql',
  '20261020000000_bon_import_and_topic_blocks.sql',
  '20261022000000_shared_challenges.sql',
]) {
  let sql = await readFile(`supabase/migrations/${file}`, 'utf8');
  if (file.includes('shared_challenges'))
    sql = sql
      .replace(/CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;/, '')
      .replace(/SELECT cron\.schedule\([^\n]+\);/, '');
  try {
    await db.exec(sql);
  } catch (error) {
    throw new Error(`Migration ${file}: ${error.message}`);
  }
}
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const login = async (n) => {
  await scalar("SELECT set_config('request.jwt.claim.sub',$1,false)", [uid(n)]);
};
const create = async (title, total = 3, seconds = 600) =>
  scalar('SELECT public.crear_reto($1,$2,ARRAY[$3::uuid],2,$4,$5,$6)', [
    title,
    uid(10),
    uid(11),
    seconds,
    total,
    'Creador',
  ]);
const detail = async (id) => scalar('SELECT public.consultar_reto($1)', [id]);
const attempt = async (id) => scalar('SELECT public.consultar_intento_test($1)', [id]);
const finish = async (id) => scalar('SELECT public.finalizar_intento_test($1)', [id]);
const token = async (id) => scalar('SELECT token_invitacion FROM public.retos WHERE id=$1', [id]);
for (const n of [1, 2, 3, 4])
  await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())', [
    uid(n),
    `private-${n}@example.invalid`,
  ]);
await db.exec(
  `INSERT INTO public.convocatorias(id,nombre) VALUES('${uid(10)}','Convocatoria'); INSERT INTO public.temas(id,nombre) VALUES('${uid(11)}','Tema'); INSERT INTO public.convocatoria_tema(convocatoria_id,tema_id,numero,orden) VALUES('${uid(10)}','${uid(11)}',1,1);`,
);
await db.exec(`BEGIN;
  INSERT INTO public.preguntas(enunciado,estado) SELECT 'Pregunta adicional ' || n,'publicada' FROM generate_series(1,10) n;
  INSERT INTO public.pregunta_tema SELECT p.id,'${uid(11)}' FROM public.preguntas p WHERE enunciado LIKE 'Pregunta adicional%';
  INSERT INTO public.respuestas(pregunta_id,orden,texto,es_correcta) SELECT p.id,n,'Opción '||n,n=1 FROM public.preguntas p CROSS JOIN generate_series(1,4) n WHERE enunciado LIKE 'Pregunta adicional%';
COMMIT;`);
await db.exec(
  `BEGIN; INSERT INTO public.preguntas(id,enunciado,estado) VALUES('${uid(12)}','Pregunta uno','publicada'),('${uid(13)}','Pregunta dos','publicada'); INSERT INTO public.pregunta_tema SELECT id,'${uid(11)}' FROM public.preguntas WHERE id IN ('${uid(12)}','${uid(13)}'); INSERT INTO public.respuestas(pregunta_id,orden,texto,es_correcta) SELECT id,n,'Opción '||n,n=1 FROM public.preguntas CROSS JOIN generate_series(1,4) n WHERE id IN ('${uid(12)}','${uid(13)}'); COMMIT;`,
);
await login(1);
const id = await create('Reto principal');
const invite = await token(id);
assert.equal((await detail(id)).isCreator, true);
const first = await scalar('SELECT public.comenzar_reto($1)', [id]);
assert.equal(await scalar('SELECT public.comenzar_reto($1)', [id]), first);
const firstDetails = await attempt(first);
assert.equal(firstDetails.questions.length, 2);
assert.ok(firstDetails.questions.every((q) => q.options.every((a) => !('isCorrect' in a))));
await login(2);
await scalar('SELECT public.unirse_reto($1,$2)', [invite, 'Invitado uno']);
const second = await scalar('SELECT public.comenzar_reto($1)', [id]);
assert.deepEqual(
  (await attempt(second)).questions.map((q) => [q.id, q.options.map((a) => a.id)]),
  firstDetails.questions.map((q) => [q.id, q.options.map((a) => a.id)]),
);
const question = (await attempt(second)).questions[0];
await scalar('SELECT public.guardar_respuesta_test($1,$2,$3)', [
  second,
  question.id,
  question.options[0].id,
]);
await finish(second);
assert.equal((await attempt(second)).result, null);
assert.deepEqual((await attempt(second)).questions, []);
assert.equal((await detail(id)).ranking, undefined);
assert.ok(
  !JSON.stringify(await scalar('SELECT public.listar_historial_test()')).includes('isCorrect'),
);
await login(3);
await scalar('SELECT public.unirse_reto($1,$2)', [invite, 'Sin comenzar']);
await login(4);
await assert.rejects(
  () => scalar('SELECT public.unirse_reto($1,$2)', [invite, 'Sin plaza']),
  /plazas/,
);
await assert.rejects(() => attempt(first), /asociado/);
await assert.rejects(() => scalar('SELECT public.cerrar_reto($1)', [id]), /creador/);
await assert.rejects(
  () => db.exec("UPDATE public.preguntas SET enunciado='Cambio'"),
  /reto abierto/,
);
await assert.rejects(() => db.exec("UPDATE public.respuestas SET texto='Cambio'"), /reto abierto/);
await login(1);
const result = await scalar('SELECT public.cerrar_reto($1)', [id]);
assert.equal(result.status, 'cerrado');
assert.equal(result.ranking.length, 3);
assert.equal(result.ranking.filter((r) => r.notStarted).length, 1);
assert.equal((await detail(id)).ranking.find((r) => r.isMe).deliveryReason, 'cierre_reto');
assert.deepEqual((await scalar('SELECT public.cerrar_reto($1)', [id])).ranking, result.ranking);
assert.equal(
  await scalar('SELECT public.guardar_respuesta_test($1,$2,$3)', [
    first,
    question.id,
    question.options[0].id,
  ]),
  false,
);
const closedCorrection = await attempt(first);
await db.exec("UPDATE public.preguntas SET enunciado='Contenido corregido tras cierre'");
assert.deepEqual((await attempt(first)).questions, closedCorrection.questions);
await scalar("SELECT set_config('test.access','false',false)");
assert.equal((await detail(id)).status, 'cerrado');
assert.deepEqual((await attempt(first)).result, closedCorrection.result);
await assert.rejects(() => create('Sin suscripción'), /suscripción/);
await scalar("SELECT set_config('test.access','true',false)");
const autoId = await create('Cierre automático', 2);
const autoToken = await token(autoId);
const autoFirst = await scalar('SELECT public.comenzar_reto($1)', [autoId]);
await finish(autoFirst);
assert.equal((await detail(autoId)).status, 'abierto');
await login(2);
await scalar('SELECT public.unirse_reto($1,$2)', [autoToken, 'Invitado']);
const autoSecond = await scalar('SELECT public.comenzar_reto($1)', [autoId]);
await finish(autoSecond);
assert.equal((await detail(autoId)).status, 'cerrado');
await login(1);
const expiryId = await create('Vencimiento', 2);
const expiryAttempt = await scalar('SELECT public.comenzar_reto($1)', [expiryId]);
await db.query(
  "UPDATE public.test_intentos SET iniciado_en=clock_timestamp()-interval '700 seconds', expira_en=clock_timestamp()-interval '100 seconds' WHERE id=$1",
  [expiryAttempt],
);
await db.exec('SELECT private.resolver_retos_vencidos();');
assert.equal(
  await scalar('SELECT motivo_entrega FROM public.test_intentos WHERE id=$1', [expiryAttempt]),
  'tiempo_agotado',
);
assert.equal(
  await scalar('SELECT tiempo_empleado_segundos FROM public.test_intentos WHERE id=$1', [
    expiryAttempt,
  ]),
  600,
);
assert.equal((await detail(expiryId)).status, 'abierto');
await scalar("SELECT set_config('test.access','false',false)");
await scalar('SELECT public.cerrar_reto($1)', [expiryId]);
assert.equal((await attempt(expiryAttempt)).result.tiempoEmpleadoSegundos, 600);
await scalar("SELECT set_config('test.access','true',false)");
const ordinary = await scalar(
  'SELECT to_jsonb(public.crear_intento_test($1,10,600,ARRAY[$2::uuid]))',
  [uid(10), uid(11)],
);
assert.equal((await attempt(ordinary.id)).questions.length, 10);
assert.equal((await finish(ordinary.id)).result.totalQuestions, 10);
assert.equal(
  await scalar("SELECT has_table_privilege('authenticated','public.retos','SELECT')"),
  false,
);
assert.equal(
  await scalar("SELECT has_table_privilege('authenticated','public.test_intentos','SELECT')"),
  false,
);
assert.equal(
  await scalar(
    "SELECT has_function_privilege('authenticated','private.consultar_intento_test_base(uuid)','EXECUTE')",
  ),
  false,
);
console.log(
  'Challenge PostgreSQL smoke tests passed: shared exam, secrecy, attempt reuse, capacity, authorization, closure, historical correction, expiry and ordinary engine integration.',
);
await db.close();
