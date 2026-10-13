CREATE OR REPLACE FUNCTION public.es_admin_actual()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND p.rol = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.exigir_rol_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debe iniciar sesión para acceder a la administración.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND p.rol = 'admin'
  ) THEN
    RAISE EXCEPTION 'No tienes permisos de administrador.' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE POLICY "Los administradores pueden consultar perfiles de usuarios"
ON public.perfiles
FOR SELECT
USING (public.es_admin_actual() OR auth.uid() = id);

CREATE POLICY "Los administradores pueden gestionar roles en perfiles"
ON public.perfiles
FOR UPDATE
USING (public.es_admin_actual())
WITH CHECK (
  public.es_admin_actual()
  AND NEW.rol IN ('usuario', 'admin')
  AND NEW.id IS NOT NULL
);

CREATE POLICY "Los usuarios solo pueden editar su perfil sin cambiar rol"
ON public.perfiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND OLD.rol = NEW.rol
);

CREATE OR REPLACE FUNCTION public.consultar_admin_panel_resumen()
RETURNS TABLE (
  convocatorias bigint,
  temas bigint,
  examenes bigint,
  preguntas bigint,
  usuarios bigint,
  planes bigint,
  suscripciones bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.exigir_rol_admin();

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.convocatorias) AS convocatorias,
    (SELECT count(*) FROM public.temas) AS temas,
    (SELECT count(*) FROM public.examenes) AS examenes,
    (SELECT count(*) FROM public.preguntas) AS preguntas,
    (SELECT count(*) FROM public.perfiles) AS usuarios,
    (SELECT count(*) FROM public.planes) AS planes,
    (SELECT count(*) FROM public.suscripciones) AS suscripciones;
END;
$$;
