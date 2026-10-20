CREATE TABLE IF NOT EXISTS public.test_intentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  convocatoria_id uuid NOT NULL REFERENCES public.convocatorias (id) ON DELETE RESTRICT,
  estado text NOT NULL CHECK (estado IN ('en_curso', 'finalizado')),
  numero_preguntas integer NOT NULL CHECK (numero_preguntas > 0),
  tiempo_limite_segundos integer CHECK (tiempo_limite_segundos IS NULL OR tiempo_limite_segundos > 0),
  iniciado_en timestamptz NOT NULL DEFAULT now(),
  expira_en timestamptz,
  finalizado_en timestamptz,
  tiempo_empleado_segundos integer CHECK (tiempo_empleado_segundos IS NULL OR tiempo_empleado_segundos >= 0),
  aciertos integer CHECK (aciertos IS NULL OR aciertos >= 0),
  fallos integer CHECK (fallos IS NULL OR fallos >= 0),
  en_blanco integer CHECK (en_blanco IS NULL OR en_blanco >= 0),
  puntuacion_neta numeric(5,2) CHECK (puntuacion_neta IS NULL OR puntuacion_neta >= -9999.99),
  nota numeric(5,2) CHECK (nota IS NULL OR (nota >= 0 AND nota <= 10)),
  porcentaje_aciertos numeric(5,2) CHECK (porcentaje_aciertos IS NULL OR (porcentaje_aciertos >= 0 AND porcentaje_aciertos <= 100)),
  penalizacion_aplicada numeric(5,2) CHECK (penalizacion_aplicada IS NULL OR penalizacion_aplicada >= 0),
  CHECK (
    (
      estado = 'finalizado'
      AND finalizado_en IS NOT NULL
      AND aciertos IS NOT NULL
      AND fallos IS NOT NULL
      AND en_blanco IS NOT NULL
      AND puntuacion_neta IS NOT NULL
      AND nota IS NOT NULL
      AND porcentaje_aciertos IS NOT NULL
      AND penalizacion_aplicada IS NOT NULL
    )
    OR estado = 'en_curso'
  )
);

CREATE TABLE IF NOT EXISTS public.test_intento_temas (
  test_intento_id uuid NOT NULL REFERENCES public.test_intentos (id) ON DELETE CASCADE,
  tema_id uuid NOT NULL REFERENCES public.temas (id) ON DELETE RESTRICT,
  PRIMARY KEY (test_intento_id, tema_id)
);


ALTER TABLE public.respuestas
ADD CONSTRAINT respuestas_id_pregunta_id_unique
UNIQUE (id, pregunta_id);

CREATE TABLE IF NOT EXISTS public.test_intento_preguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  test_intento_id uuid NOT NULL
    REFERENCES public.test_intentos (id)
    ON DELETE CASCADE,

  pregunta_id uuid NOT NULL
    REFERENCES public.preguntas (id)
    ON DELETE RESTRICT,

  orden integer NOT NULL
    CHECK (orden > 0),

  respuesta_seleccionada_id uuid,

  resultado text
    CHECK (resultado IN ('correcta', 'incorrecta', 'en_blanco')),

  UNIQUE (test_intento_id, pregunta_id),

  UNIQUE (test_intento_id, orden),

  CONSTRAINT test_intento_preguntas_respuesta_pertenece_a_pregunta
    FOREIGN KEY (respuesta_seleccionada_id, pregunta_id)
    REFERENCES public.respuestas (id, pregunta_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS test_intentos_usuario_idx
ON public.test_intentos (usuario_id, iniciado_en DESC);

CREATE INDEX IF NOT EXISTS test_intentos_estado_idx
ON public.test_intentos (estado, usuario_id);

CREATE INDEX IF NOT EXISTS test_intentos_historial_idx
ON public.test_intentos (usuario_id, finalizado_en DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS test_intento_temas_tema_idx
ON public.test_intento_temas (tema_id);

CREATE INDEX IF NOT EXISTS test_intento_preguntas_intento_idx
ON public.test_intento_preguntas (test_intento_id, orden);

ALTER TABLE public.test_intentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_intento_temas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_intento_preguntas ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.comprobar_acceso_test()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.comprobar_acceso_suscripcion(auth.uid());
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
  current_user_id uuid := auth.uid();
  v_test_intento public.test_intentos%ROWTYPE;
  v_tema_id uuid;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Debe iniciar sesión para crear un test.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.comprobar_acceso_suscripcion(current_user_id) THEN
    RAISE EXCEPTION 'No tienes una suscripción activa para realizar tests.' USING ERRCODE = '42501';
  END IF;

  IF p_numero_preguntas <= 0 THEN
    RAISE EXCEPTION 'El número de preguntas debe ser positivo.' USING ERRCODE = '23514';
  END IF;

  IF p_tiempo_limite_segundos IS NOT NULL AND p_tiempo_limite_segundos <= 0 THEN
    RAISE EXCEPTION 'El tiempo límite debe ser positivo cuando exista.' USING ERRCODE = '23514';
  END IF;

  IF COALESCE(array_length(p_temas_seleccionados, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Debes seleccionar al menos un tema para iniciar el test.' USING ERRCODE = '23514';
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
    current_user_id,
    p_convocatoria_id,
    'en_curso',
    p_numero_preguntas,
    p_tiempo_limite_segundos,
    now(),
    CASE
      WHEN p_tiempo_limite_segundos IS NOT NULL THEN now() + make_interval(secs => p_tiempo_limite_segundos)
      ELSE NULL
    END
  )
  RETURNING * INTO v_test_intento;

  FOREACH v_tema_id IN ARRAY p_temas_seleccionados
  LOOP
    INSERT INTO public.test_intento_temas (test_intento_id, tema_id)
    VALUES (v_test_intento.id, v_tema_id);
  END LOOP;

  RETURN v_test_intento;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalizar_intento_test(
  p_test_intento_id uuid,
  p_tiempo_empleado_segundos integer,
  p_aciertos integer,
  p_fallos integer,
  p_en_blanco integer,
  p_puntuacion_neta numeric,
  p_nota numeric,
  p_porcentaje_aciertos numeric,
  p_penalizacion_aplicada numeric
)
RETURNS public.test_intentos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  v_test_intento public.test_intentos%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Debe iniciar sesión para finalizar un test.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_test_intento
  FROM public.test_intentos
  WHERE id = p_test_intento_id
    AND usuario_id = current_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe un intento de test asociado a este usuario.' USING ERRCODE = '23505';
  END IF;

  IF v_test_intento.estado = 'finalizado' THEN
    RETURN v_test_intento;
  END IF;

  UPDATE public.test_intentos
  SET
    estado = 'finalizado',
    finalizado_en = now(),
    tiempo_empleado_segundos = p_tiempo_empleado_segundos,
    aciertos = p_aciertos,
    fallos = p_fallos,
    en_blanco = p_en_blanco,
    puntuacion_neta = p_puntuacion_neta,
    nota = p_nota,
    porcentaje_aciertos = p_porcentaje_aciertos,
    penalizacion_aplicada = p_penalizacion_aplicada
  WHERE id = p_test_intento_id
  RETURNING * INTO v_test_intento;

  RETURN v_test_intento;
END;
$$;

CREATE POLICY "Los usuarios solo consultan sus intentos"
ON public.test_intentos
FOR SELECT
USING (auth.uid() = usuario_id);

CREATE POLICY "Los usuarios pueden crear intentos activos"
ON public.test_intentos
FOR INSERT
WITH CHECK (
  auth.uid() = usuario_id
  AND public.comprobar_acceso_suscripcion(auth.uid())
);

CREATE POLICY "Los usuarios solo pueden actualizar sus intentos en curso"
ON public.test_intentos
FOR UPDATE
USING (auth.uid() = usuario_id AND estado = 'en_curso')
WITH CHECK (auth.uid() = usuario_id AND estado = 'en_curso');

CREATE POLICY "Los usuarios no eliminan intentos"
ON public.test_intentos
FOR DELETE
USING (false);

CREATE POLICY "Los usuarios solo consultan temas de sus intentos"
ON public.test_intento_temas
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.test_intentos ti
    WHERE ti.id = test_intento_temas.test_intento_id
      AND ti.usuario_id = auth.uid()
  )
);

CREATE POLICY "Los usuarios solo gestionan temas de sus intentos"
ON public.test_intento_temas
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.test_intentos ti
    WHERE ti.id = test_intento_temas.test_intento_id
      AND ti.usuario_id = auth.uid()
      AND ti.estado = 'en_curso'
  )
);

CREATE POLICY "Los usuarios no eliminan temas de un intento"
ON public.test_intento_temas
FOR DELETE
USING (false);

CREATE POLICY "Los usuarios solo consultan sus preguntas de intento"
ON public.test_intento_preguntas
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.test_intentos ti
    WHERE ti.id = test_intento_preguntas.test_intento_id
      AND ti.usuario_id = auth.uid()
  )
);

CREATE POLICY "Los usuarios actualizan solo sus respuestas en curso"
ON public.test_intento_preguntas
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.test_intentos ti
    WHERE ti.id = test_intento_preguntas.test_intento_id
      AND ti.usuario_id = auth.uid()
      AND ti.estado = 'en_curso'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.test_intentos ti
    WHERE ti.id = test_intento_preguntas.test_intento_id
      AND ti.usuario_id = auth.uid()
      AND ti.estado = 'en_curso'
  )
);

CREATE POLICY "Los usuarios no crean preguntas de intento desde el cliente"
ON public.test_intento_preguntas
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Los usuarios no eliminan preguntas de intento"
ON public.test_intento_preguntas
FOR DELETE
USING (false);
