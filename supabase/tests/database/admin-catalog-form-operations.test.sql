CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;

SELECT no_plan();

SELECT ok(
  to_regprocedure('public.guardar_temas_convocatoria_admin(uuid,jsonb)') IS NOT NULL,
  'la función de asociación de temas está disponible en el esquema público'
);
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.guardar_temas_convocatoria_admin(uuid,jsonb)'::regprocedure,
    'EXECUTE'
  ),
  'los usuarios autenticados pueden invocar la función protegida'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.guardar_temas_convocatoria_admin(uuid,jsonb)'::regprocedure,
    'EXECUTE'
  ),
  'los usuarios anónimos no pueden invocar la función'
);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
VALUES (
  '00000000-0000-4000-8000-000000000401',
  'authenticated',
  'authenticated',
  'admin-catalog-forms@example.invalid',
  '',
  now()
);

UPDATE public.perfiles
SET rol = 'admin'
WHERE id = '00000000-0000-4000-8000-000000000401';

INSERT INTO public.convocatorias (id, nombre)
VALUES ('00000000-0000-4000-8000-000000000411', 'Convocatoria de prueba RPC');

INSERT INTO public.temas (id, nombre)
VALUES
  ('00000000-0000-4000-8000-000000000421', 'Tema RPC uno'),
  ('00000000-0000-4000-8000-000000000422', 'Tema RPC dos');

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000401', true);

SELECT lives_ok(
  $$SELECT public.guardar_temas_convocatoria_admin(
    '00000000-0000-4000-8000-000000000411',
    '[{"tema_id":"00000000-0000-4000-8000-000000000421","numero":1,"orden":1}]'::jsonb
  )$$,
  'un administrador puede guardar las asociaciones de temas'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.convocatoria_tema
    WHERE convocatoria_id = '00000000-0000-4000-8000-000000000411'
  ),
  1,
  'el guardado crea la asociación solicitada'
);
SELECT throws_ok(
  $$SELECT public.guardar_temas_convocatoria_admin(
    '00000000-0000-4000-8000-000000000411',
    '[
      {"tema_id":"00000000-0000-4000-8000-000000000421","numero":1,"orden":1},
      {"tema_id":"00000000-0000-4000-8000-000000000422","numero":1,"orden":2}
    ]'::jsonb
  )$$,
  '22023',
  'Los temas, números y órdenes deben ser únicos y positivos.',
  'la función rechaza números duplicados antes de modificar las asociaciones'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.convocatoria_tema
    WHERE convocatoria_id = '00000000-0000-4000-8000-000000000411'
      AND tema_id = '00000000-0000-4000-8000-000000000421'
      AND numero = 1
      AND orden = 1
  ),
  1,
  'un guardado inválido conserva intactas las asociaciones anteriores'
);

SELECT * FROM finish();

ROLLBACK;
