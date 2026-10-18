CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;

SELECT no_plan();

SELECT is(
  (
    SELECT confdeltype::text
    FROM pg_catalog.pg_constraint
    WHERE conname = 'convocatoria_tema_tema_id_fkey'
  ),
  'r',
  'eliminar un tema nunca borra en cascada sus asociaciones a convocatorias'
);
SELECT is(
  (
    SELECT confdeltype::text
    FROM pg_catalog.pg_constraint
    WHERE conname = 'pregunta_tema_tema_id_fkey'
  ),
  'r',
  'eliminar un tema nunca borra en cascada sus asociaciones a preguntas'
);
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.eliminar_tema_admin(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'los usuarios autenticados pueden solicitar el borrado protegido'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.eliminar_tema_admin(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'los usuarios anónimos no pueden solicitar el borrado de temas'
);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
VALUES
  (
    '00000000-0000-4000-8000-000000000301',
    'authenticated',
    'authenticated',
    'admin-topic-deletion@example.invalid',
    '',
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000302',
    'authenticated',
    'authenticated',
    'user-topic-deletion@example.invalid',
    '',
    now()
  );

UPDATE public.perfiles
SET rol = 'admin'
WHERE id = '00000000-0000-4000-8000-000000000301';

INSERT INTO public.convocatorias (id, nombre)
VALUES ('00000000-0000-4000-8000-000000000311', 'Convocatoria tema eliminación');

INSERT INTO public.temas (id, nombre)
VALUES
  ('00000000-0000-4000-8000-000000000321', 'Tema eliminable'),
  ('00000000-0000-4000-8000-000000000322', 'Tema de convocatoria'),
  ('00000000-0000-4000-8000-000000000323', 'Tema de pregunta'),
  ('00000000-0000-4000-8000-000000000324', 'Tema de test');

INSERT INTO public.convocatoria_tema (convocatoria_id, tema_id, numero, orden)
VALUES ('00000000-0000-4000-8000-000000000311', '00000000-0000-4000-8000-000000000322', 1, 1);

INSERT INTO public.preguntas (id, enunciado)
VALUES ('00000000-0000-4000-8000-000000000331', 'Pregunta asociada a tema');

INSERT INTO public.pregunta_tema (pregunta_id, tema_id)
VALUES ('00000000-0000-4000-8000-000000000331', '00000000-0000-4000-8000-000000000323');

INSERT INTO public.test_intentos (id, usuario_id, convocatoria_id, estado, numero_preguntas)
VALUES (
  '00000000-0000-4000-8000-000000000341',
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000311',
  'en_curso',
  1
);

INSERT INTO public.test_intento_temas (test_intento_id, tema_id)
VALUES ('00000000-0000-4000-8000-000000000341', '00000000-0000-4000-8000-000000000324');

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000301', true);

SELECT lives_ok(
  $$SELECT public.eliminar_tema_admin('00000000-0000-4000-8000-000000000321')$$,
  'un administrador puede eliminar un tema sin dependencias'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.temas WHERE id = '00000000-0000-4000-8000-000000000321'
  ),
  'el tema sin dependencias se elimina'
);
SELECT throws_ok(
  $$SELECT public.eliminar_tema_admin('00000000-0000-4000-8000-000000000322')$$,
  '23503',
  'No se puede eliminar el tema porque está asociado a convocatorias, preguntas o tests realizados. Puedes desactivarlo en su lugar.',
  'un tema asociado a una convocatoria no se elimina'
);
SELECT throws_ok(
  $$SELECT public.eliminar_tema_admin('00000000-0000-4000-8000-000000000323')$$,
  '23503',
  'No se puede eliminar el tema porque está asociado a convocatorias, preguntas o tests realizados. Puedes desactivarlo en su lugar.',
  'un tema asociado a una pregunta no se elimina'
);
SELECT throws_ok(
  $$SELECT public.eliminar_tema_admin('00000000-0000-4000-8000-000000000324')$$,
  '23503',
  'No se puede eliminar el tema porque está asociado a convocatorias, preguntas o tests realizados. Puedes desactivarlo en su lugar.',
  'un tema incluido en un test realizado no se elimina'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000302', true);
SELECT throws_ok(
  $$SELECT public.eliminar_tema_admin('00000000-0000-4000-8000-000000000321')$$,
  '42501',
  'No tienes permisos de administrador.',
  'un usuario ordinario no puede eliminar temas'
);

SELECT * FROM finish();

ROLLBACK;
