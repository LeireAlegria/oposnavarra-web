CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
BEGIN;
SELECT no_plan();

INSERT INTO auth.users(id, aud, role, email, encrypted_password, email_confirmed_at)
VALUES ('00000000-0000-4000-8000-000000001201', 'authenticated', 'authenticated', 'bon-test@example.invalid', '', now());
UPDATE public.perfiles SET rol = 'admin' WHERE id = '00000000-0000-4000-8000-000000001201';
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001201', true);

INSERT INTO public.temas(id, nombre, descripcion) VALUES ('00000000-0000-4000-8000-000000001202', 'Tema reutilizable', 'Contenido previo');
CREATE TEMP TABLE bon_test_draft AS SELECT jsonb_build_object(
  'sourceId', '2025/101/21', 'sourceUrl', 'https://bon.navarra.es/es/anuncio/-/texto/2025/101/21/',
  'name', 'Importación de prueba', 'reviewed', true,
  'blocks', '[{"name":"Parte I","topics":[{"name":"Tema nuevo","number":1,"text":"Contenido nuevo","decision":"new"}]},{"name":"Parte II","topics":[{"name":"Tema vinculado","number":1,"text":"Alcance oficial","decision":"existing","topicId":"00000000-0000-4000-8000-000000001202"}]}]'::jsonb
) AS draft;
CREATE TEMP TABLE bon_test_result AS SELECT public.confirmar_importacion_bon_admin('00000000-0000-4000-8000-000000001203', draft) AS id FROM bon_test_draft;
SELECT is((SELECT count(*)::integer FROM public.convocatoria_bloques WHERE convocatoria_id = (SELECT id FROM bon_test_result)), 2, 'guarda dos bloques y permite reiniciar la numeración');
SELECT is((SELECT count(*)::integer FROM public.convocatoria_tema WHERE convocatoria_id = (SELECT id FROM bon_test_result)), 2, 'guarda todas las asociaciones');
SELECT is((SELECT descripcion FROM public.temas WHERE id = '00000000-0000-4000-8000-000000001202'), 'Contenido previo', 'vincular conserva el contenido reutilizable');
SELECT is((SELECT texto_oficial FROM public.convocatoria_tema WHERE convocatoria_id = (SELECT id FROM bon_test_result) AND tema_id = '00000000-0000-4000-8000-000000001202'), 'Alcance oficial', 'conserva el alcance oficial por separado');
SELECT is((SELECT public.confirmar_importacion_bon_admin('00000000-0000-4000-8000-000000001203', draft) FROM bon_test_draft), (SELECT id FROM bon_test_result), 'el reintento recupera la operación sin duplicar');
SELECT throws_ok($$SELECT public.confirmar_importacion_bon_admin('00000000-0000-4000-8000-000000001204', draft) FROM bon_test_draft$$, '23505', 'El anuncio ya está importado.', 'otro identificador de operación no permite duplicar el anuncio');

UPDATE bon_test_draft SET draft = jsonb_set(jsonb_set(jsonb_set(draft, '{sourceId}', '"2025/101/22"'), '{sourceUrl}', '"https://bon.navarra.es/es/anuncio/-/texto/2025/101/22/"'), '{blocks,1,topics,0,topicId}', '"00000000-0000-4000-8000-000000001299"');
SELECT throws_ok($$SELECT public.confirmar_importacion_bon_admin('00000000-0000-4000-8000-000000001205', draft) FROM bon_test_draft$$, 'P0001', 'El tema vinculado no existe.', 'un fallo tardío revierte toda la operación');
SELECT is((SELECT count(*)::integer FROM public.convocatorias WHERE origen_bon_id = '2025/101/22'), 0, 'el fallo no deja convocatoria parcial');
SELECT is((SELECT count(*)::integer FROM public.temas WHERE nombre = 'Tema nuevo'), 1, 'el fallo tampoco deja temas parciales');

INSERT INTO public.convocatorias(id, nombre) VALUES ('00000000-0000-4000-8000-000000001206', 'Manual');
SELECT is((SELECT nombre FROM public.convocatoria_bloques WHERE convocatoria_id = '00000000-0000-4000-8000-000000001206'), 'General', 'la creación manual obtiene General');
SELECT throws_ok($$INSERT INTO public.convocatoria_tema(convocatoria_id, tema_id, bloque_id, numero, orden)
SELECT '00000000-0000-4000-8000-000000001206', '00000000-0000-4000-8000-000000001202', id, 1, 1
FROM public.convocatoria_bloques WHERE convocatoria_id = (SELECT id FROM bon_test_result) LIMIT 1$$, '23503', NULL, 'la FK rechaza bloques de otra convocatoria incluso con escritura directa');
SELECT ok(NOT has_function_privilege('anon', 'public.confirmar_importacion_bon_admin(uuid,jsonb)', 'EXECUTE'), 'un anónimo no puede importar');
UPDATE public.perfiles SET rol = 'usuario' WHERE id = '00000000-0000-4000-8000-000000001201';
SELECT throws_ok($$SELECT public.confirmar_importacion_bon_admin('00000000-0000-4000-8000-000000001203', draft) FROM bon_test_draft$$, '42501', NULL, 'un usuario no administrador tampoco puede recuperar ni crear importaciones');
SELECT * FROM finish();
ROLLBACK;
