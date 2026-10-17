CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;

SELECT no_plan();

SELECT has_table('public', 'test_intentos');
SELECT has_table('public', 'test_intento_temas');
SELECT has_table('public', 'test_intento_preguntas');

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.consultar_catalogo_test()'::regprocedure,
    'EXECUTE'
  ),
  'los usuarios autenticados pueden consultar el catálogo mediante RPC'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.consultar_catalogo_test()'::regprocedure,
    'EXECUTE'
  ),
  'los usuarios anónimos no pueden consultar el catálogo'
);
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.finalizar_intento_test(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'los usuarios autenticados pueden finalizar sus tests mediante RPC'
);
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'private.resultado_test(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'la función interna de corrección no está expuesta a los usuarios'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.test_intentos', 'SELECT'),
  'los usuarios no pueden consultar directamente las tablas de intentos'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.test_intento_temas', 'SELECT'),
  'los usuarios consultan los temas de intentos únicamente mediante RPC'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.test_intento_preguntas', 'SELECT'),
  'los usuarios consultan preguntas y corrección únicamente mediante RPC'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'preguntas'
      AND policyname = 'Solo administradores gestionan preguntas'
  ),
  'las preguntas solo se gestionan mediante autorización administrativa'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'respuestas'
      AND policyname = 'Solo administradores gestionan respuestas'
  ),
  'las respuestas solo se gestionan mediante autorización administrativa'
);

SELECT * FROM finish();

ROLLBACK;
