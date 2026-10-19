CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;

SELECT no_plan();

INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
VALUES (
  '00000000-0000-4000-8000-000000000501',
  'authenticated',
  'authenticated',
  'admin-official-test@example.invalid',
  '',
  now()
);

UPDATE public.perfiles
SET rol = 'admin'
WHERE id = '00000000-0000-4000-8000-000000000501';

INSERT INTO public.convocatorias (id, nombre, penalizacion_por_fallo)
VALUES (
  '00000000-0000-4000-8000-000000000511',
  'Convocatoria examen oficial',
  0.25
);

INSERT INTO public.temas (id, nombre)
VALUES ('00000000-0000-4000-8000-000000000521', 'Tema de examen oficial');

INSERT INTO public.convocatoria_tema (convocatoria_id, tema_id, numero, orden)
VALUES (
  '00000000-0000-4000-8000-000000000511',
  '00000000-0000-4000-8000-000000000521',
  1,
  1
);

INSERT INTO public.examenes (id, nombre, fecha, es_oficial)
VALUES
  (
    '00000000-0000-4000-8000-000000000531',
    'Examen oficial publicado',
    '2026-05-01',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000532',
    'Examen no oficial',
    '2026-05-02',
    false
  );

INSERT INTO public.convocatoria_examen (convocatoria_id, examen_id)
VALUES
  (
    '00000000-0000-4000-8000-000000000511',
    '00000000-0000-4000-8000-000000000531'
  ),
  (
    '00000000-0000-4000-8000-000000000511',
    '00000000-0000-4000-8000-000000000532'
  );

INSERT INTO public.preguntas (
  id, examen_id, numero, enunciado, estado, origen, situacion
)
VALUES
  (
    '00000000-0000-4000-8000-000000000541',
    '00000000-0000-4000-8000-000000000531',
    1,
    'Pregunta oficial uno',
    'publicada',
    'oficial',
    'ordinaria'
  ),
  (
    '00000000-0000-4000-8000-000000000542',
    '00000000-0000-4000-8000-000000000531',
    2,
    'Pregunta oficial reserva',
    'publicada',
    'oficial',
    'reserva'
  ),
  (
    '00000000-0000-4000-8000-000000000543',
    '00000000-0000-4000-8000-000000000531',
    3,
    'Pregunta oficial anulada',
    'desactivada',
    'oficial',
    'anulada'
  );

INSERT INTO public.pregunta_tema (pregunta_id, tema_id)
VALUES
  (
    '00000000-0000-4000-8000-000000000541',
    '00000000-0000-4000-8000-000000000521'
  ),
  (
    '00000000-0000-4000-8000-000000000542',
    '00000000-0000-4000-8000-000000000521'
  );

INSERT INTO public.respuestas (pregunta_id, orden, texto, es_correcta)
SELECT p.id, n.orden, 'Opción ' || n.orden, n.orden = 1
FROM public.preguntas p
CROSS JOIN generate_series(1, 4) AS n(orden)
WHERE p.id IN (
  '00000000-0000-4000-8000-000000000541',
  '00000000-0000-4000-8000-000000000542'
);

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000501', true);

SELECT is(
  jsonb_array_length(public.consultar_catalogo_examenes_oficiales()),
  1,
  'el catálogo solo ofrece exámenes oficiales completos de convocatorias activas'
);
SELECT is(
  (public.consultar_catalogo_examenes_oficiales() -> 0 ->> 'questionCount')::integer,
  2,
  'el catálogo cuenta preguntas publicadas y no anuladas, incluidas las de reserva'
);
SELECT lives_ok(
  $$SELECT public.crear_intento_test_oficial(
    '00000000-0000-4000-8000-000000000511',
    '00000000-0000-4000-8000-000000000531',
    1200
  )$$,
  'un administrador puede iniciar un examen oficial con tiempo elegido'
);
SELECT is(
  (
    SELECT array_agg(p.numero ORDER BY tip.orden)::text
    FROM public.test_intento_preguntas tip
    JOIN public.test_intentos ti ON ti.id = tip.test_intento_id
    JOIN public.preguntas p ON p.id = tip.pregunta_id
    WHERE ti.examen_id = '00000000-0000-4000-8000-000000000531'
      AND ti.usuario_id = '00000000-0000-4000-8000-000000000501'
  ),
  '{1,2}',
  'el intento incluye todas las preguntas elegibles en orden original y excluye anuladas'
);
SELECT is(
  (
    SELECT ti.expira_en - ti.iniciado_en
    FROM public.test_intentos ti
    WHERE ti.examen_id = '00000000-0000-4000-8000-000000000531'
      AND ti.usuario_id = '00000000-0000-4000-8000-000000000501'
  ),
  interval '20 minutes',
  'el límite de tiempo elegido queda persistido en el intento'
);
SELECT ok(
  NOT ((
    public.consultar_intento_test((
      SELECT ti.id
      FROM public.test_intentos ti
      WHERE ti.examen_id = '00000000-0000-4000-8000-000000000531'
        AND ti.usuario_id = '00000000-0000-4000-8000-000000000501'
    )) -> 'questions' -> 0 -> 'options' -> 0
  ) ? 'isCorrect'),
  'las respuestas correctas no se exponen mientras el intento está en curso'
);
SELECT throws_ok(
  $$SELECT public.crear_intento_test_oficial(
    '00000000-0000-4000-8000-000000000511',
    '00000000-0000-4000-8000-000000000532',
    NULL
  )$$,
  '23514',
  'El examen oficial no está disponible para esta convocatoria.',
  'el backend rechaza los exámenes que no son oficiales'
);

SELECT * FROM finish();

ROLLBACK;
