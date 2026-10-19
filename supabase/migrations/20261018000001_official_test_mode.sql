ALTER TABLE public.test_intentos
ADD COLUMN examen_id uuid REFERENCES public.examenes (id) ON DELETE RESTRICT;

CREATE INDEX test_intentos_examen_idx
ON public.test_intentos (examen_id)
WHERE examen_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.resumen_test(p_test_intento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_intento public.test_intentos%ROWTYPE;
  v_convocatoria_nombre text;
  v_examen_nombre text;
  v_temas jsonb;
  v_resultado jsonb;
BEGIN
  SELECT ti.*
  INTO v_intento
  FROM public.test_intentos ti
  WHERE ti.id = p_test_intento_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT c.nombre
  INTO v_convocatoria_nombre
  FROM public.convocatorias c
  WHERE c.id = v_intento.convocatoria_id;

  SELECT e.nombre
  INTO v_examen_nombre
  FROM public.examenes e
  WHERE e.id = v_intento.examen_id;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'name', t.nombre,
        'number', ct.numero,
        'order', ct.orden
      )
      ORDER BY ct.orden
    ),
    '[]'::jsonb
  )
  INTO v_temas
  FROM public.test_intento_temas tit
  JOIN public.temas t ON t.id = tit.tema_id
  JOIN public.convocatoria_tema ct
    ON ct.convocatoria_id = v_intento.convocatoria_id
   AND ct.tema_id = tit.tema_id
  WHERE tit.test_intento_id = p_test_intento_id;

  v_resultado := CASE
    WHEN v_intento.estado = 'finalizado' THEN private.resultado_test(p_test_intento_id)
    ELSE NULL
  END;

  RETURN jsonb_build_object(
    'id', v_intento.id,
    'status', CASE WHEN v_intento.estado = 'en_curso' THEN 'in_progress' ELSE 'finalized' END,
    'convocationId', v_intento.convocatoria_id,
    'convocationName', v_convocatoria_nombre,
    'officialExamId', v_intento.examen_id,
    'officialExamName', v_examen_nombre,
    'selectedTopics', v_temas,
    'questionCount', v_intento.numero_preguntas,
    'timeLimitSeconds', v_intento.tiempo_limite_segundos,
    'startedAt', v_intento.iniciado_en,
    'expiresAt', v_intento.expira_en,
    'finishedAt', v_intento.finalizado_en,
    'result', v_resultado
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.consultar_catalogo_examenes_oficiales()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para consultar los exámenes oficiales.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.comprobar_acceso_suscripcion(auth.uid()) THEN
    RAISE EXCEPTION 'No tienes una suscripción activa para realizar tests.'
      USING ERRCODE = '42501';
  END IF;

  RETURN coalesce(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'name', e.nombre,
          'date', e.fecha,
          'convocationId', c.id,
          'convocationName', c.nombre,
          'questionCount', (
            SELECT count(*)::integer
            FROM public.preguntas p
            WHERE p.examen_id = e.id
              AND p.estado = 'publicada'
              AND p.situacion <> 'anulada'
          )
        )
        ORDER BY c.nombre, e.fecha DESC NULLS LAST, e.nombre
      )
      FROM public.convocatoria_examen ce
      JOIN public.convocatorias c
        ON c.id = ce.convocatoria_id
       AND c.activo
      JOIN public.examenes e
        ON e.id = ce.examen_id
       AND e.es_oficial
      WHERE EXISTS (
        SELECT 1
        FROM public.preguntas p
        WHERE p.examen_id = e.id
          AND p.estado = 'publicada'
          AND p.situacion <> 'anulada'
      )
        AND NOT EXISTS (
          SELECT 1
          FROM public.preguntas p
          WHERE p.examen_id = e.id
            AND p.situacion <> 'anulada'
            AND (
              p.estado <> 'publicada'
              OR p.numero IS NULL
              OR (
                SELECT count(*)
                FROM public.respuestas r
                WHERE r.pregunta_id = p.id
              ) <> 4
            )
        )
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.crear_intento_test_oficial(
  p_convocatoria_id uuid,
  p_examen_id uuid,
  p_tiempo_limite_segundos integer
)
RETURNS public.test_intentos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_usuario_id uuid := auth.uid();
  v_intento public.test_intentos%ROWTYPE;
  v_numero_preguntas integer;
BEGIN
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para crear un test oficial.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.comprobar_acceso_suscripcion(v_usuario_id) THEN
    RAISE EXCEPTION 'No tienes una suscripción activa para realizar tests.'
      USING ERRCODE = '42501';
  END IF;

  IF p_tiempo_limite_segundos IS NOT NULL
     AND p_tiempo_limite_segundos NOT IN (600, 1200, 1800, 2700, 3600) THEN
    RAISE EXCEPTION 'El tiempo seleccionado no es válido.' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.convocatoria_examen ce
    JOIN public.convocatorias c ON c.id = ce.convocatoria_id AND c.activo
    JOIN public.examenes e ON e.id = ce.examen_id AND e.es_oficial
    WHERE ce.convocatoria_id = p_convocatoria_id
      AND ce.examen_id = p_examen_id
  ) THEN
    RAISE EXCEPTION 'El examen oficial no está disponible para esta convocatoria.'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.preguntas p
    WHERE p.examen_id = p_examen_id
      AND p.situacion <> 'anulada'
      AND (
        p.estado <> 'publicada'
        OR p.numero IS NULL
        OR (
          SELECT count(*)
          FROM public.respuestas r
          WHERE r.pregunta_id = p.id
        ) <> 4
      )
  ) THEN
    RAISE EXCEPTION 'El examen oficial todavía no tiene todas sus preguntas publicadas y completas.'
      USING ERRCODE = '23514';
  END IF;

  SELECT count(*)::integer
  INTO v_numero_preguntas
  FROM public.preguntas p
  WHERE p.examen_id = p_examen_id
    AND p.estado = 'publicada'
    AND p.situacion <> 'anulada';

  IF v_numero_preguntas = 0 THEN
    RAISE EXCEPTION 'El examen oficial no tiene preguntas disponibles.'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.test_intentos (
    usuario_id,
    convocatoria_id,
    examen_id,
    estado,
    numero_preguntas,
    tiempo_limite_segundos,
    iniciado_en,
    expira_en
  )
  VALUES (
    v_usuario_id,
    p_convocatoria_id,
    p_examen_id,
    'en_curso',
    v_numero_preguntas,
    p_tiempo_limite_segundos,
    now(),
    CASE
      WHEN p_tiempo_limite_segundos IS NOT NULL
        THEN now() + make_interval(secs => p_tiempo_limite_segundos)
      ELSE NULL
    END
  )
  RETURNING * INTO v_intento;

  INSERT INTO public.test_intento_temas (test_intento_id, tema_id)
  SELECT DISTINCT v_intento.id, pt.tema_id
  FROM public.preguntas p
  JOIN public.pregunta_tema pt ON pt.pregunta_id = p.id
  JOIN public.convocatoria_tema ct
    ON ct.convocatoria_id = p_convocatoria_id
   AND ct.tema_id = pt.tema_id
  WHERE p.examen_id = p_examen_id
    AND p.estado = 'publicada'
    AND p.situacion <> 'anulada';

  INSERT INTO public.test_intento_preguntas (test_intento_id, pregunta_id, orden)
  SELECT
    v_intento.id,
    p.id,
    row_number() OVER (ORDER BY p.numero)::integer
  FROM public.preguntas p
  WHERE p.examen_id = p_examen_id
    AND p.estado = 'publicada'
    AND p.situacion <> 'anulada';

  RETURN v_intento;
END;
$$;

REVOKE ALL ON FUNCTION public.consultar_catalogo_examenes_oficiales() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crear_intento_test_oficial(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consultar_catalogo_examenes_oficiales() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_intento_test_oficial(uuid, uuid, integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION private.resumen_test(uuid) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
