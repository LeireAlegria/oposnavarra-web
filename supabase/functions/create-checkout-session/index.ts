import {
  adminRequest,
  adminRpc,
  authenticateUser,
  handleOptions,
  jsonResponse,
  requiredEnv,
  stripeMode,
  stripeRequest,
  stringId,
  type StripeObject,
} from '../_shared/stripe.ts';

type CheckoutPreparation = {
  attempt_id: string;
  subscription_id: string;
  checkout_url: string | null;
  idempotency_key: string;
  stripe_session_id: string | null;
  expires_at: string;
  price_id: string;
};

type StripeCustomer = StripeObject & { email?: string | null };

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return jsonResponse({ message: 'Método no permitido.' }, 405);

  const correlationId = crypto.randomUUID();
  try {
    const user = await authenticateUser(request);
    const mode = stripeMode();
    const body = (await request.json()) as { planId?: unknown };
    if (typeof body.planId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.planId)) {
      return jsonResponse({ message: 'Selecciona un plan válido.' }, 400);
    }

    let preparation = await adminRpc<CheckoutPreparation>('stripe_prepare_checkout', {
      p_usuario_id: user.id,
      p_plan_id: body.planId,
      p_mode: mode,
      p_idempotency_key: crypto.randomUUID(),
    });

    if (preparation.checkout_url && preparation.stripe_session_id) {
      if (Date.parse(preparation.expires_at) <= Date.now()) {
        const session = await stripeRequest<StripeObject & {
          status?: string;
          url?: string;
          client_reference_id?: string;
          customer?: unknown;
          subscription?: unknown;
          metadata?: Record<string, unknown>;
        }>(
          `/v1/checkout/sessions/${encodeURIComponent(preparation.stripe_session_id)}`,
          'GET',
        );
        if (
          session.client_reference_id !== preparation.subscription_id ||
          session.metadata?.checkout_attempt_id !== preparation.attempt_id ||
          session.metadata?.user_id !== user.id
        ) {
          throw new Error('Stripe Checkout session does not match its reservation.');
        }

        if (session.status === 'complete') {
          await adminRpc<void>('stripe_mark_checkout', {
            p_session_id: session.id,
            p_status: 'completed',
            p_customer_id: stringId(session.customer),
            p_subscription_id: stringId(session.subscription),
            p_attempt_id: preparation.attempt_id,
          });
          return jsonResponse({
            message: 'Ya se completó este pago. Estamos confirmando el resultado; no inicies otra contratación.',
          }, 409);
        }

        if (session.status === 'expired') {
          await adminRpc<void>('stripe_mark_checkout', {
            p_session_id: session.id,
            p_status: 'expired',
            p_attempt_id: preparation.attempt_id,
          });
          preparation = await adminRpc<CheckoutPreparation>('stripe_prepare_checkout', {
            p_usuario_id: user.id,
            p_plan_id: body.planId,
            p_mode: mode,
            p_idempotency_key: crypto.randomUUID(),
          });
          if (preparation.checkout_url && preparation.stripe_session_id) {
            return jsonResponse({ url: preparation.checkout_url });
          }
          if (preparation.stripe_session_id) {
            throw new Error('The expired Checkout session was not replaced with a new reservation.');
          }
        } else if (session.status !== 'open') {
          return jsonResponse({
            message: 'No se pudo confirmar el estado del pago. Vuelve a tu cuenta antes de intentarlo de nuevo.',
          }, 409);
        } else if (session.url?.startsWith('https://checkout.stripe.com/')) {
          return jsonResponse({ url: session.url });
        }
      }

      if (preparation.checkout_url && preparation.stripe_session_id) {
        return jsonResponse({ url: preparation.checkout_url });
      }
    }

    const customerResponse = await adminRequest(
      `stripe_customers?usuario_id=eq.${encodeURIComponent(user.id)}&stripe_mode=eq.${mode}&select=stripe_customer_id`,
    );
    if (!customerResponse.ok) throw new Error('Unable to retrieve Stripe customer mapping.');
    const mappedCustomers = (await customerResponse.json()) as Array<{ stripe_customer_id: string }>;
    let customerId = mappedCustomers[0]?.stripe_customer_id;

    if (!customerId) {
      const customerParameters = new URLSearchParams({
        email: user.email,
        'metadata[user_id]': user.id,
      });
      const customer = await stripeRequest<StripeCustomer>(
        '/v1/customers',
        'POST',
        customerParameters,
        `customer-${mode}-${user.id}`,
      );
      customerId = customer.id;

      const mappingResponse = await adminRequest('stripe_customers?on_conflict=usuario_id,stripe_mode', {
        method: 'POST',
        headers: { prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify({
          usuario_id: user.id,
          stripe_customer_id: customerId,
          stripe_mode: mode,
        }),
      });
      if (!mappingResponse.ok) throw new Error('Unable to save Stripe customer mapping.');
    }

    const siteUrl = new URL(requiredEnv('SITE_URL'));
    if (siteUrl.protocol !== 'https:' && siteUrl.hostname !== 'localhost') {
      throw new Error('SITE_URL must use HTTPS outside local development.');
    }
    const parameters = new URLSearchParams({
      mode: 'subscription',
      customer: customerId,
      'line_items[0][price]': preparation.price_id,
      'line_items[0][quantity]': '1',
      'payment_method_types[0]': 'card',
      success_url: new URL('/checkout/confirmacion?session_id={CHECKOUT_SESSION_ID}', siteUrl).toString(),
      cancel_url: new URL('/planes?checkout=cancelled', siteUrl).toString(),
      client_reference_id: preparation.subscription_id,
      'metadata[user_id]': user.id,
      'metadata[subscription_id]': preparation.subscription_id,
      'metadata[checkout_attempt_id]': preparation.attempt_id,
      'subscription_data[metadata][user_id]': user.id,
      'subscription_data[metadata][subscription_id]': preparation.subscription_id,
      'subscription_data[metadata][plan_id]': body.planId,
      'subscription_data[metadata][mode]': mode,
      allow_promotion_codes: 'false',
      'automatic_tax[enabled]': 'false',
      expires_at: String(Math.floor(new Date(preparation.expires_at).getTime() / 1000)),
    });
    const session = await stripeRequest<StripeObject & { url?: string; expires_at?: number }>(
      '/v1/checkout/sessions',
      'POST',
      parameters,
      preparation.idempotency_key,
    );
    if (!session.url || !session.url.startsWith('https://checkout.stripe.com/')) {
      throw new Error('Stripe did not provide a valid hosted Checkout URL.');
    }

    const attachResponse = await adminRpc<void>('stripe_attach_checkout_session', {
      p_attempt_id: preparation.attempt_id,
      p_session_id: session.id,
      p_checkout_url: session.url,
      p_expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
    });
    void attachResponse;
    return jsonResponse({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Checkout could not be created.';
    console.error(JSON.stringify({ correlationId, operation: 'create-checkout-session', message }));
    if (message.includes('Authentication required')) return jsonResponse({ message: 'Inicia sesión para contratar.' }, 401);
    if (message.includes('verified email')) return jsonResponse({ message: 'Verifica tu correo antes de contratar.' }, 403);
    return jsonResponse({ message: 'No se pudo iniciar el pago. Inténtalo de nuevo o consulta el estado de tu cuenta.' }, 400);
  }
});
