ALTER TABLE public.planes
  ADD COLUMN IF NOT EXISTS stripe_product_test text,
  ADD COLUMN IF NOT EXISTS stripe_price_test text,
  ADD COLUMN IF NOT EXISTS stripe_product_live text,
  ADD COLUMN IF NOT EXISTS stripe_price_live text;

CREATE UNIQUE INDEX IF NOT EXISTS planes_stripe_price_test_unico_idx
  ON public.planes (stripe_price_test)
  WHERE stripe_price_test IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS planes_stripe_price_live_unico_idx
  ON public.planes (stripe_price_live)
  WHERE stripe_price_live IS NOT NULL;

ALTER TABLE public.suscripciones
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_status text,
  ADD COLUMN IF NOT EXISTS stripe_mode text CHECK (stripe_mode IN ('test', 'live')),
  ADD COLUMN IF NOT EXISTS access_revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_issue text;

CREATE TABLE IF NOT EXISTS public.stripe_customers (
  usuario_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL UNIQUE,
  stripe_mode text NOT NULL CHECK (stripe_mode IN ('test', 'live')),
  PRIMARY KEY (usuario_id, stripe_mode),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stripe_checkout_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  suscripcion_id uuid NOT NULL REFERENCES public.suscripciones (id) ON DELETE CASCADE,
  stripe_session_id text UNIQUE,
  checkout_url text,
  idempotency_key text NOT NULL UNIQUE,
  estado text NOT NULL DEFAULT 'creating'
    CHECK (estado IN ('creating', 'open', 'completed', 'expired', 'failed')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS stripe_checkout_attempts_open_subscription_idx
  ON public.stripe_checkout_attempts (suscripcion_id)
  WHERE estado IN ('creating', 'open');

CREATE INDEX IF NOT EXISTS stripe_checkout_attempts_user_idx
  ON public.stripe_checkout_attempts (usuario_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.stripe_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_invoice_id text NOT NULL UNIQUE,
  stripe_subscription_id text NOT NULL,
  suscripcion_id uuid NOT NULL REFERENCES public.suscripciones (id) ON DELETE CASCADE,
  stripe_payment_intent_id text,
  moneda text NOT NULL CHECK (moneda = 'eur'),
  importe_pagado integer NOT NULL CHECK (importe_pagado >= 0),
  estado text NOT NULL,
  periodo_inicio timestamptz NOT NULL,
  periodo_fin timestamptz NOT NULL CHECK (periodo_fin > periodo_inicio),
  refunded_amount integer NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stripe_payment_refunds (
  stripe_charge_id text PRIMARY KEY,
  stripe_payment_intent_id text,
  moneda text NOT NULL CHECK (moneda = 'eur'),
  importe integer NOT NULL CHECK (importe >= 0),
  importe_reembolsado integer NOT NULL CHECK (importe_reembolsado >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stripe_invoices_subscription_idx
  ON public.stripe_invoices (suscripcion_id, periodo_fin DESC);

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  stripe_event_id text PRIMARY KEY,
  tipo text NOT NULL,
  objeto_id text,
  estado text NOT NULL DEFAULT 'received'
    CHECK (estado IN ('received', 'processing', 'processed', 'failed', 'ignored')),
  recibido_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz NOT NULL DEFAULT now(),
  procesado_at timestamptz,
  error_resumido text,
  intentos integer NOT NULL DEFAULT 0 CHECK (intentos >= 0)
);

CREATE INDEX IF NOT EXISTS stripe_webhook_events_retry_idx
  ON public.stripe_webhook_events (recibido_at)
  WHERE estado = 'failed';

ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_checkout_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_payment_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their Stripe customer mapping"
  ON public.stripe_customers FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY "Users read their checkout attempts"
  ON public.stripe_checkout_attempts FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY "Users read invoices for their subscriptions"
  ON public.stripe_invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.suscripciones s
      WHERE s.id = suscripcion_id AND s.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Webhook events are not readable by users"
  ON public.stripe_webhook_events FOR SELECT
  USING (false);

CREATE POLICY "No client writes Stripe customer mappings"
  ON public.stripe_customers FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No client writes checkout attempts"
  ON public.stripe_checkout_attempts FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No client writes Stripe invoices"
  ON public.stripe_invoices FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No client access to Stripe refund records"
  ON public.stripe_payment_refunds FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No client writes webhook events"
  ON public.stripe_webhook_events FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.comprobar_acceso_suscripcion(p_usuario_id uuid DEFAULT auth.uid())
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
        SELECT 1 FROM public.stripe_invoices i
        WHERE i.suscripcion_id = s.id
          AND i.estado = 'paid'
          AND i.periodo_inicio <= now()
          AND i.periodo_fin > now()
          AND i.refunded_amount < i.importe_pagado
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.stripe_prepare_checkout(
  p_usuario_id uuid,
  p_plan_id uuid,
  p_mode text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  selected_plan public.planes%ROWTYPE;
  current_subscription public.suscripciones%ROWTYPE;
  attempt public.stripe_checkout_attempts%ROWTYPE;
  selected_price text;
  subscription_found boolean;
BEGIN
  IF auth.role() <> 'service_role' OR p_usuario_id IS NULL
    OR p_mode NOT IN ('test', 'live')
    OR p_idempotency_key IS NULL OR length(p_idempotency_key) > 255 THEN
    RAISE EXCEPTION 'Invalid trusted checkout request.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_usuario_id AND email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Email verification is required.' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_usuario_id::text, 0));

  UPDATE public.suscripciones
  SET estado = 'vencida', updated_at = now()
  WHERE usuario_id = p_usuario_id AND estado = 'activa'
    AND periodo_fin IS NOT NULL AND periodo_fin <= now()
    AND (
      stripe_subscription_id IS NULL
      OR stripe_status IN ('canceled', 'incomplete_expired')
    );

  SELECT * INTO selected_plan
  FROM public.planes
  WHERE id = p_plan_id AND activo = true
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This plan is not available.' USING ERRCODE = '23514';
  END IF;

  selected_price := CASE p_mode
    WHEN 'test' THEN selected_plan.stripe_price_test
    ELSE selected_plan.stripe_price_live
  END;

  IF selected_price IS NULL OR selected_price = '' THEN
    RAISE EXCEPTION 'This plan is not configured for Stripe.' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO current_subscription
  FROM public.suscripciones
  WHERE usuario_id = p_usuario_id AND estado IN ('pendiente', 'activa')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  subscription_found := FOUND;

  IF subscription_found AND current_subscription.estado = 'activa' THEN
    RAISE EXCEPTION 'An active subscription already exists.' USING ERRCODE = '23505';
  END IF;

  IF subscription_found AND current_subscription.stripe_mode IS NOT NULL
    AND current_subscription.stripe_mode <> p_mode THEN
    RAISE EXCEPTION 'A pending subscription cannot change Stripe environment.' USING ERRCODE = '23505';
  END IF;

  IF subscription_found AND current_subscription.stripe_subscription_id IS NOT NULL THEN
    RAISE EXCEPTION 'Payment is being confirmed or requires attention; do not start another checkout.' USING ERRCODE = '23505';
  END IF;

  IF subscription_found AND EXISTS (
    SELECT 1 FROM public.stripe_checkout_attempts
    WHERE suscripcion_id = current_subscription.id AND estado = 'completed'
  ) THEN
    RAISE EXCEPTION 'Checkout is complete and its payment is being resolved.' USING ERRCODE = '23505';
  END IF;

  IF subscription_found AND current_subscription.plan_id <> p_plan_id THEN
    RAISE EXCEPTION 'Abandon the current pending checkout before selecting another plan.' USING ERRCODE = '23505';
  END IF;

  IF NOT subscription_found THEN
    INSERT INTO public.suscripciones (
      usuario_id, plan_id, estado, precio_centimos, moneda, duracion_meses, stripe_mode
    )
    VALUES (
      p_usuario_id, selected_plan.id, 'pendiente', selected_plan.precio_centimos,
      selected_plan.moneda, selected_plan.duracion_meses, p_mode
    )
    RETURNING * INTO current_subscription;
  ELSIF current_subscription.stripe_mode IS NULL THEN
    UPDATE public.suscripciones
    SET stripe_mode = p_mode, updated_at = now()
    WHERE id = current_subscription.id
    RETURNING * INTO current_subscription;
  END IF;

  SELECT * INTO attempt
  FROM public.stripe_checkout_attempts
  WHERE suscripcion_id = current_subscription.id
    AND estado IN ('creating', 'open')
    AND (
      stripe_session_id IS NOT NULL
      OR expires_at IS NULL
      OR expires_at > now()
    )
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'attempt_id', attempt.id,
      'subscription_id', current_subscription.id,
      'checkout_url', attempt.checkout_url,
      'idempotency_key', attempt.idempotency_key,
      'stripe_session_id', attempt.stripe_session_id,
      'expires_at', attempt.expires_at,
      'plan_id', selected_plan.id,
      'price_id', selected_price
    );
  END IF;

  UPDATE public.stripe_checkout_attempts
  SET estado = 'expired', updated_at = now()
  WHERE suscripcion_id = current_subscription.id
    AND estado IN ('creating', 'open');

  INSERT INTO public.stripe_checkout_attempts (
    usuario_id, suscripcion_id, idempotency_key, expires_at
  )
  VALUES (p_usuario_id, current_subscription.id, p_idempotency_key, now() + interval '23 hours')
  RETURNING * INTO attempt;

  RETURN jsonb_build_object(
    'attempt_id', attempt.id,
    'subscription_id', current_subscription.id,
    'checkout_url', NULL,
    'idempotency_key', attempt.idempotency_key,
    'stripe_session_id', NULL,
    'expires_at', attempt.expires_at,
    'plan_id', selected_plan.id,
    'price_id', selected_price
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.stripe_attach_checkout_session(
  p_attempt_id uuid,
  p_session_id text,
  p_checkout_url text,
  p_expires_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() <> 'service_role' OR p_session_id IS NULL OR p_checkout_url IS NULL THEN
    RAISE EXCEPTION 'Invalid trusted checkout update.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.stripe_checkout_attempts
  SET stripe_session_id = p_session_id,
      checkout_url = p_checkout_url,
      expires_at = p_expires_at,
      estado = CASE WHEN estado = 'completed' THEN 'completed' ELSE 'open' END,
      updated_at = now()
  WHERE id = p_attempt_id
    AND estado IN ('creating', 'open', 'completed')
    AND (stripe_session_id IS NULL OR stripe_session_id = p_session_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checkout attempt is no longer available.' USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.stripe_claim_event(
  p_event_id text,
  p_type text,
  p_object_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_status text;
  current_locked_at timestamptz;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Trusted webhook required.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.stripe_webhook_events (stripe_event_id, tipo, objeto_id, estado, intentos)
  VALUES (p_event_id, p_type, p_object_id, 'processing', 1)
  ON CONFLICT (stripe_event_id) DO NOTHING;

  IF FOUND THEN
    RETURN true;
  END IF;

  SELECT estado, locked_at INTO current_status, current_locked_at
  FROM public.stripe_webhook_events
  WHERE stripe_event_id = p_event_id
  FOR UPDATE;

  IF current_status IN ('processed', 'ignored')
    OR (current_status = 'processing' AND current_locked_at > now() - interval '15 minutes') THEN
    RETURN false;
  END IF;

  UPDATE public.stripe_webhook_events
  SET estado = 'processing', intentos = intentos + 1, locked_at = now(),
      error_resumido = NULL
  WHERE stripe_event_id = p_event_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.stripe_finish_event(
  p_event_id text,
  p_status text,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() <> 'service_role'
    OR p_status NOT IN ('processed', 'failed', 'ignored') THEN
    RAISE EXCEPTION 'Invalid trusted webhook update.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.stripe_webhook_events
  SET estado = p_status,
      procesado_at = CASE WHEN p_status = 'processed' THEN now() ELSE procesado_at END,
      error_resumido = CASE WHEN p_status = 'failed' THEN left(COALESCE(p_error, 'Unknown error'), 500) ELSE NULL END
  WHERE stripe_event_id = p_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.stripe_mark_checkout(
  p_session_id text,
  p_status text,
  p_customer_id text DEFAULT NULL,
  p_subscription_id text DEFAULT NULL,
  p_attempt_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() <> 'service_role'
    OR p_status NOT IN ('completed', 'expired') THEN
    RAISE EXCEPTION 'Invalid trusted checkout event.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.stripe_checkout_attempts
  SET stripe_session_id = COALESCE(stripe_session_id, p_session_id),
      estado = CASE WHEN estado = 'completed' THEN 'completed' ELSE p_status END,
      updated_at = now()
  WHERE (stripe_session_id = p_session_id OR id = p_attempt_id)
    AND (stripe_session_id IS NULL OR stripe_session_id = p_session_id);

  IF p_subscription_id IS NOT NULL THEN
    UPDATE public.suscripciones
    SET stripe_customer_id = COALESCE(p_customer_id, stripe_customer_id),
        stripe_subscription_id = COALESCE(p_subscription_id, stripe_subscription_id),
        updated_at = now()
    WHERE id = (
      SELECT suscripcion_id FROM public.stripe_checkout_attempts
      WHERE stripe_session_id = p_session_id OR id = p_attempt_id
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.stripe_apply_paid_invoice(
  p_invoice_id text,
  p_customer_id text,
  p_subscription_id text,
  p_internal_subscription_id uuid,
  p_metadata_user_id uuid,
  p_metadata_plan_id uuid,
  p_payment_intent_id text,
  p_price_id text,
  p_currency text,
  p_amount_paid integer,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_stripe_status text,
  p_mode text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  mapped_user uuid;
  current_subscription public.suscripciones%ROWTYPE;
  expected_price text;
BEGIN
  IF auth.role() <> 'service_role' OR p_currency <> 'eur'
    OR p_mode NOT IN ('test', 'live')
    OR p_amount_paid < 0
    OR p_payment_intent_id IS NULL
    OR p_period_start IS NULL OR p_period_end <= p_period_start THEN
    RAISE EXCEPTION 'Invalid paid invoice data.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.stripe_invoices
    WHERE stripe_invoice_id = p_invoice_id
      AND stripe_subscription_id = p_subscription_id
      AND suscripcion_id = p_internal_subscription_id
  ) THEN
    RETURN;
  END IF;

  SELECT usuario_id INTO mapped_user
  FROM public.stripe_customers
  WHERE stripe_customer_id = p_customer_id AND stripe_mode = p_mode;

  IF mapped_user IS NULL THEN
    RAISE EXCEPTION 'Stripe customer is not mapped to a user.' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO current_subscription
  FROM public.suscripciones
  WHERE id = p_internal_subscription_id
    AND usuario_id = mapped_user
    AND estado IN ('pendiente', 'activa')
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription is not associated with this Stripe customer.' USING ERRCODE = '23514';
  END IF;

  IF current_subscription.stripe_mode IS NOT NULL
    AND current_subscription.stripe_mode <> p_mode THEN
    RAISE EXCEPTION 'Stripe environment does not match the stored subscription.' USING ERRCODE = '23514';
  END IF;

  IF current_subscription.stripe_subscription_id IS NOT NULL
    AND current_subscription.stripe_subscription_id <> p_subscription_id THEN
    RAISE EXCEPTION 'Stripe subscription does not match the stored subscription.' USING ERRCODE = '23514';
  END IF;

  IF p_metadata_user_id <> mapped_user OR p_metadata_plan_id <> current_subscription.plan_id THEN
    RAISE EXCEPTION 'Stripe subscription metadata does not match the stored subscription.' USING ERRCODE = '23514';
  END IF;

  SELECT CASE p_mode
    WHEN 'test' THEN stripe_price_test ELSE stripe_price_live
  END INTO expected_price
  FROM public.planes WHERE id = current_subscription.plan_id;

  IF expected_price IS NULL OR expected_price <> p_price_id
    OR p_amount_paid <> current_subscription.precio_centimos THEN
    RAISE EXCEPTION 'Invoice price does not match the subscribed plan.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.stripe_invoices (
    stripe_invoice_id, stripe_subscription_id, suscripcion_id,
    stripe_payment_intent_id, moneda, importe_pagado, estado,
    periodo_inicio, periodo_fin
  )
  VALUES (
    p_invoice_id, p_subscription_id, current_subscription.id,
    p_payment_intent_id, p_currency, p_amount_paid, 'paid',
    p_period_start, p_period_end
  );

  UPDATE public.suscripciones
  SET estado = 'activa',
      stripe_customer_id = p_customer_id,
      stripe_subscription_id = p_subscription_id,
      stripe_status = p_stripe_status,
      stripe_mode = p_mode,
      periodo_inicio = CASE
        WHEN periodo_fin IS NULL OR p_period_end > periodo_fin THEN p_period_start
        ELSE periodo_inicio
      END,
      periodo_fin = GREATEST(COALESCE(periodo_fin, p_period_end), p_period_end),
      access_revoked_at = NULL,
      payment_issue = NULL,
      updated_at = now()
  WHERE id = current_subscription.id;

  UPDATE public.stripe_invoices i
  SET refunded_amount = LEAST(
        i.importe_pagado,
        GREATEST(
          i.refunded_amount,
          COALESCE((
            SELECT sum(r.importe_reembolsado)
            FROM public.stripe_payment_refunds r
            WHERE r.stripe_payment_intent_id = p_payment_intent_id
          ), 0)
        )
      )
  WHERE i.stripe_invoice_id = p_invoice_id;

  UPDATE public.suscripciones s
  SET access_revoked_at = now(), updated_at = now()
  WHERE s.id = current_subscription.id
    AND p_period_start <= now()
    AND p_period_end > now()
    AND EXISTS (
      SELECT 1 FROM public.stripe_invoices i
      WHERE i.stripe_invoice_id = p_invoice_id
        AND i.refunded_amount >= i.importe_pagado
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.stripe_record_payment_issue(
  p_customer_id text,
  p_subscription_id text,
  p_issue text,
  p_stripe_status text,
  p_invoice_period_end timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Trusted payment event required.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.suscripciones
  SET payment_issue = left(p_issue, 100),
      stripe_status = p_stripe_status,
      updated_at = now()
  WHERE stripe_subscription_id = p_subscription_id
    AND stripe_customer_id = p_customer_id
    AND NOT EXISTS (
      SELECT 1 FROM public.stripe_invoices i
      WHERE i.suscripcion_id = suscripciones.id
        AND i.periodo_fin >= p_invoice_period_end
        AND i.estado = 'paid'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.stripe_sync_subscription(
  p_customer_id text,
  p_subscription_id text,
  p_status text,
  p_cancel_at_period_end boolean,
  p_current_period_end timestamptz,
  p_mode text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() <> 'service_role' OR p_mode NOT IN ('test', 'live') THEN
    RAISE EXCEPTION 'Trusted subscription event required.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.suscripciones
  SET stripe_status = p_status,
      payment_issue = CASE
        WHEN p_status = 'past_due' THEN COALESCE(payment_issue, 'payment_failed')
        WHEN p_status = 'incomplete' THEN COALESCE(payment_issue, 'action_required')
        WHEN p_status = 'active' THEN NULL
        ELSE payment_issue
      END,
      cancelar_al_final_del_periodo = p_cancel_at_period_end,
      cancelacion_solicitada_at = CASE
        WHEN p_cancel_at_period_end THEN COALESCE(cancelacion_solicitada_at, now())
        ELSE NULL
      END,
      estado = CASE
        WHEN p_status = 'canceled' AND (periodo_fin IS NULL OR periodo_fin <= now()) THEN 'cancelada'
        WHEN p_status = 'incomplete_expired' AND (periodo_fin IS NULL OR periodo_fin <= now()) THEN 'vencida'
        ELSE estado
      END,
      periodo_fin = CASE
        WHEN p_current_period_end > COALESCE(periodo_fin, '-infinity'::timestamptz)
          AND EXISTS (
            SELECT 1 FROM public.stripe_invoices i
            WHERE i.suscripcion_id = suscripciones.id
              AND i.periodo_fin >= p_current_period_end
          )
        THEN p_current_period_end
        ELSE periodo_fin
      END,
      updated_at = now()
  WHERE stripe_subscription_id = p_subscription_id
    AND stripe_customer_id = p_customer_id
    AND stripe_mode = p_mode;
END;
$$;

CREATE OR REPLACE FUNCTION public.stripe_record_refund(
  p_charge_id text,
  p_payment_intent_id text,
  p_currency text,
  p_amount_refunded integer,
  p_charge_amount integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() <> 'service_role' OR p_currency <> 'eur'
    OR p_amount_refunded < 0 OR p_charge_amount < 0
    OR p_amount_refunded > p_charge_amount THEN
    RAISE EXCEPTION 'Trusted refund event required.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.stripe_payment_refunds AS existing_refund (
    stripe_charge_id, stripe_payment_intent_id, moneda, importe, importe_reembolsado
  )
  VALUES (p_charge_id, p_payment_intent_id, p_currency, p_charge_amount, p_amount_refunded)
  ON CONFLICT (stripe_charge_id) DO UPDATE
  SET importe_reembolsado = GREATEST(
        existing_refund.importe_reembolsado,
        EXCLUDED.importe_reembolsado
      ),
      updated_at = now();

  UPDATE public.stripe_invoices
  SET refunded_amount = LEAST(
        importe_pagado,
        GREATEST(
          refunded_amount,
          COALESCE((
            SELECT sum(r.importe_reembolsado)
            FROM public.stripe_payment_refunds r
            WHERE r.stripe_payment_intent_id = p_payment_intent_id
          ), 0)
        )
      ),
      updated_at = now()
  WHERE stripe_payment_intent_id = p_payment_intent_id;

  UPDATE public.suscripciones s
  SET access_revoked_at = now(), updated_at = now()
  WHERE s.access_revoked_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.stripe_invoices i
      WHERE i.suscripcion_id = s.id
        AND i.stripe_payment_intent_id = p_payment_intent_id
        AND i.periodo_inicio <= now()
        AND i.periodo_fin > now()
        AND i.refunded_amount >= i.importe_pagado
    );
END;
$$;

REVOKE ALL ON FUNCTION public.stripe_prepare_checkout(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stripe_attach_checkout_session(uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stripe_claim_event(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stripe_finish_event(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stripe_mark_checkout(text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stripe_apply_paid_invoice(text, text, text, uuid, uuid, uuid, text, text, text, integer, timestamptz, timestamptz, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stripe_record_payment_issue(text, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stripe_sync_subscription(text, text, text, boolean, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stripe_record_refund(text, text, text, integer, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.stripe_prepare_checkout(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.stripe_attach_checkout_session(uuid, text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.stripe_claim_event(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.stripe_finish_event(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.stripe_mark_checkout(text, text, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.stripe_apply_paid_invoice(text, text, text, uuid, uuid, uuid, text, text, text, integer, timestamptz, timestamptz, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.stripe_record_payment_issue(text, text, text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.stripe_sync_subscription(text, text, text, boolean, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.stripe_record_refund(text, text, text, integer, integer) TO service_role;

GRANT SELECT ON public.stripe_customers, public.stripe_checkout_attempts, public.stripe_invoices TO authenticated;
GRANT ALL ON public.stripe_customers, public.stripe_checkout_attempts, public.stripe_invoices,
  public.stripe_payment_refunds, public.stripe_webhook_events TO service_role;

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
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Debe iniciar sesión para gestionar su contratación.' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));

  SELECT * INTO subscription_to_cancel
  FROM public.suscripciones
  WHERE usuario_id = current_user_id AND estado = 'pendiente'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe una contratación pendiente para abandonar.' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.stripe_checkout_attempts
    WHERE suscripcion_id = subscription_to_cancel.id
      AND estado IN ('creating', 'open')
      AND (expires_at IS NULL OR expires_at > now())
  ) OR subscription_to_cancel.stripe_subscription_id IS NOT NULL THEN
    RAISE EXCEPTION 'No se puede abandonar una sesión de pago que aún puede completarse. Espera a que expire o resuelve el pago en Stripe.' USING ERRCODE = '23514';
  END IF;

  UPDATE public.suscripciones
  SET estado = 'cancelada', updated_at = now()
  WHERE id = subscription_to_cancel.id
  RETURNING * INTO subscription_to_cancel;

  RETURN subscription_to_cancel;
END;
$$;

REVOKE ALL ON FUNCTION public.abandonar_contratacion_pendiente() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.abandonar_contratacion_pendiente() TO authenticated;

REVOKE ALL ON FUNCTION public.cancelar_renovacion() FROM PUBLIC, anon, authenticated;
