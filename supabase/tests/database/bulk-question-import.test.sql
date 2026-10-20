CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
BEGIN;
SELECT no_plan();
INSERT INTO auth.users(id, aud, role, email, encrypted_password, email_confirmed_at)
VALUES ('00000000-0000-4000-8000-000000001301', 'authenticated', 'authenticated', 'question-import@example.invalid', '', now());
UPDATE public.perfiles SET rol = 'admin' WHERE id = '00000000-0000-4000-8000-000000001301';
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001301', true);
INSERT INTO public.examenes(id, nombre) VALUES ('00000000-0000-4000-8000-000000001302', 'Examen importación');
INSERT INTO public.temas(id, nombre, descripcion) VALUES ('00000000-0000-4000-8000-000000001303', 'Tema importación', 'Contenido');
CREATE TEMP TABLE import_payload AS SELECT jsonb_build_object('origin', 'generada_documentacion', 'reference', 'Manual versión 1', 'examId', NULL, 'reviewed', true, 'totalRows', 3, 'fileHash', 'test', 'rows', jsonb_build_array(
  jsonb_build_object('rowNumber', 2, 'number', NULL, 'text', 'Pregunta importación uno', 'options', '["Primera","Segunda","Tercera","Cuarta"]'::jsonb, 'correctAnswer', 'B', 'explanation', 'Explicación completa', 'topicId', '00000000-0000-4000-8000-000000001303', 'topicSnapshot', jsonb_build_object('id', '00000000-0000-4000-8000-000000001303', 'nombre', 'Tema importación', 'descripcion', 'Contenido'), 'topicResolved', true, 'duplicateAccepted', false, 'duplicateIds', '[]'::jsonb, 'duplicateVersions', '[]'::jsonb),
  jsonb_build_object('rowNumber', 3, 'number', 8, 'text', 'Pregunta importación dos', 'options', '["Uno","Dos","Tres","Cuatro"]'::jsonb, 'correctAnswer', 'D', 'explanation', '', 'topicId', NULL, 'topicResolved', true, 'duplicateAccepted', false, 'duplicateIds', '[]'::jsonb, 'duplicateVersions', '[]'::jsonb)
)) AS data;

CREATE TEMP TABLE import_result AS SELECT public.confirmar_importacion_preguntas_admin('00000000-0000-4000-8000-000000001304', data) AS result FROM import_payload;
SELECT is((SELECT result->>'created' FROM import_result), '2', 'crea exactamente las filas incluidas');
SELECT is((SELECT result->>'excluded' FROM import_result), '1', 'cuenta las filas excluidas');
SELECT is((SELECT estado FROM public.preguntas WHERE enunciado = 'Pregunta importación uno'), 'revision', 'no publica las preguntas');
SELECT is((SELECT origen FROM public.preguntas WHERE enunciado = 'Pregunta importación uno'), 'propia', 'reutiliza la procedencia del banco');
SELECT is((SELECT referencia_fuente FROM public.preguntas WHERE enunciado = 'Pregunta importación uno'), 'Manual versión 1', 'conserva la referencia documental');
SELECT is((SELECT explicacion FROM public.preguntas WHERE enunciado = 'Pregunta importación uno'), 'Explicación completa', 'conserva la explicación');
SELECT is((SELECT count(*)::integer FROM public.respuestas a JOIN public.preguntas p ON p.id = a.pregunta_id WHERE p.enunciado = 'Pregunta importación uno'), 4, 'crea las cuatro opciones');
SELECT is((SELECT count(*)::integer FROM public.respuestas a JOIN public.preguntas p ON p.id = a.pregunta_id WHERE p.enunciado = 'Pregunta importación uno' AND a.es_correcta), 1, 'crea exactamente una respuesta correcta');
SELECT is((SELECT count(*)::integer FROM public.pregunta_tema pt JOIN public.preguntas p ON p.id = pt.pregunta_id WHERE p.enunciado = 'Pregunta importación uno'), 1, 'vincula el tema existente');
SELECT is((SELECT public.confirmar_importacion_preguntas_admin('00000000-0000-4000-8000-000000001304', data) FROM import_payload), (SELECT result FROM import_result), 'el reintento devuelve el mismo resultado');
SELECT is((SELECT count(*)::integer FROM public.preguntas WHERE enunciado IN ('Pregunta importación uno', 'Pregunta importación dos')), 2, 'el reintento no duplica preguntas');
SELECT throws_ok($$SELECT public.confirmar_importacion_preguntas_admin('00000000-0000-4000-8000-000000001304', jsonb_set(data, '{reference}', '"Otra versión"')) FROM import_payload$$, '22023', 'La clave de confirmación ya se usó con otro contenido. Vuelve a revisar el archivo.', 'la clave no se puede reutilizar con otro contenido');

CREATE TEMP TABLE review_result AS SELECT public.revisar_importacion_preguntas_admin(NULL, '[{"rowNumber":2,"text":" PREGUNTA   IMPORTACIÓN UNO ","options":["Primera","Segunda","Tercera","Cuarta"]}]') AS result;
SELECT is((SELECT jsonb_array_length(result->'duplicates'->0->'candidates') FROM review_result), 1, 'detecta coincidencias normalizando espacios y mayúsculas');
SELECT is((SELECT result->'duplicates'->0->'candidates'->0->>'exact' FROM review_result), 'true', 'compara también las opciones sin modificar textos');

-- A late write failure must roll back questions, answers, topic relations and the operation result.
CREATE FUNCTION pg_temp.fail_import_answer() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.texto = 'FAIL_IMPORT_TEST' THEN RAISE EXCEPTION 'fallo controlado'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER fail_import_answer BEFORE INSERT ON public.respuestas FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_import_answer();
UPDATE import_payload SET data = jsonb_set(jsonb_set(jsonb_set(data, '{rows,0,text}', '"Lote atómico uno"'), '{rows,1,text}', '"Lote atómico dos"'), '{rows,1,options,2}', '"FAIL_IMPORT_TEST"');
SELECT throws_ok($$SELECT public.confirmar_importacion_preguntas_admin('00000000-0000-4000-8000-000000001305', data) FROM import_payload$$, 'P0001', 'fallo controlado', 'un fallo al escribir opciones revierte el lote completo');
SELECT is((SELECT count(*)::integer FROM public.preguntas WHERE enunciado LIKE 'Lote atómico%'), 0, 'no hay preguntas parciales');
SELECT is((SELECT count(*)::integer FROM public.importaciones_preguntas_operaciones WHERE clave = '00000000-0000-4000-8000-000000001305'), 0, 'no registra una operación fallida como completada');
DROP TRIGGER fail_import_answer ON public.respuestas;

UPDATE import_payload SET data = jsonb_set(jsonb_set(jsonb_set(data, '{origin}', '"examen_oficial"'), '{examId}', '"00000000-0000-4000-8000-000000001302"'), '{rows,0,number}', '1');
SELECT lives_ok($$SELECT public.confirmar_importacion_preguntas_admin('00000000-0000-4000-8000-000000001306', data) FROM import_payload$$, 'importa preguntas oficiales conservando números 1 y 8');
SELECT is((SELECT origen FROM public.preguntas WHERE examen_id = '00000000-0000-4000-8000-000000001302' AND numero = 8), 'oficial', 'guarda la procedencia oficial');
UPDATE import_payload SET data = jsonb_set(data, '{rows,0,text}', '"Otro intento con número ocupado"');
SELECT throws_ok($$SELECT public.confirmar_importacion_preguntas_admin('00000000-0000-4000-8000-000000001307', data) FROM import_payload$$, '22023', 'Fila 2: numero ya ocupado o repetido en el examen. Vuelve a revisar la importación.', 'rechaza números ocupados aunque se acepten duplicados');

UPDATE import_payload SET data = jsonb_set(jsonb_set(data, '{examId}', 'null'), '{origin}', '"generada_documentacion"');
UPDATE public.temas SET descripcion = 'Contenido cambiado' WHERE id = '00000000-0000-4000-8000-000000001303';
SELECT throws_ok($$SELECT public.confirmar_importacion_preguntas_admin('00000000-0000-4000-8000-000000001308', data) FROM import_payload$$, '22023', 'Fila 2: el contenido del tema ha cambiado. Vuelve a revisarlo.', 'exige una nueva revisión si cambia el tema seleccionado');
SELECT ok(NOT has_function_privilege('anon', 'public.confirmar_importacion_preguntas_admin(uuid,jsonb)', 'EXECUTE'), 'un anónimo no puede importar');
SELECT ok(NOT has_table_privilege('authenticated', 'public.importaciones_preguntas_operaciones', 'SELECT'), 'el registro técnico no se expone al cliente');
UPDATE public.perfiles SET rol = 'usuario' WHERE id = '00000000-0000-4000-8000-000000001301';
SELECT throws_ok($$SELECT public.confirmar_importacion_preguntas_admin('00000000-0000-4000-8000-000000001304', data) FROM import_payload$$, '42501', 'No tienes permisos de administrador.', 'un usuario sin permisos no puede importar ni recuperar resultados');
SELECT * FROM finish();
ROLLBACK;
