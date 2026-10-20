CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;

SELECT no_plan();

INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
VALUES (
  '00000000-0000-4000-8000-000000000101',
  'authenticated',
  'authenticated',
  'test-platform-finalization@example.invalid',
  '',
  now()
);

INSERT INTO public.convocatorias (id, nombre, penalizacion_por_fallo)
VALUES ('00000000-0000-4000-8000-000000000111', 'Convocatoria test', 0.33);

INSERT INTO public.temas (id, nombre)
VALUES ('00000000-0000-4000-8000-000000000121', 'Tema test');

INSERT INTO public.convocatoria_tema (convocatoria_id, tema_id, numero, orden)
VALUES (
  '00000000-0000-4000-8000-000000000111',
  '00000000-0000-4000-8000-000000000121',
  1,
  1
);

INSERT INTO public.preguntas (id, enunciado, estado)
VALUES
  ('00000000-0000-4000-8000-000000000131', 'Pregunta respondida', 'revision'),
  ('00000000-0000-4000-8000-000000000132', 'Pregunta en blanco', 'revision');

INSERT INTO public.pregunta_tema (pregunta_id, tema_id)
VALUES
  ('00000000-0000-4000-8000-000000000131', '00000000-0000-4000-8000-000000000121'),
  ('00000000-0000-4000-8000-000000000132', '00000000-0000-4000-8000-000000000121');

INSERT INTO public.respuestas (id, pregunta_id, orden, texto, es_correcta)
VALUES
  ('00000000-0000-4000-8000-000000000141', '00000000-0000-4000-8000-000000000131', 1, 'Correcta', true),
  ('00000000-0000-4000-8000-000000000142', '00000000-0000-4000-8000-000000000131', 2, 'Incorrecta', false),
  ('00000000-0000-4000-8000-000000000143', '00000000-0000-4000-8000-000000000131', 3, 'Incorrecta', false),
  ('00000000-0000-4000-8000-000000000144', '00000000-0000-4000-8000-000000000131', 4, 'Incorrecta', false),
  ('00000000-0000-4000-8000-000000000145', '00000000-0000-4000-8000-000000000132', 1, 'Correcta', true),
  ('00000000-0000-4000-8000-000000000146', '00000000-0000-4000-8000-000000000132', 2, 'Incorrecta', false),
  ('00000000-0000-4000-8000-000000000147', '00000000-0000-4000-8000-000000000132', 3, 'Incorrecta', false),
  ('00000000-0000-4000-8000-000000000148', '00000000-0000-4000-8000-000000000132', 4, 'Incorrecta', false);

UPDATE public.preguntas
SET estado = 'publicada'
WHERE id IN (
  '00000000-0000-4000-8000-000000000131',
  '00000000-0000-4000-8000-000000000132'
);

INSERT INTO public.test_intentos (
  id,
  usuario_id,
  convocatoria_id,
  estado,
  numero_preguntas,
  iniciado_en
)
VALUES (
  '00000000-0000-4000-8000-000000000151',
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000111',
  'en_curso',
  2,
  now() - interval '3 minutes'
);

INSERT INTO public.test_intento_temas (test_intento_id, tema_id)
VALUES (
  '00000000-0000-4000-8000-000000000151',
  '00000000-0000-4000-8000-000000000121'
);

INSERT INTO public.test_intento_preguntas (
  test_intento_id,
  pregunta_id,
  orden,
  respuesta_seleccionada_id
)
VALUES
  (
    '00000000-0000-4000-8000-000000000151',
    '00000000-0000-4000-8000-000000000131',
    1,
    '00000000-0000-4000-8000-000000000141'
  ),
  (
    '00000000-0000-4000-8000-000000000151',
    '00000000-0000-4000-8000-000000000132',
    2,
    NULL
  );

SELECT lives_ok(
  $$SELECT private.finalizar_test(
    '00000000-0000-4000-8000-000000000151',
    '00000000-0000-4000-8000-000000000101'
  )$$,
  'el test finaliza y persiste el resultado en una transición válida'
);
SELECT is(
  (SELECT estado FROM public.test_intentos WHERE id = '00000000-0000-4000-8000-000000000151'),
  'finalizado',
  'el intento queda finalizado'
);
SELECT is(
  (SELECT aciertos FROM public.test_intentos WHERE id = '00000000-0000-4000-8000-000000000151'),
  1,
  'se persiste el número de aciertos'
);
SELECT is(
  (SELECT en_blanco FROM public.test_intentos WHERE id = '00000000-0000-4000-8000-000000000151'),
  1,
  'las preguntas no respondidas se clasifican en blanco'
);
SELECT is(
  (SELECT nota FROM public.test_intentos WHERE id = '00000000-0000-4000-8000-000000000151'),
  5::numeric,
  'la nota se calcula sobre el total de preguntas'
);

UPDATE public.convocatorias
SET penalizacion_por_fallo = 0
WHERE id = '00000000-0000-4000-8000-000000000111';

SELECT is(
  (private.resultado_test('00000000-0000-4000-8000-000000000151')->>'penalizacionAplicada')::numeric,
  0.33::numeric,
  'la penalización guardada no cambia si se modifica la configuración'
);

SELECT * FROM finish();

ROLLBACK;
