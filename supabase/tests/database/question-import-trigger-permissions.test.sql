CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
BEGIN;
SELECT plan(3);
INSERT INTO auth.users(id, aud, role, email, encrypted_password, email_confirmed_at)
VALUES ('00000000-0000-4000-8000-000000002301', 'authenticated', 'authenticated', 'import-trigger@example.invalid', '', now());
UPDATE public.perfiles SET rol = 'admin' WHERE id = '00000000-0000-4000-8000-000000002301';
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002301', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok($test$
  SELECT public.confirmar_importacion_preguntas_admin('00000000-0000-4000-8000-000000002302',
    jsonb_build_object('origin', 'generada_documentacion', 'reference', '', 'examId', NULL,
      'reviewed', true, 'totalRows', 1, 'rows', jsonb_build_array(jsonb_build_object(
        'rowNumber', 2, 'number', NULL, 'text', 'Import trigger permissions regression',
        'options', '["Option A","Option B","Option C","Option D"]'::jsonb,
        'correctAnswer', 'B', 'explanation', '', 'topicId', NULL, 'topicResolved', true,
        'duplicateAccepted', false, 'duplicateIds', '[]'::jsonb, 'duplicateVersions', '[]'::jsonb))))
$test$, 'authenticated administrators can import generated questions');
SELECT lives_ok('SET CONSTRAINTS ALL IMMEDIATE', 'deferred validators complete under the authenticated role');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.respuestas a JOIN public.preguntas p ON p.id = a.pregunta_id
  WHERE p.enunciado = 'Import trigger permissions regression'), 4, 'the complete question retains all four answers');
SELECT * FROM finish();
ROLLBACK;
