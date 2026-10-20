-- Reuse origen='oficial'/'propia' and explicacion; source references can also be document names.
ALTER TABLE public.preguntas ADD COLUMN referencia_fuente text;

CREATE TABLE public.importaciones_preguntas_operaciones (
  administrador_id uuid NOT NULL REFERENCES public.perfiles(id),
  clave uuid NOT NULL,
  contenido_hash text NOT NULL,
  resultado jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (administrador_id, clave)
);
ALTER TABLE public.importaciones_preguntas_operaciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.importaciones_preguntas_operaciones FROM anon, authenticated;

CREATE FUNCTION private.normalize_import_text(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$
  SELECT lower(btrim(regexp_replace(value, '\s+', ' ', 'g')));
$$;
CREATE INDEX preguntas_import_normalized_text_idx ON public.preguntas(private.normalize_import_text(enunciado));

CREATE FUNCTION public.revisar_importacion_preguntas_admin(p_examen_id uuid, p_filas jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE result jsonb; exam_name text;
BEGIN
  PERFORM public.exigir_rol_admin();
  IF jsonb_typeof(p_filas) IS DISTINCT FROM 'array' OR jsonb_array_length(p_filas) NOT BETWEEN 1 AND 1000
    OR octet_length(p_filas::text) > 6291456 THEN RAISE EXCEPTION 'La lista de preguntas no es válida o supera los límites.' USING ERRCODE = '22023'; END IF;
  IF p_examen_id IS NOT NULL THEN
    SELECT nombre INTO exam_name FROM public.examenes WHERE id = p_examen_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'El examen ya no existe. Selecciona otro y revisa el archivo.' USING ERRCODE = '22023'; END IF;
  END IF;
  SELECT jsonb_build_object(
    'examName', exam_name,
    'convocationNames', coalesce((SELECT jsonb_agg(c.nombre ORDER BY c.nombre) FROM public.convocatoria_examen ce JOIN public.convocatorias c ON c.id = ce.convocatoria_id WHERE ce.examen_id = p_examen_id), '[]'::jsonb),
    'topics', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'descripcion', descripcion) ORDER BY nombre, id) FROM public.temas), '[]'::jsonb),
    'occupiedNumbers', coalesce((SELECT jsonb_agg(numero) FROM public.preguntas WHERE examen_id = p_examen_id AND numero IS NOT NULL), '[]'::jsonb),
    'duplicates', coalesce((SELECT jsonb_agg(jsonb_build_object('rowNumber', (r->>'rowNumber')::integer, 'candidates', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'text', p.enunciado,
        'version', md5(p.enunciado || coalesce((SELECT jsonb_agg(jsonb_build_array(a.texto, a.es_correcta) ORDER BY a.orden) FROM public.respuestas a WHERE a.pregunta_id = p.id)::text, '')),
        'options', coalesce((SELECT jsonb_agg(jsonb_build_object('text', a.texto, 'correct', a.es_correcta) ORDER BY a.orden) FROM public.respuestas a WHERE a.pregunta_id = p.id), '[]'::jsonb),
        'exact', (SELECT jsonb_agg(private.normalize_import_text(a.texto) ORDER BY a.orden) FROM public.respuestas a WHERE a.pregunta_id = p.id)
          = (SELECT jsonb_agg(private.normalize_import_text(v) ORDER BY n) FROM jsonb_array_elements_text(r->'options') WITH ORDINALITY AS o(v,n))
      ) ORDER BY p.id), '[]'::jsonb) FROM public.preguntas p WHERE private.normalize_import_text(p.enunciado) = private.normalize_import_text(r->>'text')
    ))) FROM jsonb_array_elements(p_filas) r), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END $$;

CREATE FUNCTION public.confirmar_importacion_preguntas_admin(p_clave uuid, p_datos jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  payload_hash text; previous public.importaciones_preguntas_operaciones%ROWTYPE;
  row_data jsonb; option_text text; option_order integer; question_id uuid; exam_id uuid; topic_id uuid;
  row_number integer; question_number integer; row_count integer; total_count integer; included_count integer := 0;
  current_duplicates jsonb; expected_duplicates jsonb; result jsonb; topic_snapshot jsonb; duplicate_versions jsonb;
BEGIN
  PERFORM public.exigir_rol_admin();
  IF p_clave IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object' OR octet_length(p_datos::text) > 6291456 THEN
    RAISE EXCEPTION 'La solicitud de importación no es válida o supera los límites.' USING ERRCODE = '22023';
  END IF;
  payload_hash := encode(sha256(convert_to(p_datos::text, 'UTF8')), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_clave::text, 13));
  SELECT * INTO previous FROM public.importaciones_preguntas_operaciones WHERE administrador_id = auth.uid() AND clave = p_clave;
  IF FOUND THEN
    IF previous.contenido_hash <> payload_hash THEN RAISE EXCEPTION 'La clave de confirmación ya se usó con otro contenido. Vuelve a revisar el archivo.' USING ERRCODE = '22023'; END IF;
    RETURN previous.resultado;
  END IF;
  IF p_datos->>'origin' IS NULL OR p_datos->>'origin' NOT IN ('examen_oficial', 'generada_documentacion')
    OR jsonb_typeof(p_datos->'rows') IS DISTINCT FROM 'array'
    OR p_datos->>'reviewed' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Completa la procedencia y confirma la revisión del contenido.' USING ERRCODE = '22023';
  END IF;
  row_count := jsonb_array_length(p_datos->'rows'); total_count := (p_datos->>'totalRows')::integer;
  IF row_count NOT BETWEEN 1 AND 1000 OR total_count IS NULL OR total_count NOT BETWEEN row_count AND 1000 THEN
    RAISE EXCEPTION 'Debes incluir entre 1 y 1.000 preguntas.' USING ERRCODE = '22023'; END IF;
  exam_id := nullif(p_datos->>'examId', '')::uuid;
  IF p_datos->>'origin' = 'examen_oficial' AND exam_id IS NULL THEN RAISE EXCEPTION 'Selecciona un examen para las preguntas oficiales.' USING ERRCODE = '22023'; END IF;
  IF exam_id IS NOT NULL THEN
    PERFORM 1 FROM public.examenes WHERE id = exam_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'El examen ya no existe. Vuelve a revisar la importación.' USING ERRCODE = '22023'; END IF;
  END IF;
  -- Serialize imports so duplicate candidates are checked again against committed preceding batches.
  PERFORM pg_advisory_xact_lock(130013);
  IF (SELECT count(*) <> count(DISTINCT r->>'rowNumber') FROM jsonb_array_elements(p_datos->'rows') r) THEN
    RAISE EXCEPTION 'La solicitud contiene filas repetidas.' USING ERRCODE = '22023'; END IF;

  -- Validate the complete batch before the first write.
  FOR row_data IN SELECT value FROM jsonb_array_elements(p_datos->'rows') LOOP
    row_number := (row_data->>'rowNumber')::integer;
    question_number := nullif(row_data->>'number', '')::integer;
    IF row_number IS NULL OR row_number < 2 OR nullif(private.normalize_import_text(row_data->>'text'), '') IS NULL
      OR (exam_id IS NOT NULL AND question_number IS NULL) OR question_number <= 0
      OR row_data->>'correctAnswer' IS NULL OR row_data->>'correctAnswer' !~ '^[ABCD]$'
      OR jsonb_typeof(row_data->'options') IS DISTINCT FROM 'array' OR jsonb_array_length(row_data->'options') <> 4
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(row_data->'options') o WHERE jsonb_typeof(o) <> 'string' OR nullif(private.normalize_import_text(o #>> '{}'), '') IS NULL)
      OR (SELECT count(DISTINCT private.normalize_import_text(v)) FROM jsonb_array_elements_text(row_data->'options') o(v)) <> 4
      OR row_data->>'topicResolved' IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Fila %: revisa el enunciado, las opciones, la respuesta, el número y la resolución del tema.', row_number USING ERRCODE = '22023'; END IF;
    IF exam_id IS NOT NULL AND (
      EXISTS (SELECT 1 FROM public.preguntas WHERE examen_id = exam_id AND numero = question_number)
      OR (SELECT count(*) FROM jsonb_array_elements(p_datos->'rows') r WHERE (r->>'number')::integer = question_number) > 1
    ) THEN RAISE EXCEPTION 'Fila %: numero ya ocupado o repetido en el examen. Vuelve a revisar la importación.', row_number USING ERRCODE = '22023'; END IF;
    topic_id := nullif(row_data->>'topicId', '')::uuid;
    IF topic_id IS NOT NULL THEN
      SELECT jsonb_build_object('id', id, 'nombre', nombre, 'descripcion', descripcion) INTO topic_snapshot FROM public.temas WHERE id = topic_id FOR SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Fila %: el tema ya no existe. Vuelve a resolverlo.', row_number USING ERRCODE = '22023'; END IF;
      IF topic_snapshot IS DISTINCT FROM row_data->'topicSnapshot' THEN RAISE EXCEPTION 'Fila %: el contenido del tema ha cambiado. Vuelve a revisarlo.', row_number USING ERRCODE = '22023'; END IF;
    END IF;
    SELECT coalesce(jsonb_agg(p.id::text ORDER BY p.id::text), '[]'::jsonb) INTO current_duplicates FROM public.preguntas p
      WHERE private.normalize_import_text(p.enunciado) = private.normalize_import_text(row_data->>'text');
    IF jsonb_typeof(row_data->'duplicateIds') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Fila %: vuelve a revisar los duplicados.', row_number USING ERRCODE = '22023'; END IF;
    SELECT coalesce(jsonb_agg(v ORDER BY v), '[]'::jsonb) INTO expected_duplicates FROM jsonb_array_elements_text(row_data->'duplicateIds') d(v);
    IF current_duplicates <> expected_duplicates THEN RAISE EXCEPTION 'Fila %: el banco ha cambiado. Vuelve a revisar los posibles duplicados.', row_number USING ERRCODE = '22023'; END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'version', md5(p.enunciado || coalesce((SELECT jsonb_agg(jsonb_build_array(a.texto, a.es_correcta) ORDER BY a.orden) FROM public.respuestas a WHERE a.pregunta_id = p.id)::text, ''))) ORDER BY p.id::text), '[]'::jsonb)
      INTO duplicate_versions FROM public.preguntas p WHERE private.normalize_import_text(p.enunciado) = private.normalize_import_text(row_data->>'text');
    IF duplicate_versions IS DISTINCT FROM (SELECT coalesce(jsonb_agg(v ORDER BY v->>'id'), '[]'::jsonb) FROM jsonb_array_elements(row_data->'duplicateVersions') v) THEN
      RAISE EXCEPTION 'Fila %: una pregunta candidata ha cambiado. Vuelve a revisar los duplicados.', row_number USING ERRCODE = '22023'; END IF;
    IF (jsonb_array_length(current_duplicates) > 0 OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_datos->'rows') other
      WHERE other->>'rowNumber' <> row_data->>'rowNumber' AND private.normalize_import_text(other->>'text') = private.normalize_import_text(row_data->>'text')))
      AND row_data->>'duplicateAccepted' IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Fila %: excluye la fila o confirma expresamente su creación como pregunta nueva.', row_number USING ERRCODE = '22023'; END IF;
  END LOOP;
  FOR row_data IN SELECT value FROM jsonb_array_elements(p_datos->'rows') LOOP
    INSERT INTO public.preguntas(examen_id, numero, enunciado, explicacion, origen, referencia_fuente, estado, situacion)
    VALUES (exam_id, (row_data->>'number')::integer, btrim(row_data->>'text'), nullif(btrim(row_data->>'explanation'), ''),
      CASE p_datos->>'origin' WHEN 'examen_oficial' THEN 'oficial' ELSE 'propia' END, nullif(btrim(p_datos->>'reference'), ''), 'revision', 'ordinaria') RETURNING id INTO question_id;
    option_order := 0;
    FOR option_text IN SELECT value FROM jsonb_array_elements_text(row_data->'options') LOOP
      option_order := option_order + 1;
      INSERT INTO public.respuestas(pregunta_id, orden, texto, es_correcta)
      VALUES (question_id, option_order, btrim(option_text), option_order = strpos('ABCD', row_data->>'correctAnswer'));
    END LOOP;
    topic_id := nullif(row_data->>'topicId', '')::uuid;
    IF topic_id IS NOT NULL THEN INSERT INTO public.pregunta_tema(pregunta_id, tema_id) VALUES(question_id, topic_id); END IF;
    included_count := included_count + 1;
  END LOOP;
  result := jsonb_build_object('created', included_count, 'excluded', total_count - included_count, 'examId', exam_id);
  INSERT INTO public.importaciones_preguntas_operaciones(administrador_id, clave, contenido_hash, resultado) VALUES(auth.uid(), p_clave, payload_hash, result);
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.revisar_importacion_preguntas_admin(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirmar_importacion_preguntas_admin(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revisar_importacion_preguntas_admin(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_importacion_preguntas_admin(uuid, jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
