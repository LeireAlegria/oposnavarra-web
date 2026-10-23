CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
BEGIN;
SELECT no_plan();
INSERT INTO auth.users(id, aud, role, email, encrypted_password, email_confirmed_at)
VALUES ('00000000-0000-4000-8000-000000002401', 'authenticated', 'authenticated', 'convocation-delete@example.invalid', '', now());
UPDATE public.perfiles SET rol = 'admin' WHERE id = '00000000-0000-4000-8000-000000002401';
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002401', true);
INSERT INTO public.convocatorias(id, nombre) VALUES
('00000000-0000-4000-8000-000000002402', 'Empty convocation'),
('00000000-0000-4000-8000-000000002403', 'Convocation with topic'),
('00000000-0000-4000-8000-000000002404', 'Convocation with exam');
INSERT INTO public.temas(id, nombre) VALUES ('00000000-0000-4000-8000-000000002405', 'Deletion test topic');
INSERT INTO public.examenes(id, nombre) VALUES ('00000000-0000-4000-8000-000000002406', 'Deletion test exam');
INSERT INTO public.convocatoria_tema(convocatoria_id, tema_id, numero, orden)
VALUES ('00000000-0000-4000-8000-000000002403', '00000000-0000-4000-8000-000000002405', 1, 1);
INSERT INTO public.convocatoria_examen(convocatoria_id, examen_id)
VALUES ('00000000-0000-4000-8000-000000002404', '00000000-0000-4000-8000-000000002406');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.eliminar_convocatoria_admin('00000000-0000-4000-8000-000000002402')$$, 'admin deletes an empty convocation including its empty General block');
SELECT throws_ok($$SELECT public.eliminar_convocatoria_admin('00000000-0000-4000-8000-000000002403')$$, '23503', NULL, 'RPC rejects a convocation with topics');
SELECT throws_ok($$SELECT public.eliminar_convocatoria_admin('00000000-0000-4000-8000-000000002404')$$, '23503', NULL, 'RPC rejects a convocation with exams');
SELECT throws_ok($$DELETE FROM public.convocatorias WHERE id = '00000000-0000-4000-8000-000000002403'$$, '23503', NULL, 'direct deletion cannot cascade topic associations');
SELECT throws_ok($$DELETE FROM public.convocatorias WHERE id = '00000000-0000-4000-8000-000000002404'$$, '23503', NULL, 'direct deletion cannot cascade exam associations');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.convocatoria_bloques WHERE convocatoria_id = '00000000-0000-4000-8000-000000002402'), 0, 'empty blocks do not prevent deletion');
SELECT is((SELECT count(*)::integer FROM public.convocatoria_tema WHERE convocatoria_id = '00000000-0000-4000-8000-000000002403'), 1, 'rejected deletion preserves topic associations');
UPDATE public.perfiles SET rol = 'usuario' WHERE id = '00000000-0000-4000-8000-000000002401';
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.eliminar_convocatoria_admin('00000000-0000-4000-8000-000000002404')$$, '42501', 'No tienes permisos de administrador.', 'non-admin cannot delete convocations');
RESET ROLE;
SELECT ok(NOT has_function_privilege('anon', 'public.eliminar_convocatoria_admin(uuid)', 'EXECUTE'), 'anonymous users cannot invoke deletion');
SELECT * FROM finish();
ROLLBACK;
