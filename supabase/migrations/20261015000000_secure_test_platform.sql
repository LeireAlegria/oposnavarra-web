ALTER TABLE public.convocatorias
ADD COLUMN IF NOT EXISTS penalizacion_por_fallo numeric(5, 2) NOT NULL DEFAULT 0.33;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'convocatorias_penalizacion_por_fallo_check'
      AND conrelid = 'public.convocatorias'::regclass
  ) THEN
    ALTER TABLE public.convocatorias
    ADD CONSTRAINT convocatorias_penalizacion_por_fallo_check
    CHECK (penalizacion_por_fallo >= 0 AND penalizacion_por_fallo <= 1);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.resultado_test(p_test_intento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_intento public.test_intentos%ROWTYPE;
  v_total integer;
  v_aciertos integer;
  v_fallos integer;
  v_en_blanco integer;
  v_penalizacion numeric(5, 2);
  v_puntuacion_neta numeric(5, 2);
  v_nota numeric(5, 2);
  v_porcentaje_aciertos numeric(5, 2);
  v_tiempo_empleado integer;
  v_resultados_tema jsonb;
BEGIN
  SELECT *
  INTO v_intento
  FROM public.test_intentos
  WHERE id = p_test_intento_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE tip.resultado = 'correcta')::integer,
    count(*) FILTER (WHERE tip.resultado = 'incorrecta')::integer,
    count(*) FILTER (WHERE tip.resultado = 'en_blanco')::integer
  INTO v_total, v_aciertos, v_fallos, v_en_blanco
  FROM public.test_intento_preguntas tip
  WHERE tip.test_intento_id = p_test_intento_id;

  IF v_total = 0 THEN
    RAISE EXCEPTION 'El intento no contiene preguntas para corregir.' USING ERRCODE = '23514';
  END IF;

  SELECT coalesce(v_intento.penalizacion_aplicada, c.penalizacion_por_fallo)
  INTO v_penalizacion
  FROM public.convocatorias c
  WHERE c.id = v_intento.convocatoria_id;

  v_puntuacion_neta := v_aciertos - (v_fallos * v_penalizacion);
  v_nota := greatest(0, least(10, round((v_puntuacion_neta / v_total) * 10, 2)));
  v_porcentaje_aciertos := round((v_aciertos::numeric / v_total) * 100, 2);
  v_tiempo_empleado := greatest(
    0,
    floor(extract(epoch FROM (v_intento.finalizado_en - v_intento.iniciado_en)))::integer
  );

  IF v_intento.tiempo_limite_segundos IS NOT NULL THEN
    v_tiempo_empleado := least(v_tiempo_empleado, v_intento.tiempo_limite_segundos);
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'topicId', por_tema.id,
      'topicName', por_tema.nombre,
      'topicNumber', por_tema.numero,
      'questionCount', por_tema.preguntas,
      'aciertos', por_tema.aciertos,
      'fallos', por_tema.fallos,
      'enBlanco', por_tema.en_blanco,
      'porcentajeAciertos', round((por_tema.aciertos::numeric / por_tema.preguntas) * 100, 2)
    )
    ORDER BY por_tema.orden
  ), '[]'::jsonb)
  INTO v_resultados_tema
  FROM (
    SELECT
      t.id,
      t.nombre,
      ct.numero,
      ct.orden,
      count(*)::integer AS preguntas,
      count(*) FILTER (WHERE tip.resultado = 'correcta')::integer AS aciertos,
      count(*) FILTER (WHERE tip.resultado = 'incorrecta')::integer AS fallos,
      count(*) FILTER (WHERE tip.resultado = 'en_blanco')::integer AS en_blanco
    FROM public.test_intento_temas tit
    JOIN public.convocatoria_tema ct
      ON ct.tema_id = tit.tema_id
     AND ct.convocatoria_id = v_intento.convocatoria_id
    JOIN public.temas t ON t.id = tit.tema_id
    JOIN public.pregunta_tema pt ON pt.tema_id = tit.tema_id
    JOIN public.test_intento_preguntas tip
      ON tip.pregunta_id = pt.pregunta_id
     AND tip.test_intento_id = p_test_intento_id
    WHERE tit.test_intento_id = p_test_intento_id
    GROUP BY t.id, t.nombre, ct.numero, ct.orden
  ) por_tema;

  RETURN jsonb_build_object(
    'totalQuestions', v_total,
    'aciertos', v_aciertos,
    'fallos', v_fallos,
    'enBlanco', v_en_blanco,
    'puntuacionNeta', v_puntuacion_neta,
    'nota', v_nota,
    'porcentajeAciertos', v_porcentaje_aciertos,
    'tiempoEmpleadoSegundos', v_tiempo_empleado,
    'penalizacionAplicada', v_penalizacion,
    'byTopic', v_resultados_tema
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.finalizar_test(p_test_intento_id uuid, p_usuario_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_intento public.test_intentos%ROWTYPE;
  v_resultado jsonb;
  v_finalizado_en timestamptz;
BEGIN
  SELECT *
  INTO v_intento
  FROM public.test_intentos
  WHERE id = p_test_intento_id
    AND usuario_id = p_usuario_id
  FOR UPDATE;

  IF NOT FOUND OR v_intento.estado = 'finalizado' THEN
    RETURN;
  END IF;

  v_finalizado_en := CASE
    WHEN v_intento.expira_en IS NOT NULL AND v_intento.expira_en <= now()
      THEN v_intento.expira_en
    ELSE now()
  END;

  UPDATE public.test_intento_preguntas tip
  SET resultado = CASE
    WHEN tip.respuesta_seleccionada_id IS NULL THEN 'en_blanco'
    WHEN r.es_correcta THEN 'correcta'
    ELSE 'incorrecta'
  END
  FROM public.respuestas r
  WHERE tip.test_intento_id = p_test_intento_id
    AND r.id = tip.respuesta_seleccionada_id
    AND tip.resultado IS NULL;

  UPDATE public.test_intento_preguntas tip
  SET resultado = 'en_blanco'
  WHERE tip.test_intento_id = p_test_intento_id
    AND tip.respuesta_seleccionada_id IS NULL
    AND tip.resultado IS NULL;

  UPDATE public.test_intentos
  SET finalizado_en = v_finalizado_en
  WHERE id = p_test_intento_id;

  v_resultado := private.resultado_test(p_test_intento_id);

  UPDATE public.test_intentos
  SET estado = 'finalizado',
      tiempo_empleado_segundos = (v_resultado ->> 'tiempoEmpleadoSegundos')::integer,
      aciertos = (v_resultado ->> 'aciertos')::integer,
      fallos = (v_resultado ->> 'fallos')::integer,
      en_blanco = (v_resultado ->> 'enBlanco')::integer,
      puntuacion_neta = (v_resultado ->> 'puntuacionNeta')::numeric,
      nota = (v_resultado ->> 'nota')::numeric,
      porcentaje_aciertos = (v_resultado ->> 'porcentajeAciertos')::numeric,
      penalizacion_aplicada = (v_resultado ->> 'penalizacionAplicada')::numeric
  WHERE id = p_test_intento_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.resumen_test(p_test_intento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_intento public.test_intentos%ROWTYPE;
  v_convocatoria_nombre text;
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

CREATE OR REPLACE FUNCTION public.consultar_catalogo_test()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debe iniciar sesión para consultar las convocatorias.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.comprobar_acceso_suscripcion(auth.uid()) THEN
    RAISE EXCEPTION 'No tienes una suscripción activa para realizar tests.' USING ERRCODE = '42501';
  END IF;

  RETURN coalesce(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.nombre,
          'topics', coalesce(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', t.id,
                  'name', t.nombre,
                  'number', ct.numero,
                  'order', ct.orden,
                  'availableQuestions', (
                    SELECT count(DISTINCT p.id)::integer
                    FROM public.preguntas p
                    JOIN public.pregunta_tema pt ON pt.pregunta_id = p.id
                    WHERE pt.tema_id = t.id
                      AND p.estado = 'publicada'
                      AND p.situacion <> 'anulada'
                  )
                )
                ORDER BY ct.orden
              )
              FROM public.convocatoria_tema ct
              JOIN public.temas t ON t.id = ct.tema_id AND t.activo
              WHERE ct.convocatoria_id = c.id
            ),
            '[]'::jsonb
          )
        )
        ORDER BY c.nombre
      )
      FROM public.convocatorias c
      WHERE c.activo
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.contar_preguntas_test(
  p_convocatoria_id uuid,
  p_temas_seleccionados uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_temas_validos integer;
  v_numero_temas integer;
  v_total integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debe iniciar sesión para consultar preguntas.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.comprobar_acceso_suscripcion(auth.uid()) THEN
    RAISE EXCEPTION 'No tienes una suscripción activa para realizar tests.' USING ERRCODE = '42501';
  END IF;

  IF p_temas_seleccionados IS NULL OR cardinality(p_temas_seleccionados) = 0 THEN
    RETURN 0;
  END IF;

  SELECT count(DISTINCT tema_id)::integer
  INTO v_numero_temas
  FROM unnest(p_temas_seleccionados) AS seleccion(tema_id);

  IF v_numero_temas <> cardinality(p_temas_seleccionados) THEN
    RAISE EXCEPTION 'No se pueden repetir temas en la selección.' USING ERRCODE = '23514';
  END IF;

  SELECT count(*)::integer
  INTO v_temas_validos
  FROM unnest(p_temas_seleccionados) AS seleccion(tema_id)
  JOIN public.convocatoria_tema ct
    ON ct.tema_id = seleccion.tema_id
   AND ct.convocatoria_id = p_convocatoria_id
  JOIN public.temas t ON t.id = ct.tema_id AND t.activo;

  IF v_temas_validos <> v_numero_temas
     OR NOT EXISTS (
       SELECT 1 FROM public.convocatorias c
       WHERE c.id = p_convocatoria_id AND c.activo
     ) THEN
    RAISE EXCEPTION 'La convocatoria o los temas seleccionados no están disponibles.' USING ERRCODE = '23514';
  END IF;

  SELECT count(DISTINCT p.id)::integer
  INTO v_total
  FROM public.preguntas p
  JOIN public.pregunta_tema pt ON pt.pregunta_id = p.id
  JOIN public.convocatoria_tema ct ON ct.tema_id = pt.tema_id
  WHERE ct.convocatoria_id = p_convocatoria_id
    AND ct.tema_id = ANY(p_temas_seleccionados)
    AND p.estado = 'publicada'
    AND p.situacion <> 'anulada';

  RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.crear_intento_test(
  p_convocatoria_id uuid,
  p_numero_preguntas integer,
  p_tiempo_limite_segundos integer,
  p_temas_seleccionados uuid[]
)
RETURNS public.test_intentos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_usuario_id uuid := auth.uid();
  v_intento public.test_intentos%ROWTYPE;
  v_disponibles integer;
BEGIN
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Debe iniciar sesión para crear un test.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.comprobar_acceso_suscripcion(v_usuario_id) THEN
    RAISE EXCEPTION 'No tienes una suscripción activa para realizar tests.' USING ERRCODE = '42501';
  END IF;

  IF p_numero_preguntas NOT IN (10, 20, 30, 40, 50) THEN
    RAISE EXCEPTION 'El número de preguntas seleccionado no es válido.' USING ERRCODE = '23514';
  END IF;

  IF p_tiempo_limite_segundos IS NOT NULL
     AND p_tiempo_limite_segundos NOT IN (600, 1200, 1800, 2700, 3600) THEN
    RAISE EXCEPTION 'El tiempo seleccionado no es válido.' USING ERRCODE = '23514';
  END IF;

  v_disponibles := public.contar_preguntas_test(
    p_convocatoria_id,
    p_temas_seleccionados
  );

  IF v_disponibles < 10 OR p_numero_preguntas > v_disponibles THEN
    RAISE EXCEPTION 'No hay suficientes preguntas para la configuración seleccionada.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.test_intentos (
    usuario_id,
    convocatoria_id,
    estado,
    numero_preguntas,
    tiempo_limite_segundos,
    iniciado_en,
    expira_en
  )
  VALUES (
    v_usuario_id,
    p_convocatoria_id,
    'en_curso',
    p_numero_preguntas,
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
  SELECT v_intento.id, seleccion.tema_id
  FROM unnest(p_temas_seleccionados) AS seleccion(tema_id);

  WITH preguntas_seleccionadas AS (
    SELECT p.id, row_number() OVER (ORDER BY random())::integer AS orden
    FROM (
      SELECT DISTINCT q.id
      FROM public.preguntas q
      JOIN public.pregunta_tema pt ON pt.pregunta_id = q.id
      JOIN public.convocatoria_tema ct ON ct.tema_id = pt.tema_id
      WHERE ct.convocatoria_id = p_convocatoria_id
        AND ct.tema_id = ANY(p_temas_seleccionados)
        AND q.estado = 'publicada'
        AND q.situacion <> 'anulada'
    ) p
    ORDER BY random()
    LIMIT p_numero_preguntas
  )
  INSERT INTO public.test_intento_preguntas (test_intento_id, pregunta_id, orden)
  SELECT v_intento.id, preguntas_seleccionadas.id, preguntas_seleccionadas.orden
  FROM preguntas_seleccionadas;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se pudieron seleccionar preguntas para este test.' USING ERRCODE = '23514';
  END IF;

  RETURN v_intento;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_intentos_en_curso_test()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_usuario_id uuid := auth.uid();
  v_intento_id uuid;
BEGIN
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Debe iniciar sesión para consultar sus tests.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.comprobar_acceso_suscripcion(v_usuario_id) THEN
    RAISE EXCEPTION 'No tienes una suscripción activa para continuar tests.' USING ERRCODE = '42501';
  END IF;

  FOR v_intento_id IN
    SELECT ti.id
    FROM public.test_intentos ti
    WHERE ti.usuario_id = v_usuario_id
      AND ti.estado = 'en_curso'
      AND ti.expira_en IS NOT NULL
      AND ti.expira_en <= now()
  LOOP
    PERFORM private.finalizar_test(v_intento_id, v_usuario_id);
  END LOOP;

  RETURN coalesce(
    (
      SELECT jsonb_agg(private.resumen_test(ti.id) ORDER BY ti.iniciado_en DESC)
      FROM public.test_intentos ti
      WHERE ti.usuario_id = v_usuario_id
        AND ti.estado = 'en_curso'
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.guardar_respuesta_test(
  p_test_intento_id uuid,
  p_pregunta_id uuid,
  p_respuesta_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_usuario_id uuid := auth.uid();
  v_intento public.test_intentos%ROWTYPE;
  v_actualizado uuid;
BEGIN
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Debe iniciar sesión para guardar una respuesta.' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_intento
  FROM public.test_intentos
  WHERE id = p_test_intento_id
    AND usuario_id = v_usuario_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe un intento de test asociado a este usuario.' USING ERRCODE = '42501';
  END IF;

  IF v_intento.estado <> 'en_curso' THEN
    RETURN false;
  END IF;

  IF v_intento.expira_en IS NOT NULL AND v_intento.expira_en <= now() THEN
    PERFORM private.finalizar_test(p_test_intento_id, v_usuario_id);
    RETURN false;
  END IF;

  IF NOT public.comprobar_acceso_suscripcion(v_usuario_id) THEN
    RAISE EXCEPTION 'No tienes una suscripción activa para continuar tests.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.test_intento_preguntas tip
  SET respuesta_seleccionada_id = p_respuesta_id
  WHERE tip.test_intento_id = p_test_intento_id
    AND tip.pregunta_id = p_pregunta_id
    AND tip.resultado IS NULL
  RETURNING tip.id INTO v_actualizado;

  IF v_actualizado IS NULL THEN
    RAISE EXCEPTION 'La pregunta no pertenece a este test o ya no admite respuestas.' USING ERRCODE = '23514';
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalizar_intento_test(p_test_intento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_usuario_id uuid := auth.uid();
  v_intento public.test_intentos%ROWTYPE;
BEGIN
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Debe iniciar sesión para finalizar un test.' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_intento
  FROM public.test_intentos
  WHERE id = p_test_intento_id
    AND usuario_id = v_usuario_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe un intento de test asociado a este usuario.' USING ERRCODE = '42501';
  END IF;

  IF v_intento.estado = 'en_curso' THEN
    IF NOT public.comprobar_acceso_suscripcion(v_usuario_id)
       AND (v_intento.expira_en IS NULL OR v_intento.expira_en > now()) THEN
      RAISE EXCEPTION 'No tienes una suscripción activa para finalizar este test.' USING ERRCODE = '42501';
    END IF;
    PERFORM private.finalizar_test(p_test_intento_id, v_usuario_id);
  END IF;

  RETURN private.resumen_test(p_test_intento_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.consultar_intento_test(p_test_intento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_usuario_id uuid := auth.uid();
  v_intento public.test_intentos%ROWTYPE;
  v_resumen jsonb;
  v_preguntas jsonb;
BEGIN
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Debe iniciar sesión para consultar un test.' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_intento
  FROM public.test_intentos
  WHERE id = p_test_intento_id
    AND usuario_id = v_usuario_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe un intento de test asociado a este usuario.' USING ERRCODE = '42501';
  END IF;

  IF v_intento.estado = 'en_curso'
     AND v_intento.expira_en IS NOT NULL
     AND v_intento.expira_en <= now() THEN
    PERFORM private.finalizar_test(p_test_intento_id, v_usuario_id);
    SELECT * INTO v_intento
    FROM public.test_intentos
    WHERE id = p_test_intento_id;
  END IF;

  IF NOT public.comprobar_acceso_suscripcion(v_usuario_id) THEN
    RAISE EXCEPTION 'Se requiere una suscripción activa para consultar las preguntas.' USING ERRCODE = '42501';
  END IF;

  v_resumen := private.resumen_test(p_test_intento_id);

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', tip.pregunta_id,
        'order', tip.orden,
        'text', p.enunciado,
        'selectedAnswerId', tip.respuesta_seleccionada_id,
        'status', tip.resultado,
        'topics', coalesce(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', t.id,
                'name', t.nombre,
                'number', ct.numero,
                'order', ct.orden
              )
              ORDER BY ct.orden
            )
            FROM public.pregunta_tema pt
            JOIN public.temas t ON t.id = pt.tema_id
            JOIN public.convocatoria_tema ct
              ON ct.convocatoria_id = v_intento.convocatoria_id
             AND ct.tema_id = pt.tema_id
            JOIN public.test_intento_temas tit
              ON tit.test_intento_id = p_test_intento_id
             AND tit.tema_id = pt.tema_id
            WHERE pt.pregunta_id = tip.pregunta_id
          ),
          '[]'::jsonb
        ),
        'options', coalesce(
          (
            SELECT jsonb_agg(
              CASE
                WHEN v_intento.estado = 'finalizado' THEN jsonb_build_object(
                  'id', r.id,
                  'text', r.texto,
                  'order', r.orden,
                  'isCorrect', r.es_correcta
                )
                ELSE jsonb_build_object(
                  'id', r.id,
                  'text', r.texto,
                  'order', r.orden
                )
              END
              ORDER BY r.orden
            )
            FROM public.respuestas r
            WHERE r.pregunta_id = tip.pregunta_id
          ),
          '[]'::jsonb
        )
      )
      ORDER BY tip.orden
    ),
    '[]'::jsonb
  )
  INTO v_preguntas
  FROM public.test_intento_preguntas tip
  JOIN public.preguntas p ON p.id = tip.pregunta_id
  WHERE tip.test_intento_id = p_test_intento_id;

  RETURN v_resumen || jsonb_build_object('questions', v_preguntas);
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_historial_test(p_limite integer DEFAULT 10, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_usuario_id uuid := auth.uid();
  v_intento_id uuid;
  v_items jsonb;
  v_tiene_mas boolean;
BEGIN
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Debe iniciar sesión para consultar el historial.' USING ERRCODE = '42501';
  END IF;

  IF p_limite < 1 OR p_limite > 50 OR p_offset < 0 THEN
    RAISE EXCEPTION 'La paginación del historial no es válida.' USING ERRCODE = '23514';
  END IF;

  FOR v_intento_id IN
    SELECT ti.id
    FROM public.test_intentos ti
    WHERE ti.usuario_id = v_usuario_id
      AND ti.estado = 'en_curso'
      AND ti.expira_en IS NOT NULL
      AND ti.expira_en <= now()
  LOOP
    PERFORM private.finalizar_test(v_intento_id, v_usuario_id);
  END LOOP;

  WITH pagina AS (
    SELECT ti.id, ti.finalizado_en
    FROM public.test_intentos ti
    WHERE ti.usuario_id = v_usuario_id
      AND ti.estado = 'finalizado'
    ORDER BY ti.finalizado_en DESC, ti.id DESC
    LIMIT p_limite + 1
    OFFSET p_offset
  ),
  pagina_limitada AS (
    SELECT id, finalizado_en
    FROM pagina
    ORDER BY finalizado_en DESC, id DESC
    LIMIT p_limite
  )
  SELECT
    coalesce(
      (
        SELECT jsonb_agg(private.resumen_test(pl.id) ORDER BY pl.finalizado_en DESC, pl.id DESC)
        FROM pagina_limitada pl
      ),
      '[]'::jsonb
    ),
    (SELECT count(*) > p_limite FROM pagina)
  INTO v_items, v_tiene_mas;

  RETURN jsonb_build_object('items', v_items, 'hasMore', v_tiene_mas);
END;
$$;

ALTER TABLE public.convocatorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convocatoria_tema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.examenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convocatoria_examen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.respuestas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pregunta_tema ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solo administradores gestionan convocatorias"
ON public.convocatorias
FOR ALL
USING (public.es_admin_actual())
WITH CHECK (public.es_admin_actual());

CREATE POLICY "Solo administradores gestionan temas"
ON public.temas
FOR ALL
USING (public.es_admin_actual())
WITH CHECK (public.es_admin_actual());

CREATE POLICY "Solo administradores gestionan convocatoria temas"
ON public.convocatoria_tema
FOR ALL
USING (public.es_admin_actual())
WITH CHECK (public.es_admin_actual());

CREATE POLICY "Solo administradores gestionan examenes"
ON public.examenes
FOR ALL
USING (public.es_admin_actual())
WITH CHECK (public.es_admin_actual());

CREATE POLICY "Solo administradores gestionan convocatoria examenes"
ON public.convocatoria_examen
FOR ALL
USING (public.es_admin_actual())
WITH CHECK (public.es_admin_actual());

CREATE POLICY "Solo administradores gestionan preguntas"
ON public.preguntas
FOR ALL
USING (public.es_admin_actual())
WITH CHECK (public.es_admin_actual());

CREATE POLICY "Solo administradores gestionan respuestas"
ON public.respuestas
FOR ALL
USING (public.es_admin_actual())
WITH CHECK (public.es_admin_actual());

CREATE POLICY "Solo administradores gestionan pregunta temas"
ON public.pregunta_tema
FOR ALL
USING (public.es_admin_actual())
WITH CHECK (public.es_admin_actual());

REVOKE ALL ON TABLE public.test_intentos FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.test_intento_temas FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.test_intento_preguntas FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.finalizar_intento_test(
  uuid, integer, integer, integer, integer, numeric, numeric, numeric, numeric
) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION private.resultado_test(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.finalizar_test(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.resumen_test(uuid) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.consultar_catalogo_test() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.contar_preguntas_test(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.crear_intento_test(uuid, integer, integer, uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.listar_intentos_en_curso_test() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.guardar_respuesta_test(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.finalizar_intento_test(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.consultar_intento_test(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.listar_historial_test(integer, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.consultar_catalogo_test() TO authenticated;
GRANT EXECUTE ON FUNCTION public.contar_preguntas_test(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_intento_test(uuid, integer, integer, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_intentos_en_curso_test() TO authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_respuesta_test(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_intento_test(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consultar_intento_test(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_historial_test(integer, integer) TO authenticated;
