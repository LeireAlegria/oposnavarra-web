BEGIN;
SELECT no_plan();

SELECT ok(NOT has_function_privilege('anon', 'public.list_admin_users()', 'EXECUTE'),
  'anonymous users cannot read account details');

INSERT INTO auth.users (id, email, email_confirmed_at, created_at, last_sign_in_at)
VALUES
  ('00000000-0000-4000-8000-000000000401', 'admin-details@example.invalid', now(), '2026-01-01', '2026-10-19'),
  ('00000000-0000-4000-8000-000000000402', 'user-details@example.invalid', now(), '2026-02-01', NULL);
UPDATE public.perfiles SET rol = 'admin'
WHERE id = '00000000-0000-4000-8000-000000000401';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000401', true);
SELECT is((SELECT email FROM public.list_admin_users() WHERE id = '00000000-0000-4000-8000-000000000402'),
  'user-details@example.invalid', 'verified admin can read account email');
SELECT is((SELECT created_at FROM public.list_admin_users() WHERE id = '00000000-0000-4000-8000-000000000402'),
  '2026-02-01'::timestamptz, 'creation date comes from Auth');
SELECT ok((SELECT last_sign_in_at IS NULL FROM public.list_admin_users() WHERE id = '00000000-0000-4000-8000-000000000402'),
  'accounts without sign-ins keep a null last access');
SELECT is((SELECT last_sign_in_at FROM public.list_admin_users() WHERE id = '00000000-0000-4000-8000-000000000401'),
  '2026-10-19'::timestamptz, 'last sign-in comes from Auth');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000402', true);
SELECT throws_ok('SELECT * FROM public.list_admin_users()', '42501',
  'No tienes permisos de administrador.', 'ordinary users cannot read account details');

RESET ROLE;
UPDATE auth.users SET email_confirmed_at = NULL
WHERE id = '00000000-0000-4000-8000-000000000401';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000401', true);
SELECT throws_ok('SELECT * FROM public.list_admin_users()', '42501',
  'Debes verificar tu correo.', 'unverified administrators cannot read account details');

SELECT * FROM finish();
ROLLBACK;
