CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
BEGIN;
SELECT no_plan();
INSERT INTO auth.users(id,aud,role,email,encrypted_password,email_confirmed_at) VALUES
('00000000-0000-4000-8000-000000001601','authenticated','authenticated','path-owner@example.invalid','',now()),
('00000000-0000-4000-8000-000000001602','authenticated','authenticated','path-other@example.invalid','',now());
UPDATE public.perfiles SET rol='admin' WHERE id in ('00000000-0000-4000-8000-000000001601','00000000-0000-4000-8000-000000001602');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001601',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
INSERT INTO public.convocatorias(id,nombre) VALUES ('00000000-0000-4000-8000-000000001610','Camino de prueba'),('00000000-0000-4000-8000-000000001620','Segundo camino');
INSERT INTO public.convocatoria_bloques(id,convocatoria_id,nombre,orden) VALUES('00000000-0000-4000-8000-000000001612','00000000-0000-4000-8000-000000001610','Segundo bloque',2);
CREATE TEMP TABLE path_test_topics AS SELECT gen_random_uuid() id,n FROM generate_series(1,3) n;
INSERT INTO public.temas(id,nombre) SELECT id,'Tema '||n FROM path_test_topics;
INSERT INTO public.convocatoria_tema(convocatoria_id,tema_id,numero,orden,bloque_id)
SELECT '00000000-0000-4000-8000-000000001610',id,case when n=3 then 1 else n end,case when n=3 then 1 else n end,
case when n=3 then '00000000-0000-4000-8000-000000001612'::uuid else (SELECT id FROM public.convocatoria_bloques WHERE convocatoria_id='00000000-0000-4000-8000-000000001610' and orden=1) end FROM path_test_topics;
INSERT INTO public.convocatoria_tema(convocatoria_id,tema_id,numero,orden) SELECT '00000000-0000-4000-8000-000000001620',id,1,1 FROM path_test_topics WHERE n=1;
CREATE TEMP TABLE path_test_questions AS SELECT gen_random_uuid() id,t.id topic_id,question_number n FROM path_test_topics t CROSS JOIN generate_series(1,15) question_number;
INSERT INTO public.preguntas(id,enunciado,explicacion,estado) SELECT id,'Pregunta de camino '||n,'Explicación','publicada' FROM path_test_questions;
INSERT INTO public.pregunta_tema(pregunta_id,tema_id) SELECT id,topic_id FROM path_test_questions;
INSERT INTO public.respuestas(pregunta_id,orden,texto,es_correcta) SELECT q.id,option_number,'Opción '||option_number,option_number=1 FROM path_test_questions q CROSS JOIN generate_series(1,4) option_number;
SELECT public.camino_admin('generate',null,'00000000-0000-4000-8000-000000001610');
CREATE TEMP TABLE path_test AS SELECT id FROM public.caminos WHERE convocatoria_id='00000000-0000-4000-8000-000000001610';
SELECT is((SELECT count(*)::integer FROM public.camino_paradas WHERE camino_id=(SELECT id FROM path_test)),5,'three themes and two obligatory reviews generated');
SELECT is((SELECT estado FROM public.caminos WHERE id=(SELECT id FROM path_test)),'borrador','catalog generation never publishes automatically');
UPDATE public.camino_retos SET numero_preguntas=1000 WHERE id=(SELECT r.id FROM public.camino_retos r JOIN public.camino_paradas s ON s.id=r.parada_id WHERE s.camino_id=(SELECT id FROM path_test) ORDER BY s.orden,r.orden LIMIT 1);
SELECT throws_ok($$SELECT public.camino_admin('publish',(SELECT id FROM path_test))$$,'22023',NULL,'cannot publish without enough questions');
UPDATE public.camino_retos SET numero_preguntas=5 WHERE numero_preguntas=1000 AND parada_id IN (SELECT id FROM public.camino_paradas WHERE camino_id=(SELECT id FROM path_test));
SELECT public.camino_admin('publish',(SELECT id FROM path_test));
CREATE TEMP TABLE path_test_steps AS SELECT r.id,r.numero_preguntas,r.orden,s.orden stop_order,s.tipo,row_number() over(order by s.orden,r.orden) n FROM public.camino_retos r JOIN public.camino_paradas s ON s.id=r.parada_id WHERE s.camino_id=(SELECT id FROM path_test);
SELECT throws_ok($$SELECT public.camino_start((SELECT id FROM path_test_steps WHERE n=2))$$,'42501',NULL,'sequential unlocks are enforced on server');
CREATE TEMP TABLE path_test_attempt AS SELECT public.camino_start((SELECT id FROM path_test_steps WHERE n=1)) payload;
SELECT ok(NOT ((SELECT payload FROM path_test_attempt)->'questions'->0->'options'->0 ? 'isCorrect'),'pending answers have no solution');
SELECT is(public.camino_start((SELECT id FROM path_test_steps WHERE n=2))->>'id',(SELECT payload->>'id' FROM path_test_attempt),'one active attempt per user and path');
SELECT is(public.camino_finish(((SELECT payload FROM path_test_attempt)->>'id')::uuid,0)->>'pathPassed','false','all-blank initiation does not pass');
SELECT is((SELECT count(*)::integer FROM public.camino_xp_movimientos WHERE usuario_id=auth.uid()),0,'blank attempt has no XP');
SELECT is((SELECT count(*)::integer FROM public.camino_actividad_diaria WHERE usuario_id=auth.uid()),0,'blank attempt does not meet daily objective');

CREATE FUNCTION pg_temp.complete_path_step(challenge uuid,correct_count integer) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE a jsonb;q record;version integer:=0;choice uuid;
BEGIN
 a:=public.camino_start(challenge);
 FOR q IN SELECT value,ordinality n FROM jsonb_array_elements(a->'questions') WITH ORDINALITY LOOP
  SELECT id INTO choice FROM public.respuestas WHERE pregunta_id=(q.value->>'id')::uuid AND es_correcta=(q.n<=correct_count) ORDER BY orden LIMIT 1;
  a:=public.camino_save((a->>'id')::uuid,(q.value->>'id')::uuid,choice,version);version:=(a->>'pathVersion')::integer;
 END LOOP;
 RETURN public.camino_finish((a->>'id')::uuid,version);
END $$;
CREATE TEMP TABLE path_test_first_pass AS SELECT pg_temp.complete_path_step((SELECT id FROM path_test_steps WHERE n=1),0) payload;
SELECT is((SELECT payload->>'pathPassed' FROM path_test_first_pass),'true','initiation passes with a response even when incorrect');
SELECT is((SELECT payload->>'pathXpEarned' FROM path_test_first_pass),'10','first pass earns configured XP');
SELECT is(public.camino_finish(((SELECT payload FROM path_test_first_pass)->>'id')::uuid,0),(SELECT payload FROM path_test_first_pass),'repeated finalization is idempotent');
SELECT is((pg_temp.complete_path_step((SELECT id FROM path_test_steps WHERE n=1),0)->>'pathXpEarned')::integer,0,'repetition cannot duplicate XP');
SELECT is((SELECT count(*)::integer FROM public.camino_actividad_diaria WHERE usuario_id=auth.uid()),1,'daily activity counted once');
SELECT is((pg_temp.complete_path_step((SELECT id FROM path_test_steps WHERE n=2),5)->>'pathPassed'),'false','60 percent of ten requires six correct answers');
SELECT pg_temp.complete_path_step((SELECT id FROM path_test_steps WHERE n=2),6);
SELECT pg_temp.complete_path_step((SELECT id FROM path_test_steps WHERE n=3),7);
SELECT is((pg_temp.complete_path_step((SELECT id FROM path_test_steps WHERE n=4),12)->>'pathPassed'),'true','fifteen at eighty percent requires twelve correct answers');
SELECT is(public.camino_map((SELECT id FROM path_test))->'path'->>'completedTopics','1','four challenges complete a theme');
SELECT throws_ok($$SELECT public.camino_start((SELECT id FROM path_test_steps WHERE n=10))$$,'42501',NULL,'next block remains locked before review');
SELECT pg_temp.complete_path_step((SELECT id FROM path_test_steps WHERE n=5),99);
SELECT pg_temp.complete_path_step((SELECT id FROM path_test_steps WHERE n=6),99);
SELECT pg_temp.complete_path_step((SELECT id FROM path_test_steps WHERE n=7),99);
SELECT pg_temp.complete_path_step((SELECT id FROM path_test_steps WHERE n=8),99);
CREATE TEMP TABLE path_test_review AS SELECT public.camino_start((SELECT id FROM path_test_steps WHERE n=9)) payload;
SELECT is((SELECT count(DISTINCT pt.tema_id)::integer FROM public.test_intento_preguntas q JOIN public.pregunta_tema pt ON pt.pregunta_id=q.pregunta_id WHERE q.test_intento_id=((SELECT payload FROM path_test_review)->>'id')::uuid),2,'review represents every block theme');
SELECT is((SELECT count(*)::integer FROM public.test_intento_preguntas WHERE test_intento_id=((SELECT payload FROM path_test_review)->>'id')::uuid),15,'review count is not silently reduced');
SELECT public.camino_abandon(((SELECT payload FROM path_test_review)->>'id')::uuid);
SELECT pg_temp.complete_path_step((SELECT id FROM path_test_steps WHERE n=9),99);
SELECT pg_temp.complete_path_step((SELECT id FROM path_test_steps WHERE n=10),99);
SELECT pg_temp.complete_path_step((SELECT id FROM path_test_steps WHERE n=11),99);
SELECT pg_temp.complete_path_step((SELECT id FROM path_test_steps WHERE n=12),99);
SELECT pg_temp.complete_path_step((SELECT id FROM path_test_steps WHERE n=13),99);
SELECT ok((public.camino_map((SELECT id FROM path_test))->'path'->>'percentage')::numeric<100,'last review is included in progress denominator');
SELECT pg_temp.complete_path_step((SELECT id FROM path_test_steps WHERE n=14),99);
SELECT is((public.camino_map((SELECT id FROM path_test))->'path'->>'percentage')::numeric,100::numeric,'only all fourteen challenges complete the path');
SELECT pg_temp.complete_path_step((SELECT id FROM path_test_steps WHERE n=2),0);
SELECT ok(private.camino_unlocked((SELECT id FROM path_test_steps WHERE n=14),auth.uid()),'worse results never revoke unlocks');
SELECT throws_ok($$UPDATE public.camino_retos SET xp=xp+1 WHERE id=(SELECT id FROM path_test_steps WHERE n=1)$$,'23514',NULL,'published rules cannot change');

CREATE TEMP TABLE path_test_conflict AS SELECT public.camino_start((SELECT id FROM path_test_steps WHERE n=1)) payload;
SELECT public.camino_save(((SELECT payload FROM path_test_conflict)->>'id')::uuid,((SELECT payload FROM path_test_conflict)->'questions'->0->>'id')::uuid,((SELECT payload FROM path_test_conflict)->'questions'->0->'options'->0->>'id')::uuid,0);
SELECT is(public.camino_save(((SELECT payload FROM path_test_conflict)->>'id')::uuid,((SELECT payload FROM path_test_conflict)->'questions'->0->>'id')::uuid,((SELECT payload FROM path_test_conflict)->'questions'->0->'options'->0->>'id')::uuid,0)->>'pathVersion','1','identical save retry does not increment the attempt version twice');
SELECT is(public.camino_save(((SELECT payload FROM path_test_conflict)->>'id')::uuid,((SELECT payload FROM path_test_conflict)->'questions'->0->>'id')::uuid,((SELECT payload FROM path_test_conflict)->'questions'->0->'options'->1->>'id')::uuid,0)->>'conflict','true','stale tabs cannot silently overwrite a saved response');
SELECT throws_ok($$SELECT public.guardar_respuesta_test(((SELECT payload FROM path_test_conflict)->>'id')::uuid,((SELECT payload FROM path_test_conflict)->'questions'->0->>'id')::uuid,((SELECT payload FROM path_test_conflict)->'questions'->0->'options'->1->>'id')::uuid)$$,'42501',NULL,'generic save cannot bypass version control');
UPDATE public.preguntas SET explicacion='Contenido modificado' WHERE id=((SELECT payload FROM path_test_conflict)->'questions'->0->>'id')::uuid;
SELECT is(public.camino_attempt(((SELECT payload FROM path_test_conflict)->>'id')::uuid)->>'pathState','invalidado','content changes invalidate active attempt');
SELECT is(public.camino_attempt(((SELECT payload FROM path_test_first_pass)->>'id')::uuid)->>'pathPassed','true','closed historical result stays stable');
SELECT throws_ok($$DELETE FROM public.respuestas WHERE id=((SELECT payload FROM path_test_conflict)->'questions'->0->'options'->1->>'id')::uuid$$,'23514',NULL,'all referenced options are retained for review');
SELECT ok(NOT has_table_privilege('authenticated','public.camino_xp_movimientos','INSERT'),'users cannot forge XP');
SELECT ok(NOT has_function_privilege('authenticated','private.finalizar_intento_test_pre_camino(uuid)','EXECUTE'),'old finalization entry cannot bypass path rules');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001602',true);
SELECT throws_ok($$SELECT public.camino_attempt(((SELECT payload FROM path_test_first_pass)->>'id')::uuid)$$,'42501',NULL,'another user cannot read attempt content');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001601',true);
CREATE TEMP TABLE path_test_paused AS SELECT public.camino_start((SELECT id FROM path_test_steps WHERE n=1)) payload;
UPDATE public.perfiles SET rol='usuario' WHERE id=auth.uid();
SELECT lives_ok($$SELECT public.camino_map((SELECT id FROM path_test))$$,'map remains accessible without subscription');
SELECT lives_ok($$SELECT public.camino_attempt(((SELECT payload FROM path_test_first_pass)->>'id')::uuid)$$,'own closed results remain accessible without subscription');
SELECT throws_ok($$SELECT public.camino_finish(((SELECT payload FROM path_test_paused)->>'id')::uuid,0)$$,'42501',NULL,'expired access cannot finalize');
SELECT is((SELECT estado FROM public.test_intentos WHERE id=((SELECT payload FROM path_test_paused)->>'id')::uuid),'en_curso','access expiry does not consume the attempt');
UPDATE public.perfiles SET rol='admin' WHERE id=auth.uid();
SELECT public.camino_admin('archive',(SELECT id FROM path_test));
SELECT throws_ok($$SELECT public.camino_finish(((SELECT payload FROM path_test_paused)->>'id')::uuid,0)$$,'22023',NULL,'archived paths cannot finish ongoing attempts');
SELECT is(public.camino_abandon(((SELECT payload FROM path_test_paused)->>'id')::uuid)->>'pathState','abandonado','archived attempt can be explicitly abandoned');
﻿-- Separate calendars use Madrid dates, including the autumn DST transition.
INSERT INTO public.test_intentos(id,usuario_id,convocatoria_id,estado,numero_preguntas,iniciado_en,finalizado_en,aciertos,fallos,en_blanco,puntuacion_neta,nota,porcentaje_aciertos,penalizacion_aplicada,origen,camino_id,camino_reto_id,camino_evaluacion)
SELECT gen_random_uuid(),'00000000-0000-4000-8000-000000001602','00000000-0000-4000-8000-000000001610','finalizado',5,completed_at-interval '5 minutes',completed_at,1,0,4,1,2,20,0,'camino',(SELECT id FROM path_test),(SELECT id FROM path_test_steps WHERE n=1),'{"criterion":"finalizacion","minimum":1,"threshold":0,"xp":10}'::jsonb
FROM (VALUES('2026-10-24 22:30:00+00'::timestamptz),('2026-10-25 23:30:00+00'::timestamptz),('2026-10-26 23:30:00+00'::timestamptz)) dates(completed_at);
INSERT INTO public.camino_actividad_diaria(usuario_id,fecha_local,primer_intento_id)
SELECT usuario_id,(finalizado_en at time zone 'Europe/Madrid')::date,id FROM public.test_intentos WHERE usuario_id='00000000-0000-4000-8000-000000001602' AND camino_id=(SELECT id FROM path_test);
SELECT is(private.camino_streak('00000000-0000-4000-8000-000000001602','2026-10-27')->>'current','3','consecutive Madrid dates survive the DST change');
SELECT is(private.camino_streak('00000000-0000-4000-8000-000000001602','2026-10-28')->>'current','3','yesterday streak remains active before practicing today');
SELECT is(private.camino_streak('00000000-0000-4000-8000-000000001602','2026-10-29')->>'current','0','one complete missed day resets current streak');
SELECT is(private.camino_streak('00000000-0000-4000-8000-000000001602','2026-10-29')->>'best','3','best streak is retained');
SELECT is(('2026-03-28 23:30:00+00'::timestamptz at time zone 'Europe/Madrid')::date,'2026-03-29'::date,'spring boundary uses Madrid rather than UTC day');
SELECT public.camino_admin('generate',null,'00000000-0000-4000-8000-000000001620');
SELECT public.camino_admin('publish',(SELECT id FROM public.caminos WHERE convocatoria_id='00000000-0000-4000-8000-000000001620'));
SELECT is((SELECT public.camino_map(id)->'path'->>'xp' FROM public.caminos WHERE convocatoria_id='00000000-0000-4000-8000-000000001620'),'0','another convocation starts with independent XP');
SELECT pg_temp.complete_path_step((SELECT r.id FROM public.camino_retos r JOIN public.camino_paradas s ON s.id=r.parada_id JOIN public.caminos c ON c.id=s.camino_id WHERE c.convocatoria_id='00000000-0000-4000-8000-000000001620' ORDER BY s.orden,r.orden LIMIT 1),0);
SELECT is((SELECT count(*)::integer FROM public.camino_actividad_diaria WHERE usuario_id=auth.uid()),1,'two paths share the same daily objective');

﻿CREATE TEMP TABLE path_test_rewards_before_free AS SELECT count(*) n FROM public.camino_xp_movimientos WHERE usuario_id=auth.uid();
CREATE TEMP TABLE path_test_free_attempt AS SELECT (public.crear_intento_test('00000000-0000-4000-8000-000000001620',10,null,ARRAY[(SELECT id FROM path_test_topics WHERE n=1)])).id;
SELECT public.guardar_respuesta_test((SELECT id FROM path_test_free_attempt),(SELECT pregunta_id FROM public.test_intento_preguntas WHERE test_intento_id=(SELECT id FROM path_test_free_attempt) ORDER BY orden LIMIT 1),(SELECT r.id FROM public.respuestas r JOIN public.test_intento_preguntas q ON q.pregunta_id=r.pregunta_id WHERE q.test_intento_id=(SELECT id FROM path_test_free_attempt) AND r.es_correcta ORDER BY q.orden LIMIT 1));
SELECT lives_ok($SELECT public.finalizar_intento_test(id) FROM path_test_free_attempt$,'ordinary tests still finalize through the shared engine');
SELECT is((SELECT count(*) FROM public.camino_xp_movimientos WHERE usuario_id=auth.uid()),(SELECT n FROM path_test_rewards_before_free),'free tests do not grant path XP');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001602',true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::integer FROM public.camino_retos_progreso WHERE usuario_id='00000000-0000-4000-8000-000000001601'),0,'RLS hides another account progress');
SELECT is((SELECT count(*)::integer FROM public.camino_xp_movimientos WHERE usuario_id='00000000-0000-4000-8000-000000001601'),0,'RLS hides another account XP');
RESET ROLE;
SELECT ok(NOT has_function_privilege('anon','public.camino_map(uuid)','EXECUTE'),'anonymous users cannot inspect private maps');

SELECT * FROM finish();
ROLLBACK;
