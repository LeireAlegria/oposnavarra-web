CREATE TABLE public.convocatoria_bloques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convocatoria_id uuid NOT NULL REFERENCES public.convocatorias(id) ON DELETE CASCADE,
  nombre text NOT NULL CHECK (btrim(nombre) <> ''),
  orden integer NOT NULL CHECK (orden > 0),
  referencia_oficial text,
  UNIQUE (convocatoria_id, orden) DEFERRABLE INITIALLY IMMEDIATE,
  UNIQUE (convocatoria_id, id)
);
ALTER TABLE public.convocatoria_bloques ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Administradores gestionan bloques" ON public.convocatoria_bloques
  FOR ALL TO authenticated USING (public.es_admin_actual()) WITH CHECK (public.es_admin_actual());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.convocatoria_bloques TO authenticated;

ALTER TABLE public.convocatoria_tema ADD COLUMN bloque_id uuid, ADD COLUMN texto_oficial text;
INSERT INTO public.convocatoria_bloques(convocatoria_id, nombre, orden)
SELECT id, 'General', 1 FROM public.convocatorias;
UPDATE public.convocatoria_tema ct SET bloque_id = b.id
FROM public.convocatoria_bloques b WHERE b.convocatoria_id = ct.convocatoria_id;
-- Any incompatible legacy data aborts the migration instead of discarding associations.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.convocatoria_tema WHERE bloque_id IS NULL OR numero <= 0 OR orden <= 0) THEN
    RAISE EXCEPTION 'Revisa las asociaciones existentes antes de migrar los bloques.';
  END IF;
END $$;
ALTER TABLE public.convocatoria_tema
  ALTER COLUMN bloque_id SET NOT NULL,
  DROP CONSTRAINT convocatoria_tema_convocatoria_id_numero_key,
  DROP CONSTRAINT convocatoria_tema_convocatoria_id_orden_key,
  ADD CONSTRAINT convocatoria_tema_bloque_convocatoria_fk FOREIGN KEY (convocatoria_id, bloque_id)
    REFERENCES public.convocatoria_bloques(convocatoria_id, id),
  ADD UNIQUE (bloque_id, numero), ADD UNIQUE (bloque_id, orden);

ALTER TABLE public.convocatorias
  ADD COLUMN origen_bon_id text UNIQUE,
  ADD COLUMN codigo_anuncio text,
  ADD COLUMN fecha_publicacion date,
  ADD COLUMN referencia_resolucion text,
  ADD COLUMN numero_bon integer,
  ADD COLUMN importado_at timestamptz,
  ADD COLUMN importacion_operacion_id uuid UNIQUE;

-- Existing manual creation paths also receive a General block.
CREATE FUNCTION private.create_general_block() RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$ BEGIN
  INSERT INTO public.convocatoria_bloques(convocatoria_id, nombre, orden) VALUES (NEW.id, 'General', 1);
  RETURN NEW;
END $$;
CREATE TRIGGER convocatoria_general_block AFTER INSERT ON public.convocatorias
FOR EACH ROW EXECUTE FUNCTION private.create_general_block();

CREATE FUNCTION private.assign_general_block() RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$ BEGIN
  IF NEW.bloque_id IS NULL THEN
    SELECT id INTO NEW.bloque_id FROM public.convocatoria_bloques
      WHERE convocatoria_id = NEW.convocatoria_id AND nombre = 'General' ORDER BY orden LIMIT 1;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER convocatoria_tema_default_block BEFORE INSERT ON public.convocatoria_tema
FOR EACH ROW EXECUTE FUNCTION private.assign_general_block();

CREATE OR REPLACE FUNCTION public.guardar_temas_convocatoria_admin(p_convocatoria_id uuid, p_relaciones jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE default_block uuid; resolved_relations jsonb;
BEGIN
  PERFORM public.exigir_rol_admin();
  PERFORM 1 FROM public.convocatorias WHERE id = p_convocatoria_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró la convocatoria.'; END IF;
  IF jsonb_typeof(p_relaciones) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'La lista de temas no es válida.'; END IF;
  SELECT id INTO default_block FROM public.convocatoria_bloques WHERE convocatoria_id = p_convocatoria_id ORDER BY orden LIMIT 1;
  -- Preserve block and official content when older callers omit these fields.
  SELECT coalesce(jsonb_agg(jsonb_build_object('tema_id', (r->>'tema_id')::uuid,
    'bloque_id', coalesce((r->>'bloque_id')::uuid, ct.bloque_id, default_block),
    'numero', (r->>'numero')::integer, 'orden', (r->>'orden')::integer,
    'texto_oficial', CASE WHEN r ? 'texto_oficial' THEN r->>'texto_oficial' ELSE ct.texto_oficial END)), '[]'::jsonb)
  INTO resolved_relations
  FROM jsonb_array_elements(p_relaciones) r
  LEFT JOIN public.convocatoria_tema ct ON ct.convocatoria_id = p_convocatoria_id AND ct.tema_id = (r->>'tema_id')::uuid;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(resolved_relations) AS r(tema_id uuid, bloque_id uuid, numero integer, orden integer)
      WHERE tema_id IS NULL OR bloque_id IS NULL OR numero IS NULL OR numero <= 0 OR orden IS NULL OR orden <= 0)
    OR (SELECT count(*) <> count(DISTINCT r->>'tema_id') FROM jsonb_array_elements(resolved_relations) r)
    OR EXISTS (SELECT 1 FROM jsonb_to_recordset(resolved_relations) AS r(bloque_id uuid, numero integer) GROUP BY bloque_id, numero HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM jsonb_to_recordset(resolved_relations) AS r(bloque_id uuid, orden integer) GROUP BY bloque_id, orden HAVING count(*) > 1)
  THEN RAISE EXCEPTION 'Los temas, números y órdenes deben ser únicos y positivos.' USING ERRCODE = '22023'; END IF;
  DELETE FROM public.convocatoria_tema WHERE convocatoria_id = p_convocatoria_id;
  INSERT INTO public.convocatoria_tema(convocatoria_id, tema_id, bloque_id, numero, orden, texto_oficial)
  SELECT p_convocatoria_id, tema_id, bloque_id, numero, orden, texto_oficial
  FROM jsonb_to_recordset(resolved_relations) AS r(tema_id uuid, bloque_id uuid, numero integer, orden integer, texto_oficial text);
END $$;

CREATE FUNCTION public.guardar_bloques_convocatoria_admin(p_convocatoria_id uuid, p_bloques jsonb, p_relaciones jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE block jsonb;
BEGIN
  PERFORM public.exigir_rol_admin();
  PERFORM 1 FROM public.convocatorias WHERE id = p_convocatoria_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró la convocatoria.'; END IF;
  IF jsonb_typeof(p_bloques) IS DISTINCT FROM 'array' OR jsonb_typeof(p_relaciones) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_bloques) = 0 THEN RAISE EXCEPTION 'Debes indicar los bloques y sus temas.'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_bloques) b JOIN public.convocatoria_bloques existing
    ON existing.id = (b->>'id')::uuid WHERE existing.convocatoria_id <> p_convocatoria_id) THEN
    RAISE EXCEPTION 'Un bloque pertenece a otra convocatoria.';
  END IF;
  IF (SELECT count(*) <> count(DISTINCT b->>'id') FROM jsonb_array_elements(p_bloques) b) THEN
    RAISE EXCEPTION 'Hay bloques repetidos.';
  END IF;
  SET CONSTRAINTS convocatoria_bloques_convocatoria_id_orden_key DEFERRED;
  FOR block IN SELECT value FROM jsonb_array_elements(p_bloques) LOOP
    INSERT INTO public.convocatoria_bloques(id, convocatoria_id, nombre, orden, referencia_oficial)
    VALUES ((block->>'id')::uuid, p_convocatoria_id, block->>'nombre', (block->>'orden')::integer, block->>'referencia_oficial')
    ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, orden = EXCLUDED.orden, referencia_oficial = EXCLUDED.referencia_oficial
    WHERE convocatoria_bloques.convocatoria_id = p_convocatoria_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Un bloque pertenece a otra convocatoria.'; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_relaciones) r
    WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_bloques) b WHERE b->>'id' = r->>'bloque_id')) THEN
    RAISE EXCEPTION 'Todos los temas deben pertenecer a un bloque del borrador.';
  END IF;
  PERFORM public.guardar_temas_convocatoria_admin(p_convocatoria_id, p_relaciones);
  DELETE FROM public.convocatoria_bloques b WHERE b.convocatoria_id = p_convocatoria_id
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_bloques) j WHERE (j->>'id')::uuid = b.id);
  SET CONSTRAINTS convocatoria_bloques_convocatoria_id_orden_key IMMEDIATE;
END $$;

CREATE FUNCTION public.confirmar_importacion_bon_admin(p_operacion_id uuid, p_borrador jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE saved_id uuid; block_id uuid; topic_id uuid; block jsonb; topic jsonb;
  block_order integer := 0; topic_order integer; source_id text;
BEGIN
  PERFORM public.exigir_rol_admin();
  IF p_operacion_id IS NULL THEN RAISE EXCEPTION 'Falta la clave de operación.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_operacion_id::text, 0));
  SELECT id INTO saved_id FROM public.convocatorias WHERE importacion_operacion_id = p_operacion_id;
  IF FOUND THEN RETURN saved_id; END IF;
  source_id := p_borrador->>'sourceId';
  IF source_id IS NULL OR source_id !~ '^\d{4}/[1-9]\d*/[1-9]\d*$'
    OR p_borrador->>'sourceUrl' IS DISTINCT FROM 'https://bon.navarra.es/es/anuncio/-/texto/' || source_id || '/'
    OR p_borrador->>'reviewed' IS DISTINCT FROM 'true'
    OR nullif(btrim(p_borrador->>'name'), '') IS NULL
    OR jsonb_typeof(p_borrador->'blocks') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_borrador->'blocks') = 0 THEN
    RAISE EXCEPTION 'Revisa los campos obligatorios y el origen de la convocatoria.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(source_id, 1));
  IF EXISTS (SELECT 1 FROM public.convocatorias WHERE origen_bon_id = source_id) THEN
    RAISE EXCEPTION 'El anuncio ya está importado.' USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.convocatorias(nombre, descripcion, organismo_convocante, grupo, fuente_oficial_url,
    origen_bon_id, codigo_anuncio, fecha_publicacion, referencia_resolucion, numero_bon, importado_at, importacion_operacion_id)
  VALUES (btrim(p_borrador->>'name'), p_borrador->>'description', p_borrador->>'organization', p_borrador->>'group',
    p_borrador->>'sourceUrl', source_id, p_borrador->>'announcementCode', nullif(p_borrador->>'publicationDate','')::date,
    p_borrador->>'resolution', split_part(source_id, '/', 2)::integer, now(), p_operacion_id) RETURNING id INTO saved_id;
  DELETE FROM public.convocatoria_bloques WHERE convocatoria_id = saved_id;
  FOR block IN SELECT value FROM jsonb_array_elements(p_borrador->'blocks') LOOP
    block_order := block_order + 1;
    IF jsonb_typeof(block->'topics') IS DISTINCT FROM 'array' OR jsonb_array_length(block->'topics') = 0 THEN
      RAISE EXCEPTION 'Cada bloque debe contener al menos un tema.';
    END IF;
    INSERT INTO public.convocatoria_bloques(convocatoria_id, nombre, orden, referencia_oficial)
    VALUES (saved_id, block->>'name', block_order, block->>'reference') RETURNING id INTO block_id;
    topic_order := 0;
    FOR topic IN SELECT value FROM jsonb_array_elements(block->'topics') LOOP
      topic_order := topic_order + 1;
      IF nullif(btrim(topic->>'text'), '') IS NULL OR nullif(btrim(topic->>'name'), '') IS NULL THEN
        RAISE EXCEPTION 'Todos los temas necesitan nombre y contenido.';
      END IF;
      IF EXISTS (SELECT 1 FROM public.convocatoria_tema WHERE convocatoria_id = saved_id
        AND lower(regexp_replace(btrim(texto_oficial), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(topic->>'text'), '\s+', ' ', 'g'))) THEN
        RAISE EXCEPTION 'Hay contenidos repetidos en el temario.';
      END IF;
      IF topic->>'decision' = 'new' THEN
        INSERT INTO public.temas(nombre, descripcion) VALUES (btrim(topic->>'name'), topic->>'text') RETURNING id INTO topic_id;
      ELSIF topic->>'decision' = 'existing' THEN
        SELECT id INTO topic_id FROM public.temas WHERE id = (topic->>'topicId')::uuid;
        IF NOT FOUND THEN RAISE EXCEPTION 'El tema vinculado no existe.'; END IF;
      ELSE RAISE EXCEPTION 'Resuelve la reutilización de todos los temas.';
      END IF;
      INSERT INTO public.convocatoria_tema(convocatoria_id, bloque_id, tema_id, numero, orden, texto_oficial)
      VALUES (saved_id, block_id, topic_id, (topic->>'number')::integer, topic_order, topic->>'text');
    END LOOP;
  END LOOP;
  RETURN saved_id;
END $$;

REVOKE ALL ON FUNCTION public.guardar_bloques_convocatoria_admin(uuid, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirmar_importacion_bon_admin(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_bloques_convocatoria_admin(uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_importacion_bon_admin(uuid, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';

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
                  'blockId', b.id, 'blockName', b.nombre, 'blockOrder', b.orden,
                  'availableQuestions', (
                    SELECT count(DISTINCT p.id)::integer
                    FROM public.preguntas p
                    JOIN public.pregunta_tema pt ON pt.pregunta_id = p.id
                    WHERE pt.tema_id = t.id
                      AND p.estado = 'publicada'
                      AND p.situacion <> 'anulada'
                  )
                )
                ORDER BY b.orden, ct.orden
              )
              FROM public.convocatoria_tema ct
              JOIN public.convocatoria_bloques b ON b.id = ct.bloque_id
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

