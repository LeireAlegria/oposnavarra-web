CREATE OR REPLACE FUNCTION public.tiene_suscripcion_activa(
  p_usuario_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.suscripciones s
    WHERE s.usuario_id = CASE
        WHEN auth.role() = 'service_role' THEN COALESCE(p_usuario_id, auth.uid())
        ELSE auth.uid()
      END
      AND s.estado = 'activa'
      AND s.periodo_inicio IS NOT NULL
      AND s.periodo_fin IS NOT NULL
      AND s.periodo_inicio <= now()
      AND s.periodo_fin > now()
      AND s.access_revoked_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.stripe_invoices i
        WHERE i.suscripcion_id = s.id
          AND i.estado = 'paid'
          AND i.periodo_inicio <= now()
          AND i.periodo_fin > now()
          AND i.refunded_amount < i.importe_pagado
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.comprobar_acceso_suscripcion(
  p_usuario_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN auth.role() = 'service_role'
      THEN public.tiene_suscripcion_activa(COALESCE(p_usuario_id, auth.uid()))
    WHEN auth.uid() IS NOT NULL
      AND (p_usuario_id IS NULL OR p_usuario_id = auth.uid())
      THEN public.es_admin_actual()
        OR public.tiene_suscripcion_activa(auth.uid())
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.tiene_suscripcion_activa(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.comprobar_acceso_suscripcion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tiene_suscripcion_activa(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.comprobar_acceso_suscripcion(uuid) TO authenticated, service_role;
