CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;

SELECT no_plan();

SELECT has_table('public', 'convocatorias');
SELECT has_table('public', 'temas');
SELECT has_table('public', 'convocatoria_tema');
SELECT has_table('public', 'examenes');
SELECT has_table('public', 'convocatoria_examen');
SELECT has_table('public', 'preguntas');
SELECT has_table('public', 'respuestas');
SELECT has_table('public', 'pregunta_tema');
SELECT hasnt_table('public', 'convocatoria_pregunta');
SELECT is(
  (SELECT count(*)::integer FROM pg_catalog.pg_tables WHERE schemaname = 'public'),
  8,
  'el esquema público contiene exactamente ocho tablas de dominio'
);

INSERT INTO public.convocatorias (id, nombre)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Convocatoria A'),
  ('00000000-0000-0000-0000-000000000002', 'Convocatoria B');

INSERT INTO public.temas (id, nombre)
VALUES
  ('00000000-0000-0000-0000-000000000011', 'Tema compartido'),
  ('00000000-0000-0000-0000-000000000012', 'Tema secundario');

INSERT INTO public.examenes (id, nombre)
VALUES
  ('00000000-0000-0000-0000-000000000021', 'Examen compartido'),
  ('00000000-0000-0000-0000-000000000022', 'Examen eliminable');

INSERT INTO public.convocatoria_tema (convocatoria_id, tema_id, numero, orden)
VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 1, 2),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000011', 3, 1),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 2, 1);

INSERT INTO public.convocatoria_examen (convocatoria_id, examen_id)
VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000021');

SELECT throws_ok(
  $$INSERT INTO public.convocatoria_tema (convocatoria_id, tema_id, numero, orden)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 4, 4)$$,
  '23505',
  'no se duplica la relación convocatoria-tema'
);
SELECT throws_ok(
  $$INSERT INTO public.convocatoria_tema (convocatoria_id, tema_id, numero, orden)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000099', 4, 4)$$,
  '23503',
  'la relación de tema exige un tema existente'
);
SELECT throws_ok(
  $$INSERT INTO public.convocatoria_tema (convocatoria_id, tema_id, numero, orden)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 1, 4)$$,
  '23505',
  'el número del tema es único dentro de una convocatoria'
);
SELECT throws_ok(
  $$INSERT INTO public.convocatoria_tema (convocatoria_id, tema_id, numero, orden)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 4, 1)$$,
  '23505',
  'el orden del tema es único dentro de una convocatoria'
);
SELECT throws_ok(
  $$INSERT INTO public.convocatoria_tema (convocatoria_id, tema_id, numero, orden)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 0, 4)$$,
  '23514',
  'el número del tema debe ser positivo'
);
SELECT throws_ok(
  $$INSERT INTO public.convocatoria_tema (convocatoria_id, tema_id, numero, orden)
    VALUES ('00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000012', 4, 4)$$,
  '23503',
  'la relación de tema exige una convocatoria existente'
);
SELECT throws_ok(
  $$INSERT INTO public.convocatoria_examen (convocatoria_id, examen_id)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021')$$,
  '23505',
  'no se duplica la relación convocatoria-examen'
);
SELECT throws_ok(
  $$INSERT INTO public.convocatoria_examen (convocatoria_id, examen_id)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000099')$$,
  '23503',
  'la relación de examen exige un examen existente'
);

INSERT INTO public.preguntas (id, examen_id, numero, enunciado, origen)
VALUES
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000021', 1, 'Pregunta compartida', 'oficial'),
  ('00000000-0000-0000-0000-000000000032', NULL, NULL, 'Pregunta en revisión', DEFAULT),
  ('00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000022', 1, 'Pregunta conservada', DEFAULT);

SELECT is(
  (SELECT estado FROM public.preguntas WHERE id = '00000000-0000-0000-0000-000000000032'),
  'revision',
  'el estado editorial por defecto es revisión'
);
SELECT is(
  (SELECT situacion FROM public.preguntas WHERE id = '00000000-0000-0000-0000-000000000032'),
  'ordinaria',
  'la situación por defecto es ordinaria'
);
SELECT is(
  (SELECT origen FROM public.preguntas WHERE id = '00000000-0000-0000-0000-000000000032'),
  'propia',
  'el origen por defecto es propio'
);
SELECT throws_ok(
  $$INSERT INTO public.preguntas (enunciado, estado) VALUES ('Estado inválido', 'borrador')$$,
  '23514',
  'el estado de una pregunta está restringido'
);
SELECT throws_ok(
  $$INSERT INTO public.preguntas (enunciado, origen) VALUES ('Origen inválido', 'importada')$$,
  '23514',
  'el origen de una pregunta está restringido'
);
SELECT throws_ok(
  $$INSERT INTO public.preguntas (enunciado, situacion) VALUES ('Situación inválida', 'extraordinaria')$$,
  '23514',
  'la situación de una pregunta está restringida'
);
SELECT throws_ok(
  $$INSERT INTO public.preguntas (examen_id, numero, enunciado)
    VALUES ('00000000-0000-0000-0000-000000000021', 1, 'Número duplicado')$$,
  '23505',
  'el número es único dentro del examen'
);
SELECT throws_ok(
  $$INSERT INTO public.preguntas (numero, enunciado) VALUES (0, 'Número inválido')$$,
  '23514',
  'el número de pregunta debe ser positivo'
);
SELECT throws_ok(
  $$INSERT INTO public.preguntas (examen_id, enunciado)
    VALUES ('00000000-0000-0000-0000-000000000099', 'Examen inexistente')$$,
  '23503',
  'una pregunta solo puede referenciar un examen existente'
);

INSERT INTO public.pregunta_tema (pregunta_id, tema_id)
VALUES
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000012');

SELECT throws_ok(
  $$INSERT INTO public.pregunta_tema (pregunta_id, tema_id)
    VALUES ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000011')$$,
  '23505',
  'no se duplica la relación pregunta-tema'
);
SELECT throws_ok(
  $$INSERT INTO public.pregunta_tema (pregunta_id, tema_id)
    VALUES ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000099')$$,
  '23503',
  'la relación pregunta-tema exige un tema existente'
);

INSERT INTO public.respuestas (pregunta_id, orden, texto, es_correcta)
VALUES
  ('00000000-0000-0000-0000-000000000031', 1, 'Respuesta A', true),
  ('00000000-0000-0000-0000-000000000031', 2, 'Respuesta B', false),
  ('00000000-0000-0000-0000-000000000031', 3, 'Respuesta C', false),
  ('00000000-0000-0000-0000-000000000031', 4, 'Respuesta D', false);

INSERT INTO public.respuestas (pregunta_id, orden, texto)
VALUES ('00000000-0000-0000-0000-000000000032', 1, 'Respuesta en revisión');
SELECT is(
  (SELECT es_correcta FROM public.respuestas WHERE pregunta_id = '00000000-0000-0000-0000-000000000032'),
  false,
  'una respuesta no es correcta por defecto'
);

SET CONSTRAINTS ALL IMMEDIATE;

UPDATE public.preguntas
SET estado = 'publicada'
WHERE id = '00000000-0000-0000-0000-000000000031';

SELECT is(
  (SELECT estado FROM public.preguntas WHERE id = '00000000-0000-0000-0000-000000000031'),
  'publicada',
  'una pregunta con cuatro respuestas y una correcta puede publicarse'
);
SELECT throws_ok(
  $$UPDATE public.preguntas SET estado = 'publicada'
    WHERE id = '00000000-0000-0000-0000-000000000032'$$,
  '23514',
  'una pregunta incompleta no puede publicarse'
);
SELECT throws_ok(
  $$UPDATE public.respuestas SET es_correcta = false
    WHERE pregunta_id = '00000000-0000-0000-0000-000000000031' AND orden = 1$$,
  '23514',
  'una pregunta publicada conserva exactamente una respuesta correcta'
);
SELECT throws_ok(
  $$DELETE FROM public.respuestas
    WHERE pregunta_id = '00000000-0000-0000-0000-000000000031' AND orden = 4$$,
  '23514',
  'una pregunta publicada conserva cuatro respuestas'
);
SELECT throws_ok(
  $$INSERT INTO public.respuestas (pregunta_id, orden, texto)
    VALUES ('00000000-0000-0000-0000-000000000031', 5, 'Respuesta fuera de rango')$$,
  '23514',
  'el orden de respuesta está entre uno y cuatro'
);
SELECT throws_ok(
  $$INSERT INTO public.respuestas (pregunta_id, orden, texto)
    VALUES ('00000000-0000-0000-0000-000000000031', 1, 'Orden duplicado')$$,
  '23505',
  'no se repite el orden de respuesta en una pregunta'
);
SELECT throws_ok(
  $$INSERT INTO public.respuestas (pregunta_id, orden, texto)
    VALUES ('00000000-0000-0000-0000-000000000099', 1, 'Pregunta inexistente')$$,
  '23503',
  'una respuesta exige una pregunta existente'
);

UPDATE public.preguntas
SET situacion = 'anulada'
WHERE id = '00000000-0000-0000-0000-000000000031';
SELECT is(
  (SELECT estado || ':' || situacion FROM public.preguntas WHERE id = '00000000-0000-0000-0000-000000000031'),
  'publicada:anulada',
  'estado editorial y situación son independientes'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM (
      SELECT preguntas.id
      FROM public.preguntas
      JOIN public.pregunta_tema ON pregunta_tema.pregunta_id = preguntas.id
      JOIN public.convocatoria_tema ON convocatoria_tema.tema_id = pregunta_tema.tema_id
      WHERE convocatoria_tema.convocatoria_id = '00000000-0000-0000-0000-000000000001'
        AND preguntas.estado = 'publicada'
      UNION
      SELECT preguntas.id
      FROM public.preguntas
      JOIN public.convocatoria_examen ON convocatoria_examen.examen_id = preguntas.examen_id
      WHERE convocatoria_examen.convocatoria_id = '00000000-0000-0000-0000-000000000001'
        AND preguntas.estado = 'publicada'
    ) AS disponibles
  ),
  1,
  'una pregunta asociada por tema y examen se cuenta una sola vez'
);

DELETE FROM public.examenes WHERE id = '00000000-0000-0000-0000-000000000022';
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.preguntas
    WHERE id = '00000000-0000-0000-0000-000000000033' AND examen_id IS NULL
  ),
  'eliminar un examen conserva sus preguntas y desvincula la referencia'
);
SELECT ok(
  (SELECT created_at IS NOT NULL AND updated_at IS NOT NULL
   FROM public.convocatorias
   WHERE id = '00000000-0000-0000-0000-000000000001'),
  'las fechas de auditoría se generan al crear una convocatoria'
);

UPDATE public.convocatorias
SET descripcion = 'Actualizada', updated_at = '2000-01-01 00:00:00+00'
WHERE id = '00000000-0000-0000-0000-000000000001';
SELECT cmp_ok(
  (SELECT updated_at FROM public.convocatorias WHERE id = '00000000-0000-0000-0000-000000000001'),
  '>',
  '2000-01-01 00:00:00+00'::timestamptz,
  'updated_at se actualiza automáticamente en convocatorias'
);
UPDATE public.temas
SET descripcion = 'Actualizada', updated_at = '2000-01-01 00:00:00+00'
WHERE id = '00000000-0000-0000-0000-000000000011';
SELECT cmp_ok(
  (SELECT updated_at FROM public.temas WHERE id = '00000000-0000-0000-0000-000000000011'),
  '>',
  '2000-01-01 00:00:00+00'::timestamptz,
  'updated_at se actualiza automáticamente en temas'
);
UPDATE public.examenes
SET descripcion = 'Actualizada', updated_at = '2000-01-01 00:00:00+00'
WHERE id = '00000000-0000-0000-0000-000000000021';
SELECT cmp_ok(
  (SELECT updated_at FROM public.examenes WHERE id = '00000000-0000-0000-0000-000000000021'),
  '>',
  '2000-01-01 00:00:00+00'::timestamptz,
  'updated_at se actualiza automáticamente en exámenes'
);
UPDATE public.preguntas
SET explicacion = 'Actualizada', updated_at = '2000-01-01 00:00:00+00'
WHERE id = '00000000-0000-0000-0000-000000000031';
SELECT cmp_ok(
  (SELECT updated_at FROM public.preguntas WHERE id = '00000000-0000-0000-0000-000000000031'),
  '>',
  '2000-01-01 00:00:00+00'::timestamptz,
  'updated_at se actualiza automáticamente en preguntas'
);
UPDATE public.respuestas
SET texto = 'Respuesta A actualizada', updated_at = '2000-01-01 00:00:00+00'
WHERE pregunta_id = '00000000-0000-0000-0000-000000000031' AND orden = 1;
SELECT cmp_ok(
  (SELECT updated_at FROM public.respuestas WHERE pregunta_id = '00000000-0000-0000-0000-000000000031' AND orden = 1),
  '>',
  '2000-01-01 00:00:00+00'::timestamptz,
  'updated_at se actualiza automáticamente en respuestas'
);

WITH inserted AS (
  INSERT INTO public.convocatorias (nombre)
  VALUES ('Convocatoria con UUID generado')
  RETURNING id
)
SELECT ok((SELECT id IS NOT NULL FROM inserted), 'PostgreSQL genera UUID automáticamente');

SELECT is(
  (SELECT activo FROM public.convocatorias WHERE id = '00000000-0000-0000-0000-000000000001'),
  true,
  'una convocatoria está activa por defecto'
);
SELECT is(
  (SELECT es_oficial FROM public.examenes WHERE id = '00000000-0000-0000-0000-000000000021'),
  true,
  'un examen está marcado como oficial por defecto'
);

SELECT * FROM finish();

ROLLBACK;