CREATE OR REPLACE FUNCTION public.guardar_plan_admin(
  p_plan_id uuid,
  p_codigo text,
  p_nombre text,
  p_precio_centimos integer,
  p_moneda text,
  p_duracion_meses integer,
  p_activo boolean,
  p_orden integer
)
RETURNS public.planes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  saved_plan public.planes%ROWTYPE;
BEGIN
  PERFORM public.exigir_rol_admin();

  IF nullif(btrim(p_codigo), '') IS NULL
    OR nullif(btrim(p_nombre), '') IS NULL
    OR p_precio_centimos IS NULL
    OR p_precio_centimos <= 0
    OR p_moneda <> 'EUR'
    OR p_duracion_meses NOT IN (1, 6, 12)
    OR p_activo IS NULL
    OR p_orden IS NULL
    OR p_orden <= 0
  THEN
    RAISE EXCEPTION 'Los datos del plan no son válidos.' USING ERRCODE = '22023';
  END IF;

  IF p_plan_id IS NULL THEN
    INSERT INTO public.planes (
      codigo, nombre, precio_centimos, moneda, duracion_meses, activo, orden
    )
    VALUES (
      btrim(p_codigo), btrim(p_nombre), p_precio_centimos, p_moneda,
      p_duracion_meses, p_activo, p_orden
    )
    RETURNING * INTO saved_plan;
  ELSE
    UPDATE public.planes
    SET codigo = btrim(p_codigo),
        nombre = btrim(p_nombre),
        precio_centimos = p_precio_centimos,
        moneda = p_moneda,
        duracion_meses = p_duracion_meses,
        activo = p_activo,
        orden = p_orden
    WHERE id = p_plan_id
    RETURNING * INTO saved_plan;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No se encontró el plan que quieres editar.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN saved_plan;
END;
$$;

CREATE OR REPLACE FUNCTION public.guardar_temas_convocatoria_admin(
  p_convocatoria_id uuid,
  p_relaciones jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  relation_count bigint;
  distinct_topics bigint;
  distinct_numbers bigint;
  distinct_orders bigint;
BEGIN
  PERFORM public.exigir_rol_admin();

  IF jsonb_typeof(p_relaciones) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'La lista de temas no es válida.' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.convocatorias
  WHERE id = p_convocatoria_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró la convocatoria.' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*), count(DISTINCT tema_id), count(DISTINCT numero), count(DISTINCT orden)
  INTO relation_count, distinct_topics, distinct_numbers, distinct_orders
  FROM jsonb_to_recordset(p_relaciones) AS relation(tema_id uuid, numero integer, orden integer);

  IF relation_count <> jsonb_array_length(p_relaciones)
    OR relation_count <> distinct_topics
    OR relation_count <> distinct_numbers
    OR relation_count <> distinct_orders
    OR EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(p_relaciones) AS relation(tema_id uuid, numero integer, orden integer)
      WHERE tema_id IS NULL OR numero IS NULL OR numero <= 0 OR orden IS NULL OR orden <= 0
    )
  THEN
    RAISE EXCEPTION 'Los temas, números y órdenes deben ser únicos y positivos.' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.convocatoria_tema
  WHERE convocatoria_id = p_convocatoria_id;

  INSERT INTO public.convocatoria_tema (convocatoria_id, tema_id, numero, orden)
  SELECT p_convocatoria_id, relation.tema_id, relation.numero, relation.orden
  FROM jsonb_to_recordset(p_relaciones) AS relation(tema_id uuid, numero integer, orden integer);
END;
$$;

CREATE OR REPLACE FUNCTION public.guardar_examenes_convocatoria_admin(
  p_convocatoria_id uuid,
  p_examen_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.exigir_rol_admin();

  IF p_examen_ids IS NULL OR cardinality(p_examen_ids) <> (
    SELECT count(DISTINCT exam_id) FROM unnest(p_examen_ids) AS relation(exam_id)
  ) THEN
    RAISE EXCEPTION 'La lista de exámenes contiene valores repetidos o no es válida.'
      USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.convocatorias
  WHERE id = p_convocatoria_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró la convocatoria.' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.convocatoria_examen
  WHERE convocatoria_id = p_convocatoria_id;

  INSERT INTO public.convocatoria_examen (convocatoria_id, examen_id)
  SELECT p_convocatoria_id, examen_id
  FROM unnest(p_examen_ids) AS examen_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.guardar_pregunta_admin(
  p_pregunta_id uuid,
  p_datos jsonb,
  p_respuestas jsonb,
  p_tema_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  saved_question_id uuid;
  question_number integer;
  question_exam_id uuid;
  answer_count bigint;
  distinct_orders bigint;
  correct_answer_count bigint;
BEGIN
  PERFORM public.exigir_rol_admin();

  IF jsonb_typeof(p_datos) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_respuestas) IS DISTINCT FROM 'array'
    OR p_tema_ids IS NULL
  THEN
    RAISE EXCEPTION 'Los datos de la pregunta no son válidos.' USING ERRCODE = '22023';
  END IF;

  question_number := nullif(p_datos->>'numero', '')::integer;
  question_exam_id := nullif(p_datos->>'examen_id', '')::uuid;

  IF nullif(btrim(p_datos->>'enunciado'), '') IS NULL
    OR p_datos->>'estado' IS NULL
    OR p_datos->>'estado' NOT IN ('revision', 'publicada', 'desactivada')
    OR p_datos->>'origen' IS NULL
    OR p_datos->>'origen' NOT IN ('oficial', 'propia')
    OR p_datos->>'situacion' IS NULL
    OR p_datos->>'situacion' NOT IN ('ordinaria', 'reserva', 'anulada')
    OR (question_number IS NOT NULL AND question_number <= 0)
  THEN
    RAISE EXCEPTION 'Los campos de la pregunta no son válidos.' USING ERRCODE = '22023';
  END IF;

  SELECT count(*), count(DISTINCT orden), count(*) FILTER (WHERE es_correcta)
  INTO answer_count, distinct_orders, correct_answer_count
  FROM jsonb_to_recordset(p_respuestas) AS answer(orden integer, texto text, es_correcta boolean);

  IF answer_count <> jsonb_array_length(p_respuestas)
    OR answer_count <> distinct_orders
    OR EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(p_respuestas) AS answer(orden integer, texto text, es_correcta boolean)
      WHERE orden NOT BETWEEN 1 AND 4
        OR nullif(btrim(texto), '') IS NULL
        OR es_correcta IS NULL
    )
    OR (
      p_datos->>'estado' = 'publicada'
      AND (answer_count <> 4 OR correct_answer_count <> 1)
    )
  THEN
    RAISE EXCEPTION 'Una pregunta publicada requiere cuatro respuestas y exactamente una correcta; revisa también el orden y el texto.'
      USING ERRCODE = '23514';
  END IF;

  IF cardinality(p_tema_ids) <> (
    SELECT count(DISTINCT topic_id) FROM unnest(p_tema_ids) AS relation(topic_id)
  ) THEN
    RAISE EXCEPTION 'La pregunta contiene temas repetidos.' USING ERRCODE = '22023';
  END IF;

  IF p_pregunta_id IS NULL THEN
    INSERT INTO public.preguntas (
      numero, enunciado, explicacion, fuente_url, estado, origen, situacion, examen_id
    )
    VALUES (
      question_number,
      btrim(p_datos->>'enunciado'),
      nullif(btrim(p_datos->>'explicacion'), ''),
      nullif(btrim(p_datos->>'fuente_url'), ''),
      p_datos->>'estado',
      p_datos->>'origen',
      p_datos->>'situacion',
      question_exam_id
    )
    RETURNING id INTO saved_question_id;
  ELSE
    UPDATE public.preguntas
    SET numero = question_number,
        enunciado = btrim(p_datos->>'enunciado'),
        explicacion = nullif(btrim(p_datos->>'explicacion'), ''),
        fuente_url = nullif(btrim(p_datos->>'fuente_url'), ''),
        estado = p_datos->>'estado',
        origen = p_datos->>'origen',
        situacion = p_datos->>'situacion',
        examen_id = question_exam_id
    WHERE id = p_pregunta_id
    RETURNING id INTO saved_question_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No se encontró la pregunta que quieres editar.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  DELETE FROM public.respuestas WHERE pregunta_id = saved_question_id;
  INSERT INTO public.respuestas (pregunta_id, orden, texto, es_correcta)
  SELECT saved_question_id, answer.orden, btrim(answer.texto), answer.es_correcta
  FROM jsonb_to_recordset(p_respuestas) AS answer(orden integer, texto text, es_correcta boolean);

  DELETE FROM public.pregunta_tema WHERE pregunta_id = saved_question_id;
  INSERT INTO public.pregunta_tema (pregunta_id, tema_id)
  SELECT saved_question_id, topic_id FROM unnest(p_tema_ids) AS relation(topic_id);

  RETURN saved_question_id;
END;
$$;

REVOKE ALL ON FUNCTION public.guardar_plan_admin(uuid, text, text, integer, text, integer, boolean, integer)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.guardar_temas_convocatoria_admin(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.guardar_examenes_convocatoria_admin(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.guardar_pregunta_admin(uuid, jsonb, jsonb, uuid[]) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.guardar_plan_admin(uuid, text, text, integer, text, integer, boolean, integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_temas_convocatoria_admin(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_examenes_convocatoria_admin(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_pregunta_admin(uuid, jsonb, jsonb, uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
