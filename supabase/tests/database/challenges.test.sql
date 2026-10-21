CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
BEGIN;
SELECT no_plan();
INSERT INTO auth.users(id,aud,role,email,encrypted_password,email_confirmed_at) VALUES
 ('00000000-0000-4000-8000-000000001401','authenticated','authenticated','challenge-creator@example.invalid','',now()),
 ('00000000-0000-4000-8000-000000001402','authenticated','authenticated','challenge-guest@example.invalid','',now()),
 ('00000000-0000-4000-8000-000000001403','authenticated','authenticated','challenge-extra@example.invalid','',now());
-- Administrator access uses the existing test mechanism; ownership restrictions still apply.
UPDATE public.perfiles SET rol='admin' WHERE id IN ('00000000-0000-4000-8000-000000001401','00000000-0000-4000-8000-000000001402','00000000-0000-4000-8000-000000001403');
INSERT INTO public.convocatorias(id,nombre) VALUES('00000000-0000-4000-8000-000000001410','Convocatoria retos');
INSERT INTO public.temas(id,nombre) VALUES('00000000-0000-4000-8000-000000001411','Tema retos');
INSERT INTO public.convocatoria_tema(convocatoria_id,tema_id,numero,orden) VALUES('00000000-0000-4000-8000-000000001410','00000000-0000-4000-8000-000000001411',1,1);
INSERT INTO public.preguntas(id,enunciado,estado) VALUES('00000000-0000-4000-8000-000000001412','Pregunta reto','publicada');
INSERT INTO public.pregunta_tema VALUES('00000000-0000-4000-8000-000000001412','00000000-0000-4000-8000-000000001411',now());
INSERT INTO public.respuestas(pregunta_id,orden,texto,es_correcta) SELECT '00000000-0000-4000-8000-000000001412',n,'Opción '||n,n=1 FROM generate_series(1,4) n;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001401',true);
CREATE TEMP TABLE challenge_fixture AS SELECT public.crear_reto('Reto SQL','00000000-0000-4000-8000-000000001410',ARRAY['00000000-0000-4000-8000-000000001411'::uuid],1,600,2,'Creador') AS id;
SELECT is((SELECT count(*)::integer FROM public.reto_participantes WHERE reto_id=(SELECT id FROM challenge_fixture)),1,'el creador ocupa una plaza');
CREATE TEMP TABLE challenge_attempt AS SELECT public.comenzar_reto(id) AS id FROM challenge_fixture;
SELECT is((SELECT public.comenzar_reto(id) FROM challenge_fixture),(SELECT id FROM challenge_attempt),'retomar devuelve el mismo intento');
SELECT ok(NOT ((SELECT public.consultar_intento_test(id) FROM challenge_attempt)->'questions'->0->'options'->0 ? 'isCorrect'),'las opciones del intento activo no contienen solución');
SELECT public.finalizar_intento_test(id) FROM challenge_attempt;
SELECT is((SELECT public.consultar_intento_test(id) FROM challenge_attempt)->'result','null'::jsonb,'entregar no revela la nota antes del cierre');
SELECT is((SELECT public.consultar_intento_test(id) FROM challenge_attempt)->'questions','[]'::jsonb,'entregar no revela corrección antes del cierre');
SELECT ok(NOT ((SELECT public.consultar_reto(id) FROM challenge_fixture) ? 'ranking'),'el creador tampoco ve clasificación anticipada');
SELECT is((SELECT public.consultar_reto(id)->>'status' FROM challenge_fixture),'abierto','con plazas libres no hay cierre automático');
SELECT ok(NOT ((public.listar_historial_test()->'items'->0->'result') IS DISTINCT FROM 'null'::jsonb),'el historial conserva la frontera de publicación');
SELECT throws_ok($$UPDATE public.respuestas SET texto='Cambio' WHERE pregunta_id='00000000-0000-4000-8000-000000001412'$$,'23514','Esta pregunta pertenece a un reto abierto. Crea otra pregunta para modificar su contenido o sus respuestas.','no se puede editar la solución del examen compartido');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001402',true);
SELECT public.unirse_reto((SELECT token_invitacion FROM public.retos WHERE id=(SELECT id FROM challenge_fixture)),'Invitado');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001403',true);
SELECT throws_ok($$SELECT public.unirse_reto((SELECT token_invitacion FROM public.retos WHERE id=(SELECT id FROM challenge_fixture)),'Sin plaza')$$,'22023','El reto ya no tiene plazas disponibles.','no se supera el aforo');
SELECT throws_ok($$SELECT public.cerrar_reto(id) FROM challenge_fixture$$,'42501','Solo el creador puede cerrar este reto.','solo el creador puede cerrar');
SELECT throws_ok($$SELECT public.consultar_intento_test(id) FROM challenge_attempt$$,'42501','No existe un intento de test asociado a este usuario.','no se accede a respuestas ajenas');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001401',true);
CREATE TEMP TABLE closed_challenge AS SELECT public.cerrar_reto(id) AS result FROM challenge_fixture;
SELECT is((SELECT jsonb_array_length(result->'ranking') FROM closed_challenge),2,'la clasificación incluye a todos los inscritos');
SELECT is((SELECT count(*)::integer FROM jsonb_array_elements((SELECT result->'ranking' FROM closed_challenge)) entry WHERE entry->>'notStarted'='true'),1,'el participante sin comenzar figura como no realizado');
SELECT is((SELECT public.cerrar_reto(id) FROM challenge_fixture),(SELECT result FROM closed_challenge),'repetir el cierre es idempotente');
SELECT ok((SELECT public.consultar_intento_test(id) FROM challenge_attempt)->'questions'->0->'options'->0 ? 'isCorrect','la corrección propia se publica al cerrar');
SELECT ok(NOT has_table_privilege('authenticated','public.retos','INSERT'),'no se pueden crear plazas o reabrir retos con escrituras directas');
SELECT ok(NOT has_function_privilege('authenticated','private.consultar_intento_test_base(uuid)','EXECUTE'),'el acceso base no permite saltar la publicación');
SELECT ok(NOT has_function_privilege('anon','public.crear_reto(text,uuid,uuid[],integer,integer,integer,text)','EXECUTE'),'un anónimo no puede crear retos');
SELECT * FROM finish();
ROLLBACK;
