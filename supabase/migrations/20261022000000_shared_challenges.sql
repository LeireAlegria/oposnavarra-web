CREATE TABLE public.retos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creador_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
  titulo text NOT NULL CHECK (length(btrim(titulo)) BETWEEN 1 AND 200),
  convocatoria_id uuid NOT NULL REFERENCES public.convocatorias(id) ON DELETE RESTRICT,
  numero_preguntas integer NOT NULL CHECK (numero_preguntas BETWEEN 1 AND 999),
  duracion_segundos integer CHECK (duracion_segundos IN (600,1200,1800,2700,3600)),
  participantes_totales integer NOT NULL CHECK (participantes_totales >= 2),
  penalizacion numeric(5,2) NOT NULL DEFAULT 0.33 CHECK (penalizacion BETWEEN 0 AND 1),
  token_invitacion text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  estado text NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto','cerrado')),
  creado_en timestamptz NOT NULL DEFAULT clock_timestamp(), cerrado_en timestamptz,
  motivo_cierre text CHECK (motivo_cierre IN ('automatico','manual')),
  CHECK ((estado = 'abierto' AND cerrado_en IS NULL AND motivo_cierre IS NULL) OR (estado = 'cerrado' AND cerrado_en IS NOT NULL AND motivo_cierre IS NOT NULL))
);
CREATE TABLE public.reto_temas (
  reto_id uuid NOT NULL REFERENCES public.retos(id) ON DELETE RESTRICT,
  tema_id uuid NOT NULL REFERENCES public.temas(id) ON DELETE RESTRICT,
  PRIMARY KEY(reto_id, tema_id)
);
CREATE TABLE public.reto_preguntas (
  reto_id uuid NOT NULL REFERENCES public.retos(id) ON DELETE RESTRICT,
  pregunta_id uuid NOT NULL REFERENCES public.preguntas(id) ON DELETE RESTRICT,
  orden integer NOT NULL CHECK (orden > 0), PRIMARY KEY(reto_id, pregunta_id), UNIQUE(reto_id, orden)
);
CREATE INDEX reto_preguntas_question_idx ON public.reto_preguntas(pregunta_id, reto_id);
ALTER TABLE public.test_intentos
  ADD COLUMN reto_id uuid REFERENCES public.retos(id) ON DELETE RESTRICT,
  ADD COLUMN motivo_entrega text CHECK (motivo_entrega IN ('voluntaria','tiempo_agotado','cierre_reto')),
  ADD COLUMN resultado_reto jsonb,
  ADD COLUMN correccion_reto jsonb;
CREATE UNIQUE INDEX test_intento_reto_usuario_key ON public.test_intentos(reto_id, usuario_id) WHERE reto_id IS NOT NULL;
CREATE TABLE public.reto_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reto_id uuid NOT NULL REFERENCES public.retos(id) ON DELETE RESTRICT,
  usuario_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
  nombre_visible text NOT NULL CHECK (length(btrim(nombre_visible)) BETWEEN 1 AND 80 AND position('@' IN nombre_visible) = 0),
  unido_en timestamptz NOT NULL DEFAULT clock_timestamp(),
  intento_id uuid UNIQUE REFERENCES public.test_intentos(id) ON DELETE RESTRICT,
  UNIQUE(reto_id, usuario_id)
);
CREATE INDEX reto_participantes_usuario_idx ON public.reto_participantes(usuario_id, reto_id);
ALTER TABLE public.retos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reto_temas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reto_preguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reto_participantes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.retos, public.reto_temas, public.reto_preguntas, public.reto_participantes FROM anon, authenticated;

-- Keep the existing correction engine; only add challenge locking and publication boundaries.
ALTER FUNCTION private.resultado_test(uuid) RENAME TO resultado_test_base;
ALTER FUNCTION private.resumen_test(uuid) RENAME TO resumen_test_base;
ALTER FUNCTION private.finalizar_test(uuid, uuid) RENAME TO finalizar_test_base;

CREATE FUNCTION private.resultado_test(p_test_intento_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(t.resultado_reto, private.resultado_test_base(t.id)) FROM public.test_intentos t WHERE t.id = p_test_intento_id;
$$;

CREATE FUNCTION private.resumen_test(p_test_intento_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE result jsonb; challenge public.retos%ROWTYPE;
BEGIN
  result := private.resumen_test_base(p_test_intento_id);
  SELECT r.* INTO challenge FROM public.retos r JOIN public.test_intentos t ON t.reto_id = r.id WHERE t.id = p_test_intento_id;
  IF FOUND THEN
    result := result || jsonb_build_object('challengeId', challenge.id, 'challengeTitle', challenge.titulo, 'challengeClosed', challenge.estado = 'cerrado');
    IF challenge.estado = 'abierto' THEN result := result || jsonb_build_object('result', NULL); END IF;
  END IF;
  RETURN result;
END $$;

-- Adapt only the clock in the original finalizer, keeping scoring and answer handling intact.
DO $$ DECLARE definition text; BEGIN
  definition := replace(pg_get_functiondef('private.finalizar_test_base(uuid,uuid)'::regprocedure), E'\r\n', E'\n');
  definition := replace(definition, 'v_finalizado_en := CASE', 'v_finalizado_en := CASE WHEN v_intento.reto_id IS NOT NULL THEN least(clock_timestamp(), coalesce(v_intento.expira_en, ''infinity''::timestamptz), coalesce((SELECT cerrado_en FROM public.retos WHERE id = v_intento.reto_id), ''infinity''::timestamptz)) ELSE CASE');
  definition := replace(definition, E'ELSE now()\n  END;', E'ELSE now()\n  END END;');
  IF position('END END;' IN definition) = 0 THEN RAISE EXCEPTION 'Revisa la adaptación del finalizador existente.'; END IF;
  EXECUTE definition;
END $$;

CREATE FUNCTION private.finalizar_test(p_test_intento_id uuid, p_usuario_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE challenge_id uuid; attempt public.test_intentos%ROWTYPE; challenge public.retos%ROWTYPE;
BEGIN
  SELECT reto_id INTO challenge_id FROM public.test_intentos WHERE id = p_test_intento_id AND usuario_id = p_usuario_id;
  IF challenge_id IS NOT NULL THEN SELECT * INTO challenge FROM public.retos WHERE id = challenge_id FOR UPDATE; END IF;
  PERFORM private.finalizar_test_base(p_test_intento_id, p_usuario_id);
  IF challenge_id IS NOT NULL THEN
    SELECT * INTO attempt FROM public.test_intentos WHERE id = p_test_intento_id AND usuario_id = p_usuario_id;
    IF attempt.estado = 'finalizado' AND attempt.resultado_reto IS NULL THEN
      UPDATE public.test_intentos SET resultado_reto = private.resultado_test_base(id), motivo_entrega = CASE
        WHEN expira_en IS NOT NULL AND finalizado_en >= expira_en THEN 'tiempo_agotado'
        WHEN challenge.motivo_cierre = 'manual' THEN 'cierre_reto' ELSE 'voluntaria' END WHERE id = attempt.id;
    END IF;
  END IF;
END $$;

CREATE FUNCTION private.capturar_correccion_reto(p_intento_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'order', tip.orden, 'text', p.enunciado,
    'selectedAnswerId', tip.respuesta_seleccionada_id, 'status', tip.resultado, 'topics', '[]'::jsonb,
    'options', (SELECT jsonb_agg(jsonb_build_object('id', a.id, 'text', a.texto, 'order', a.orden, 'isCorrect', a.es_correcta) ORDER BY a.orden) FROM public.respuestas a WHERE a.pregunta_id = p.id)
  ) ORDER BY tip.orden), '[]'::jsonb) FROM public.test_intento_preguntas tip JOIN public.preguntas p ON p.id = tip.pregunta_id WHERE tip.test_intento_id = p_intento_id;
$$;

CREATE FUNCTION private.cerrar_reto(p_reto_id uuid, p_motivo text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE challenge public.retos%ROWTYPE; participant record;
BEGIN
  SELECT * INTO challenge FROM public.retos WHERE id = p_reto_id FOR UPDATE;
  IF NOT FOUND OR challenge.estado = 'cerrado' THEN RETURN; END IF;
  UPDATE public.retos SET estado = 'cerrado', cerrado_en = clock_timestamp(), motivo_cierre = p_motivo WHERE id = p_reto_id;
  PERFORM 1 FROM public.preguntas p JOIN public.reto_preguntas rp ON rp.pregunta_id = p.id WHERE rp.reto_id = p_reto_id ORDER BY p.id FOR SHARE OF p;
  FOR participant IN SELECT usuario_id, intento_id FROM public.reto_participantes WHERE reto_id = p_reto_id AND intento_id IS NOT NULL ORDER BY intento_id LOOP
    PERFORM private.finalizar_test(participant.intento_id, participant.usuario_id);
    UPDATE public.test_intentos SET correccion_reto = private.capturar_correccion_reto(id) WHERE id = participant.intento_id;
  END LOOP;
END $$;

CREATE FUNCTION private.actualizar_reto(p_reto_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE challenge public.retos%ROWTYPE; attempt record;
BEGIN
  SELECT * INTO challenge FROM public.retos WHERE id = p_reto_id FOR UPDATE;
  IF NOT FOUND OR challenge.estado = 'cerrado' THEN RETURN; END IF;
  FOR attempt IN SELECT id, usuario_id FROM public.test_intentos WHERE reto_id = p_reto_id AND estado = 'en_curso' AND expira_en <= clock_timestamp() ORDER BY id LOOP
    PERFORM private.finalizar_test(attempt.id, attempt.usuario_id);
  END LOOP;
  IF (SELECT count(*) FROM public.reto_participantes WHERE reto_id = p_reto_id) = challenge.participantes_totales
    AND NOT EXISTS (SELECT 1 FROM public.reto_participantes rp LEFT JOIN public.test_intentos ti ON ti.id = rp.intento_id WHERE rp.reto_id = p_reto_id AND (ti.id IS NULL OR ti.estado <> 'finalizado')) THEN
    PERFORM private.cerrar_reto(p_reto_id, 'automatico');
  END IF;
END $$;

CREATE FUNCTION private.exigir_acceso_reto() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$ BEGIN
  IF auth.uid() IS NULL OR NOT public.comprobar_acceso_suscripcion(auth.uid())
    OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Necesitas iniciar sesión, confirmar tu correo y tener una suscripción activa.' USING ERRCODE = '42501';
  END IF;
END $$;

CREATE FUNCTION public.crear_reto(p_titulo text, p_convocatoria_id uuid, p_temas uuid[], p_numero_preguntas integer, p_duracion_segundos integer, p_participantes integer, p_nombre_visible text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE challenge_id uuid; available integer; selected_ids uuid[];
BEGIN
  PERFORM private.exigir_acceso_reto();
  IF p_nombre_visible IS NULL OR length(btrim(p_nombre_visible)) NOT BETWEEN 1 AND 80 OR position('@' IN p_nombre_visible) > 0 THEN
    RAISE EXCEPTION 'Escribe un nombre visible de 1 a 80 caracteres, sin correo electrónico.' USING ERRCODE = '22023'; END IF;
  IF p_titulo IS NULL OR length(btrim(p_titulo)) NOT BETWEEN 1 AND 200 OR p_numero_preguntas IS NULL OR p_numero_preguntas NOT BETWEEN 1 AND 999
    OR p_participantes IS NULL OR p_participantes < 2 OR (p_duracion_segundos IS NOT NULL AND p_duracion_segundos NOT IN (600,1200,1800,2700,3600)) THEN
    RAISE EXCEPTION 'Revisa el título, las preguntas, el tiempo y las plazas del reto.' USING ERRCODE = '22023'; END IF;
  available := public.contar_preguntas_test(p_convocatoria_id, p_temas);
  IF available < p_numero_preguntas THEN RAISE EXCEPTION 'No hay suficientes preguntas para crear el reto.' USING ERRCODE = '22023'; END IF;
  SELECT array_agg(id ORDER BY ordinal) INTO selected_ids FROM (
    SELECT id, row_number() OVER () AS ordinal FROM (
      SELECT DISTINCT p.id FROM public.preguntas p JOIN public.pregunta_tema pt ON pt.pregunta_id = p.id
      JOIN public.convocatoria_tema ct ON ct.tema_id = pt.tema_id
      WHERE ct.convocatoria_id = p_convocatoria_id AND pt.tema_id = ANY(p_temas) AND p.estado = 'publicada' AND p.situacion <> 'anulada'
    ) eligible ORDER BY random() LIMIT p_numero_preguntas
  ) selection;
  PERFORM 1 FROM public.preguntas WHERE id = ANY(selected_ids) ORDER BY id FOR SHARE;
  IF cardinality(selected_ids) <> p_numero_preguntas OR EXISTS (SELECT 1 FROM public.preguntas p WHERE id = ANY(selected_ids) AND (estado <> 'publicada' OR situacion = 'anulada'
    OR (SELECT count(*) FROM public.respuestas a WHERE a.pregunta_id = p.id) <> 4 OR (SELECT count(*) FROM public.respuestas a WHERE a.pregunta_id = p.id AND es_correcta) <> 1)) THEN
    RAISE EXCEPTION 'El banco ha cambiado. Vuelve a configurar el reto.' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.retos(creador_id, titulo, convocatoria_id, numero_preguntas, duracion_segundos, participantes_totales)
    VALUES(auth.uid(), btrim(p_titulo), p_convocatoria_id, p_numero_preguntas, p_duracion_segundos, p_participantes) RETURNING id INTO challenge_id;
  INSERT INTO public.reto_temas SELECT challenge_id, unnest(p_temas);
  INSERT INTO public.reto_preguntas SELECT challenge_id, id, ordinal::integer FROM unnest(selected_ids) WITH ORDINALITY AS q(id, ordinal);
  INSERT INTO public.reto_participantes(reto_id, usuario_id, nombre_visible) VALUES(challenge_id, auth.uid(), btrim(p_nombre_visible));
  RETURN challenge_id;
END $$;

CREATE FUNCTION public.unirse_reto(p_token text, p_nombre_visible text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE challenge public.retos%ROWTYPE;
BEGIN
  PERFORM private.exigir_acceso_reto();
  IF p_nombre_visible IS NULL OR length(btrim(p_nombre_visible)) NOT BETWEEN 1 AND 80 OR position('@' IN p_nombre_visible) > 0 THEN
    RAISE EXCEPTION 'Escribe un nombre visible de 1 a 80 caracteres, sin correo electrónico.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO challenge FROM public.retos WHERE token_invitacion = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La invitación no existe.' USING ERRCODE = '22023'; END IF;
  PERFORM private.actualizar_reto(challenge.id);
  IF EXISTS (SELECT 1 FROM public.reto_participantes WHERE reto_id = challenge.id AND usuario_id = auth.uid()) THEN RETURN challenge.id; END IF;
  IF (SELECT estado FROM public.retos WHERE id = challenge.id) <> 'abierto' THEN RAISE EXCEPTION 'El reto ya está cerrado.' USING ERRCODE = '22023'; END IF;
  IF (SELECT count(*) FROM public.reto_participantes WHERE reto_id = challenge.id) >= challenge.participantes_totales THEN RAISE EXCEPTION 'El reto ya no tiene plazas disponibles.' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.reto_participantes(reto_id, usuario_id, nombre_visible) VALUES(challenge.id, auth.uid(), btrim(p_nombre_visible));
  RETURN challenge.id;
END $$;

CREATE FUNCTION public.comenzar_reto(p_reto_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE challenge public.retos%ROWTYPE; participant public.reto_participantes%ROWTYPE; attempt_id uuid; start_time timestamptz;
BEGIN
  SELECT * INTO challenge FROM public.retos WHERE id = p_reto_id FOR UPDATE;
  SELECT * INTO participant FROM public.reto_participantes WHERE reto_id = p_reto_id AND usuario_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'No participas en este reto.' USING ERRCODE = '42501'; END IF;
  PERFORM private.actualizar_reto(p_reto_id);
  IF participant.intento_id IS NOT NULL THEN RETURN participant.intento_id; END IF;
  PERFORM private.exigir_acceso_reto();
  IF (SELECT estado FROM public.retos WHERE id = p_reto_id) <> 'abierto' THEN RAISE EXCEPTION 'El reto está cerrado; ya no puedes comenzar.' USING ERRCODE = '22023'; END IF;
  IF (SELECT count(*) FROM public.reto_preguntas WHERE reto_id = p_reto_id) <> challenge.numero_preguntas
    OR EXISTS (SELECT 1 FROM public.reto_preguntas rp WHERE reto_id = p_reto_id AND (SELECT count(*) FROM public.respuestas a WHERE a.pregunta_id = rp.pregunta_id) <> 4) THEN
    RAISE EXCEPTION 'No se puede recuperar el examen completo del reto.' USING ERRCODE = '23514'; END IF;
  start_time := clock_timestamp();
  INSERT INTO public.test_intentos(usuario_id, convocatoria_id, estado, numero_preguntas, tiempo_limite_segundos, iniciado_en, expira_en, penalizacion_aplicada, reto_id)
    VALUES(auth.uid(), challenge.convocatoria_id, 'en_curso', challenge.numero_preguntas, challenge.duracion_segundos, start_time,
      CASE WHEN challenge.duracion_segundos IS NOT NULL THEN start_time + make_interval(secs => challenge.duracion_segundos) END, challenge.penalizacion, p_reto_id) RETURNING id INTO attempt_id;
  INSERT INTO public.test_intento_temas SELECT attempt_id, tema_id FROM public.reto_temas WHERE reto_id = p_reto_id;
  INSERT INTO public.test_intento_preguntas(test_intento_id, pregunta_id, orden) SELECT attempt_id, pregunta_id, orden FROM public.reto_preguntas WHERE reto_id = p_reto_id ORDER BY orden;
  UPDATE public.reto_participantes SET intento_id = attempt_id WHERE id = participant.id;
  RETURN attempt_id;
END $$;

-- Presentation exposes no participant progress, counts or scores while a challenge is open.
CREATE FUNCTION private.resumen_reto(p_reto_id uuid, p_invitacion boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE challenge public.retos%ROWTYPE; participant public.reto_participantes%ROWTYPE; result jsonb; ranking jsonb;
BEGIN
  SELECT * INTO challenge FROM public.retos WHERE id = p_reto_id;
  SELECT * INTO participant FROM public.reto_participantes WHERE reto_id = p_reto_id AND usuario_id = auth.uid();
  IF NOT p_invitacion AND participant.id IS NULL THEN RAISE EXCEPTION 'No participas en este reto.' USING ERRCODE = '42501'; END IF;
  result := jsonb_build_object('id', challenge.id, 'title', challenge.titulo, 'status', challenge.estado,
    'creatorName', (SELECT nombre_visible FROM public.reto_participantes WHERE reto_id = challenge.id AND usuario_id = challenge.creador_id),
    'convocationName', (SELECT nombre FROM public.convocatorias WHERE id = challenge.convocatoria_id),
    'topics', coalesce((SELECT jsonb_agg(t.nombre ORDER BY b.orden, ct.orden) FROM public.reto_temas rt JOIN public.temas t ON t.id = rt.tema_id JOIN public.convocatoria_tema ct ON ct.convocatoria_id = challenge.convocatoria_id AND ct.tema_id = t.id JOIN public.convocatoria_bloques b ON b.id = ct.bloque_id WHERE rt.reto_id = challenge.id), '[]'::jsonb),
    'questionCount', challenge.numero_preguntas, 'durationSeconds', challenge.duracion_segundos,
    'canJoin', challenge.estado = 'abierto' AND (SELECT count(*) FROM public.reto_participantes WHERE reto_id = challenge.id) < challenge.participantes_totales,
    'isParticipant', participant.id IS NOT NULL, 'isCreator', challenge.creador_id = auth.uid(),
    'attemptId', participant.intento_id, 'attemptStatus', (SELECT estado FROM public.test_intentos WHERE id = participant.intento_id),
    'closedReason', challenge.motivo_cierre, 'closedAt', challenge.cerrado_en);
  IF challenge.creador_id = auth.uid() THEN result := result || jsonb_build_object('invitationToken', challenge.token_invitacion); END IF;
  IF challenge.estado = 'cerrado' AND participant.id IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(entry ORDER BY position NULLS LAST, joined_at), '[]'::jsonb) INTO ranking FROM (
      SELECT rp.unido_en AS joined_at, CASE WHEN ti.id IS NOT NULL THEN rank() OVER (ORDER BY ti.nota DESC NULLS LAST, ti.tiempo_empleado_segundos ASC NULLS LAST) END AS position,
        jsonb_build_object('name', rp.nombre_visible, 'isMe', rp.usuario_id = auth.uid(), 'position', CASE WHEN ti.id IS NOT NULL THEN rank() OVER (ORDER BY ti.nota DESC NULLS LAST, ti.tiempo_empleado_segundos ASC NULLS LAST) END,
          'score', ti.nota, 'correct', ti.aciertos, 'incorrect', ti.fallos, 'blank', ti.en_blanco, 'seconds', ti.tiempo_empleado_segundos,
          'deliveryReason', ti.motivo_entrega, 'notStarted', ti.id IS NULL) AS entry
      FROM public.reto_participantes rp LEFT JOIN public.test_intentos ti ON ti.id = rp.intento_id WHERE rp.reto_id = p_reto_id
    ) positions;
    result := result || jsonb_build_object('ranking', ranking);
  END IF;
  RETURN result;
END $$;

CREATE FUNCTION public.consultar_reto(p_reto_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.reto_participantes WHERE reto_id = p_reto_id AND usuario_id = auth.uid()) THEN RAISE EXCEPTION 'No participas en este reto.' USING ERRCODE = '42501'; END IF;
  PERFORM private.actualizar_reto(p_reto_id);
  RETURN private.resumen_reto(p_reto_id);
END $$;

CREATE FUNCTION public.consultar_invitacion_reto(p_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE challenge_id uuid;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'La invitación no existe.' USING ERRCODE = '22023'; END IF;
  SELECT id INTO challenge_id FROM public.retos WHERE token_invitacion = p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'La invitación no existe.' USING ERRCODE = '22023'; END IF;
  PERFORM private.actualizar_reto(challenge_id);
  RETURN private.resumen_reto(challenge_id, true);
END $$;

CREATE FUNCTION public.listar_mis_retos() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE challenge_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión para consultar tus retos.' USING ERRCODE = '42501'; END IF;
  FOR challenge_id IN SELECT reto_id FROM public.reto_participantes WHERE usuario_id = auth.uid() ORDER BY reto_id LOOP PERFORM private.actualizar_reto(challenge_id); END LOOP;
  -- Invitation tokens are only returned in a creator's detail, never in general lists.
  RETURN coalesce((SELECT jsonb_agg((private.resumen_reto(r.id) - 'invitationToken' - 'ranking') ORDER BY r.creado_en DESC) FROM public.retos r JOIN public.reto_participantes rp ON rp.reto_id = r.id WHERE rp.usuario_id = auth.uid()), '[]'::jsonb);
END $$;

CREATE FUNCTION public.cerrar_reto(p_reto_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.retos WHERE id = p_reto_id AND creador_id = auth.uid()) THEN RAISE EXCEPTION 'Solo el creador puede cerrar este reto.' USING ERRCODE = '42501'; END IF;
  PERFORM private.cerrar_reto(p_reto_id, 'manual');
  RETURN private.resumen_reto(p_reto_id);
END $$;

-- The public test API keeps its signatures. Its private base cannot be called through REST.
ALTER FUNCTION public.guardar_respuesta_test(uuid,uuid,uuid) RENAME TO guardar_respuesta_test_base;
ALTER FUNCTION public.guardar_respuesta_test_base(uuid,uuid,uuid) SET SCHEMA private;
ALTER FUNCTION public.finalizar_intento_test(uuid) RENAME TO finalizar_intento_test_base;
ALTER FUNCTION public.finalizar_intento_test_base(uuid) SET SCHEMA private;
ALTER FUNCTION public.consultar_intento_test(uuid) RENAME TO consultar_intento_test_base;
ALTER FUNCTION public.consultar_intento_test_base(uuid) SET SCHEMA private;

DO $$ DECLARE signature text; definition text; BEGIN
  FOREACH signature IN ARRAY ARRAY['private.guardar_respuesta_test_base(uuid,uuid,uuid)', 'private.finalizar_intento_test_base(uuid)', 'private.consultar_intento_test_base(uuid)'] LOOP
    definition := pg_get_functiondef(signature::regprocedure);
    definition := replace(definition, 'IF NOT public.comprobar_acceso_suscripcion(v_usuario_id)', 'IF v_intento.reto_id IS NULL AND NOT public.comprobar_acceso_suscripcion(v_usuario_id)');
    -- Database wall clock is authoritative after acquiring the challenge lock.
    definition := replace(definition, 'now()', 'clock_timestamp()');
    EXECUTE definition;
  END LOOP;
END $$;

CREATE FUNCTION private.bloquear_reto_intento(p_intento_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE challenge_id uuid;
BEGIN
  SELECT reto_id INTO challenge_id FROM public.test_intentos WHERE id = p_intento_id AND usuario_id = auth.uid();
  IF challenge_id IS NOT NULL THEN
    PERFORM 1 FROM public.retos WHERE id = challenge_id FOR UPDATE;
    PERFORM private.actualizar_reto(challenge_id);
  END IF;
  RETURN challenge_id;
END $$;

CREATE FUNCTION public.guardar_respuesta_test(p_test_intento_id uuid, p_pregunta_id uuid, p_respuesta_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE challenge_id uuid; saved boolean;
BEGIN
  challenge_id := private.bloquear_reto_intento(p_test_intento_id);
  IF challenge_id IS NOT NULL AND (SELECT estado FROM public.retos WHERE id = challenge_id) = 'cerrado' THEN RETURN false; END IF;
  saved := private.guardar_respuesta_test_base(p_test_intento_id, p_pregunta_id, p_respuesta_id);
  IF challenge_id IS NOT NULL THEN PERFORM private.actualizar_reto(challenge_id); END IF;
  RETURN saved;
END $$;

CREATE FUNCTION public.finalizar_intento_test(p_test_intento_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE challenge_id uuid;
BEGIN
  challenge_id := private.bloquear_reto_intento(p_test_intento_id);
  PERFORM private.finalizar_intento_test_base(p_test_intento_id);
  IF challenge_id IS NOT NULL THEN PERFORM private.actualizar_reto(challenge_id); END IF;
  RETURN private.resumen_test(p_test_intento_id);
END $$;

CREATE FUNCTION public.consultar_intento_test(p_test_intento_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE challenge_id uuid; result jsonb; attempt public.test_intentos%ROWTYPE;
BEGIN
  challenge_id := private.bloquear_reto_intento(p_test_intento_id);
  IF challenge_id IS NULL THEN RETURN private.consultar_intento_test_base(p_test_intento_id); END IF;
  SELECT * INTO attempt FROM public.test_intentos WHERE id = p_test_intento_id AND usuario_id = auth.uid();
  IF (SELECT estado FROM public.retos WHERE id = challenge_id) = 'cerrado' THEN
    RETURN private.resumen_test(p_test_intento_id) || jsonb_build_object('questions', attempt.correccion_reto);
  END IF;
  IF attempt.estado = 'finalizado' THEN RETURN private.resumen_test(p_test_intento_id) || jsonb_build_object('questions', '[]'::jsonb); END IF;
  result := private.consultar_intento_test_base(p_test_intento_id);
  IF (result->>'status') = 'finalized' THEN
    PERFORM private.actualizar_reto(challenge_id);
    RETURN public.consultar_intento_test(p_test_intento_id);
  END IF;
  RETURN result;
END $$;

-- Protect content while any referring challenge is open. Historical snapshots permit later edits.
CREATE FUNCTION private.proteger_pregunta_reto() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE question_id uuid; next_question_id uuid; changed boolean := true;
BEGIN
  IF TG_TABLE_NAME = 'preguntas' THEN
    question_id := OLD.id;
    IF TG_OP = 'UPDATE' THEN changed := NEW.enunciado IS DISTINCT FROM OLD.enunciado; END IF;
  ELSE
    question_id := CASE WHEN TG_OP = 'INSERT' THEN NEW.pregunta_id ELSE OLD.pregunta_id END;
    IF TG_OP <> 'DELETE' THEN next_question_id := NEW.pregunta_id; END IF;
  END IF;
  PERFORM 1 FROM public.preguntas WHERE id IN (question_id, next_question_id) ORDER BY id FOR UPDATE;
  IF changed AND EXISTS (SELECT 1 FROM public.reto_preguntas rp JOIN public.retos r ON r.id = rp.reto_id WHERE rp.pregunta_id IN (question_id, next_question_id) AND r.estado = 'abierto') THEN
    RAISE EXCEPTION 'Esta pregunta pertenece a un reto abierto. Crea otra pregunta para modificar su contenido o sus respuestas.' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER preguntas_retos_protected BEFORE UPDATE OR DELETE ON public.preguntas FOR EACH ROW EXECUTE FUNCTION private.proteger_pregunta_reto();
CREATE TRIGGER respuestas_retos_protected BEFORE INSERT OR UPDATE OR DELETE ON public.respuestas FOR EACH ROW EXECUTE FUNCTION private.proteger_pregunta_reto();

CREATE FUNCTION private.resolver_retos_vencidos() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE challenge_id uuid;
BEGIN
  FOR challenge_id IN SELECT r.id FROM public.retos r WHERE r.estado = 'abierto' AND EXISTS (SELECT 1 FROM public.test_intentos ti WHERE ti.reto_id = r.id AND ti.estado = 'en_curso' AND ti.expira_en <= clock_timestamp()) ORDER BY r.id FOR UPDATE SKIP LOCKED LOOP
    PERFORM private.actualizar_reto(challenge_id);
  END LOOP;
END $$;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
SELECT cron.schedule('oposnavarra-retos-vencidos', '* * * * *', 'SELECT private.resolver_retos_vencidos();');

REVOKE ALL ON FUNCTION private.resultado_test(uuid), private.resultado_test_base(uuid), private.resumen_test(uuid), private.resumen_test_base(uuid), private.finalizar_test(uuid,uuid), private.finalizar_test_base(uuid,uuid), private.capturar_correccion_reto(uuid), private.cerrar_reto(uuid,text), private.actualizar_reto(uuid), private.exigir_acceso_reto(), private.resumen_reto(uuid,boolean), private.bloquear_reto_intento(uuid), private.proteger_pregunta_reto(), private.resolver_retos_vencidos(), private.guardar_respuesta_test_base(uuid,uuid,uuid), private.finalizar_intento_test_base(uuid), private.consultar_intento_test_base(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crear_reto(text,uuid,uuid[],integer,integer,integer,text), public.unirse_reto(text,text), public.comenzar_reto(uuid), public.consultar_reto(uuid), public.listar_mis_retos(), public.cerrar_reto(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.consultar_invitacion_reto(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guardar_respuesta_test(uuid,uuid,uuid), public.finalizar_intento_test(uuid), public.consultar_intento_test(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_reto(text,uuid,uuid[],integer,integer,integer,text), public.unirse_reto(text,text), public.comenzar_reto(uuid), public.consultar_reto(uuid), public.listar_mis_retos(), public.cerrar_reto(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consultar_invitacion_reto(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_respuesta_test(uuid,uuid,uuid), public.finalizar_intento_test(uuid), public.consultar_intento_test(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';

