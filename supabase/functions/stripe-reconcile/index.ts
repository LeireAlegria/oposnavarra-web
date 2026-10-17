import {
  adminRequest,
  authenticateUser,
  handleOptions,
  jsonResponse,
  requiredEnv,
  createStripeSignature,
  stripeMode,
  stripeRequest,
  stringId,
  type StripeObject,
} from '../_shared/stripe.ts';

type StripeEvent = StripeObject & {
  type: string;
  livemode: boolean;
  data: { object: StripeObject };
};

async function relayEvent(event: StripeEvent, mode: 'test' | 'live'): Promise<Response> {
  if (event.livemode !== (mode === 'live')) {
    return jsonResponse({ message: 'El evento pertenece a otro entorno de Stripe.' }, 400);
  }
  const payload = JSON.stringify(event);
  const signature = await createStripeSignature(
    payload,
    requiredEnv('STRIPE_WEBHOOK_SECRET'),
    Math.floor(Date.now() / 1000),
  );
  const webhookUrl = new URL('/functions/v1/stripe-webhook', requiredEnv('SUPABASE_URL'));
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': signature },
    body: payload,
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(result?.message ?? 'The event could not be reconciled.');
  }
  return jsonResponse({ reconciled: true, eventType: event.type });
}

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return jsonResponse({ message: 'Método no permitido.' }, 405);

  try {
    const user = await authenticateUser(request);
    const profileResponse = await adminRequest(
      `perfiles?id=eq.${encodeURIComponent(user.id)}&select=rol`,
    );
    if (!profileResponse.ok) throw new Error('Unable to verify administrator access.');
    const profiles = (await profileResponse.json()) as Array<{ rol: string }>;
    if (profiles[0]?.rol !== 'admin') return jsonResponse({ message: 'Acceso denegado.' }, 403);

    const mode = stripeMode();
    const body = (await request.json()) as { stripeEventId?: unknown; subscriptionId?: unknown };
    if (typeof body.stripeEventId === 'string' && typeof body.subscriptionId !== 'string') {
      if (!/^evt_[a-zA-Z0-9]+$/.test(body.stripeEventId)) {
        return jsonResponse({ message: 'El identificador del evento no es válido.' }, 400);
      }
      const event = await stripeRequest<StripeEvent>(
        `/v1/events/${encodeURIComponent(body.stripeEventId)}`,
        'GET',
      );
      return await relayEvent(event, mode);
    }

    if (typeof body.subscriptionId === 'string' && typeof body.stripeEventId !== 'string') {
      if (!/^sub_[a-zA-Z0-9]+$/.test(body.subscriptionId)) {
        return jsonResponse({ message: 'El identificador de suscripción no es válido.' }, 400);
      }
      const subscription = await stripeRequest<StripeObject & {
        status: string;
        livemode?: boolean;
        current_period_end?: number;
        cancel_at_period_end?: boolean;
        latest_invoice?: unknown;
      }>(
        `/v1/subscriptions/${encodeURIComponent(body.subscriptionId)}`,
        'GET',
        new URLSearchParams([['expand[]', 'latest_invoice']]),
      );

      const customerId = stringId(subscription.customer);
      if (!customerId || typeof subscription.status !== 'string') {
        return jsonResponse({ message: 'Stripe no devolvió una suscripción válida.' }, 400);
      }

      const subscriptionEvent: StripeEvent = {
        id: `ops_reconcile_sub_${subscription.id}_${subscription.status}_${subscription.current_period_end ?? 'none'}_${subscription.cancel_at_period_end ? 'canceling' : 'renewing'}`,
        object: 'event',
        type: 'customer.subscription.updated',
        livemode: mode === 'live',
        data: { object: { id: subscription.id } },
      };
      await relayEvent(subscriptionEvent, mode);

      const latestInvoice = subscription.latest_invoice as StripeObject | string | null;
      const invoiceId = stringId(latestInvoice);
      if (!invoiceId || typeof latestInvoice !== 'object' || latestInvoice.status !== 'paid') {
        return jsonResponse({
          reconciled: true,
          message: 'Se sincronizó el estado de Stripe, pero no hay una factura pagada que amplíe el acceso.',
        });
      }

      const invoiceEvent: StripeEvent = {
        id: `ops_reconcile_invoice_${invoiceId}`,
        object: 'event',
        type: 'invoice.paid',
        livemode: mode === 'live',
        data: { object: { id: invoiceId } },
      };
      return await relayEvent(invoiceEvent, mode);
    }

    return jsonResponse({ message: 'Indica un evento o una suscripción para reconciliar, pero no ambos.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Reconciliation failed.';
    console.error(JSON.stringify({ operation: 'stripe-reconcile', message }));
    if (message.includes('Authentication required')) return jsonResponse({ message: 'Inicia sesión para continuar.' }, 401);
    if (message.includes('verified email')) return jsonResponse({ message: 'Verifica tu correo para continuar.' }, 403);
    return jsonResponse({ message: 'No se pudo reconciliar el pago. Comprueba el estado en Stripe e inténtalo de nuevo.' }, 500);
  }
});
