CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;

SELECT no_plan();

INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
VALUES
  (
    '00000000-0000-4000-8000-000000000201',
    'authenticated',
    'authenticated',
    'admin-test-access@example.invalid',
    '',
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000202',
    'authenticated',
    'authenticated',
    'user-test-access@example.invalid',
    '',
    now()
  );

UPDATE public.perfiles
SET rol = 'admin'
WHERE id = '00000000-0000-4000-8000-000000000201';

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000201', true);

SELECT is(
  public.tiene_suscripcion_activa(),
  false,
  'el acceso de administración no simula una suscripción activa'
);
SELECT is(
  public.comprobar_acceso_suscripcion(),
  true,
  'un administrador autenticado puede acceder a tests sin suscripción'
);
SELECT is(
  public.comprobar_acceso_suscripcion('00000000-0000-4000-8000-000000000202'),
  false,
  'un administrador no puede consultar el acceso de otra cuenta'
);
SELECT lives_ok(
  $$SELECT public.consultar_catalogo_test()$$,
  'un administrador puede consultar el catálogo de tests'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000202', true);

SELECT is(
  public.comprobar_acceso_suscripcion(),
  false,
  'un usuario sin suscripción conserva la restricción de acceso'
);
SELECT throws_ok(
  $$SELECT public.consultar_catalogo_test()$$,
  '42501',
  'No tienes una suscripción activa para realizar tests.',
  'un usuario sin suscripción no puede consultar el catálogo'
);

SELECT * FROM finish();

ROLLBACK;
