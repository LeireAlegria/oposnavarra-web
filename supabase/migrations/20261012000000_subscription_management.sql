CREATE TABLE IF NOT EXISTS public.planes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nombre text NOT NULL,
  precio_centimos integer NOT NULL CHECK (precio_centimos > 0),
  moneda text NOT NULL DEFAULT 'EUR' CHECK (moneda = 'EUR'),
  duracion_meses integer NOT NULL CHECK (duracion_meses IN (1, 6, 12)),
  activo boolean NOT NULL DEFAULT true,
  orden integer NOT NULL CHECK (orden > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.suscripciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.planes (id) ON DELETE RESTRICT,
  estado text NOT NULL CHECK (estado IN ('pendiente', 'activa', 'vencida', 'cancelada')),
  precio_centimos integer NOT NULL CHECK (precio_centimos > 0),
  moneda text NOT NULL DEFAULT 'EUR' CHECK (moneda = 'EUR'),
  duracion_meses integer NOT NULL CHECK (duracion_meses IN (1, 6, 12)),
  periodo_inicio timestamptz,
  periodo_fin timestamptz,
  cancelar_al_final_del_periodo boolean NOT NULL DEFAULT false,
  cancelacion_solicitada_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS suscripciones_usuario_estado_unico
ON public.suscripciones (usuario_id)
WHERE estado IN ('pendiente', 'activa');

CREATE INDEX IF NOT EXISTS suscripciones_usuario_idx
ON public.suscripciones (usuario_id);

CREATE INDEX IF NOT EXISTS planes_activos_orden_idx
ON public.planes (activo, orden);

ALTER TABLE public.planes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suscripciones ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.assert_user_verified_for_subscription()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debe iniciar sesión para acceder a las suscripciones.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users au WHERE au.id = auth.uid() AND au.email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Debes verificar tu correo antes de continuar.' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_planes_activos()
RETURNS TABLE (
  id uuid,
  codigo text,
  nombre text,
  precio_centimos integer,
  moneda text,
  duracion_meses integer,
  activo boolean,
  orden integer,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id, codigo, nombre, precio_centimos, moneda, duracion_meses, activo, orden, created_at, updated_at
  FROM public.planes
  WHERE activo = true
  ORDER BY orden ASC, codigo ASC;
$$;

CREATE OR REPLACE FUNCTION public.consultar_mi_suscripcion()
RETURNS public.suscripciones
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT *
  FROM public.suscripciones
  WHERE usuario_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.iniciar_contratacion(p_plan_id uuid)
RETURNS public.suscripciones
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  selected_plan public.planes%ROWTYPE;
  existing_subscription public.suscripciones%ROWTYPE;
BEGIN
  PERFORM public.assert_user_verified_for_subscription();

  UPDATE public.suscripciones
  SET estado = 'vencida', updated_at = now()
  WHERE usuario_id = current_user_id
    AND estado = 'activa'
    AND periodo_fin IS NOT NULL
    AND periodo_fin <= now();

  SELECT * INTO selected_plan
  FROM public.planes
  WHERE id = p_plan_id
    AND activo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este plan no está disponible para nuevas contrataciones.' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO existing_subscription
  FROM public.suscripciones
  WHERE usuario_id = current_user_id
    AND estado IN ('pendiente', 'activa')
  ORDER BY created_at DESC
  LIMIT 1;

  IF existing_subscription.id IS NOT NULL THEN
    IF existing_subscription.estado = 'pendiente' THEN
      RETURN existing_subscription;
    END IF;

    RAISE EXCEPTION 'Ya existe una suscripción activa para este usuario.' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.suscripciones (
    usuario_id,
    plan_id,
    estado,
    precio_centimos,
    moneda,
    duracion_meses,
    periodo_inicio,
    periodo_fin,
    cancelar_al_final_del_periodo,
    cancelacion_solicitada_at
  )
  VALUES (
    current_user_id,
    selected_plan.id,
    'pendiente',
    selected_plan.precio_centimos,
    selected_plan.moneda,
    selected_plan.duracion_meses,
    NULL,
    NULL,
    false,
    NULL
  )
  RETURNING * INTO existing_subscription;

  RETURN existing_subscription;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_renovacion()
RETURNS public.suscripciones
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  subscription_to_update public.suscripciones%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Debe iniciar sesión para gestionar su suscripción.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO subscription_to_update
  FROM public.suscripciones
  WHERE usuario_id = current_user_id
    AND estado = 'activa'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe una suscripción activa para cancelar la renovación.' USING ERRCODE = '23514';
  END IF;

  UPDATE public.suscripciones
  SET cancelar_al_final_del_periodo = true,
      cancelacion_solicitada_at = COALESCE(cancelacion_solicitada_at, now()),
      updated_at = now()
  WHERE id = subscription_to_update.id
  RETURNING * INTO subscription_to_update;

  RETURN subscription_to_update;
END;
$$;

CREATE OR REPLACE FUNCTION public.abandonar_contratacion_pendiente()
RETURNS public.suscripciones
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  subscription_to_cancel public.suscripciones%ROWTYPE;
BEGIN
  SELECT * INTO subscription_to_cancel
  FROM public.suscripciones
  WHERE usuario_id = current_user_id
    AND estado = 'pendiente'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe una contratación pendiente para abandonar.' USING ERRCODE = '23514';
  END IF;

  UPDATE public.suscripciones
  SET estado = 'cancelada',
      updated_at = now()
  WHERE id = subscription_to_cancel.id
  RETURNING * INTO subscription_to_cancel;

  RETURN subscription_to_cancel;
END;
$$;

CREATE OR REPLACE FUNCTION public.comprobar_acceso_suscripcion(p_usuario_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.suscripciones s
    WHERE s.usuario_id = COALESCE(p_usuario_id, auth.uid())
      AND s.estado = 'activa'
      AND s.periodo_inicio IS NOT NULL
      AND s.periodo_fin IS NOT NULL
      AND s.periodo_inicio <= now()
      AND s.periodo_fin > now()
  );
$$;

CREATE POLICY "Planes activos visibles públicamente"
ON public.planes
FOR SELECT
USING (activo = true);

CREATE POLICY "No se escriben planes desde el cliente"
ON public.planes
FOR INSERT
WITH CHECK (false);

CREATE POLICY "No se actualizan planes desde el cliente"
ON public.planes
FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "No se borran planes desde el cliente"
ON public.planes
FOR DELETE
USING (false);

CREATE POLICY "Cada usuario solo ve su suscripción"
ON public.suscripciones
FOR SELECT
USING (auth.uid() = usuario_id);

CREATE POLICY "No se insertan suscripciones desde el cliente"
ON public.suscripciones
FOR INSERT
WITH CHECK (false);

CREATE POLICY "No se actualiza la suscripción desde el cliente"
ON public.suscripciones
FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "No se eliminan suscripciones desde el cliente"
ON public.suscripciones
FOR DELETE
USING (false);

INSERT INTO public.planes (codigo, nombre, precio_centimos, moneda, duracion_meses, activo, orden)
VALUES
  ('mensual', 'Mensual', 1500, 'EUR', 1, true, 1),
  ('semestral', 'Semestral', 7900, 'EUR', 6, true, 2),
  ('anual', 'Anual', 12000, 'EUR', 12, true, 3)
ON CONFLICT (codigo)
DO UPDATE SET
  nombre = EXCLUDED.nombre,
  precio_centimos = EXCLUDED.precio_centimos,
  moneda = EXCLUDED.moneda,
  duracion_meses = EXCLUDED.duracion_meses,
  activo = EXCLUDED.activo,
  orden = EXCLUDED.orden,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.tg_planes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_suscripciones_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS planes_set_updated_at ON public.planes;
CREATE TRIGGER planes_set_updated_at
BEFORE UPDATE ON public.planes
FOR EACH ROW EXECUTE FUNCTION public.tg_planes_updated_at();

DROP TRIGGER IF EXISTS suscripciones_set_updated_at ON public.suscripciones;
CREATE TRIGGER suscripciones_set_updated_at
BEFORE UPDATE ON public.suscripciones
FOR EACH ROW EXECUTE FUNCTION public.tg_suscripciones_updated_at();
