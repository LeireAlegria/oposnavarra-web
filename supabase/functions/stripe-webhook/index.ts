import {
  adminRpc,
  handleOptions,
  jsonResponse,
  requiredEnv,
  stripeMode,
  stripeRequest,
  stringId,
  unixDate,
  verifyStripeSignature,
  type StripeObject,
} from '../_shared/stripe.ts';

type StripeInvoiceLine = {
  period?: { start?: number; end?: number };
  price?: { id?: string };
  pricing?: { price_details?: { price?: string } };
};

function getInvoiceSubscriptionId(invoice: StripeObject): string | null {
  const parent = invoice.parent as { subscription_details?: { subscription?: unknown } } | null;
  return stringId(invoice.subscription) ?? stringId(parent?.subscription_details?.subscription);
}

function getInvoicePriceId(invoice: StripeObject): string | null {
  const lines = invoice.lines as { data?: StripeInvoiceLine[] } | undefined;
  const priceIds = (lines?.data ?? [])
    .map((line) => line.price?.id ?? line.pricing?.price_details?.price)
    .filter((priceId): priceId is string => Boolean(priceId));
  return priceIds.length === 1 ? priceIds[0] : null;
}

function getInvoicePeriod(invoice: StripeObject): { start: string; end: string } | null {
  const lines = invoice.lines as { data?: StripeInvoiceLine[] } | undefined;
  const periods = (lines?.data ?? [])
    .filter((line) => line.price?.id || line.pricing?.price_details?.price)
    .map((line) => ({ start: unixDate(line.period?.start), end: unixDate(line.period?.end) }))
    .filter((period): period is { start: string; end: string } => Boolean(period.start && period.end));
  return periods.length === 1 ? periods[0] : null;
}

function getPaymentIntentId(invoice: StripeObject): string | null {
  const payments = invoice.payments as {
    data?: Array<{ payment?: { payment_intent?: unknown } }>;
  } | undefined;
  return stringId(invoice.payment_intent) ?? stringId(payments?.data?.[0]?.payment?.payment_intent);
}

async function retrieveSubscription(subscriptionId: string): Promise<StripeObject> {
  return stripeRequest<StripeObject>(
    `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
    'GET',
    new URLSearchParams([
      ['expand[]', 'items.data.price'],
      ['expand[]', 'latest_invoice'],
    ]),
  );
}

async function applyPaidInvoice(invoiceId: string, mode: 'test' | 'live'): Promise<void> {
  const invoice = await stripeRequest<StripeObject>(
    `/v1/invoices/${encodeURIComponent(invoiceId)}`,
    'GET',
    new URLSearchParams([
      ['expand[]', 'lines.data.price'],
      ['expand[]', 'payments.data.payment.payment_intent'],
    ]),
  );
  if (invoice.status !== 'paid') throw new Error('Stripe invoice is not paid.');
  const customerId = stringId(invoice.customer);
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  const priceId = getInvoicePriceId(invoice);
  const paymentIntentId = getPaymentIntentId(invoice);
  const period = getInvoicePeriod(invoice);
  const amountPaid = invoice.amount_paid;
  if (
    !customerId ||
    !subscriptionId ||
    !priceId ||
    !paymentIntentId ||
    !period ||
    typeof amountPaid !== 'number' ||
    invoice.currency !== 'eur'
  ) {
    throw new Error('Paid invoice is missing validated subscription details.');
  }
  const subscription = await retrieveSubscription(subscriptionId);
  if (stringId(subscription.customer) !== customerId) {
    throw new Error('Invoice and subscription customers do not match.');
  }
  const metadata = subscription.metadata as Record<string, unknown> | undefined;
  const internalSubscriptionId = metadata?.subscription_id;
  if (
    typeof internalSubscriptionId !== 'string' ||
    typeof metadata?.user_id !== 'string' ||
    typeof metadata.plan_id !== 'string' ||
    metadata.mode !== mode
  ) {
    throw new Error('Stripe subscription metadata is invalid.');
  }
  const subscriptionStatus = typeof subscription.status === 'string' ? subscription.status : 'unknown';
  await adminRpc<void>('stripe_apply_paid_invoice', {
    p_invoice_id: invoice.id,
    p_customer_id: customerId,
    p_subscription_id: subscriptionId,
    p_internal_subscription_id: internalSubscriptionId,
    p_metadata_user_id: metadata.user_id,
    p_metadata_plan_id: metadata.plan_id,
    p_payment_intent_id: paymentIntentId,
    p_price_id: priceId,
    p_currency: invoice.currency,
    p_amount_paid: amountPaid,
    p_period_start: period.start,
    p_period_end: period.end,
    p_stripe_status: subscriptionStatus,
    p_mode: mode,
  });
}

async function applyLatestPaidInvoice(subscription: StripeObject, mode: 'test' | 'live'): Promise<void> {
  const latestInvoiceId = stringId(subscription.latest_invoice);
  if (!latestInvoiceId) return;

  const latestInvoice = await stripeRequest<StripeObject>(
    `/v1/invoices/${encodeURIComponent(latestInvoiceId)}`,
    'GET',
  );
  if (latestInvoice.status === 'paid') await applyPaidInvoice(latestInvoiceId, mode);
}

async function syncSubscription(subscription: StripeObject, mode: 'test' | 'live'): Promise<void> {
  const customerId = stringId(subscription.customer);
  const itemData = (subscription.items as { data?: Array<{ current_period_end?: number }> } | undefined)?.data ?? [];
  const periodEnd = unixDate(subscription.current_period_end) ??
    unixDate(itemData[0]?.current_period_end);
  if (!customerId || typeof subscription.status !== 'string') {
    throw new Error('Subscription event is missing validated details.');
  }
  await adminRpc<void>('stripe_sync_subscription', {
    p_customer_id: customerId,
    p_subscription_id: subscription.id,
    p_status: subscription.status,
    p_cancel_at_period_end: subscription.cancel_at_period_end === true,
    p_current_period_end: periodEnd,
    p_mode: mode,
  });
}

async function processEvent(event: StripeObject, mode: 'test' | 'live'): Promise<'processed' | 'ignored'> {
  const data = event.data as { object?: StripeObject } | undefined;
  const object = data?.object;
  if (!object) throw new Error('Stripe event has no object.');

  switch (event.type) {
    case 'checkout.session.completed': {
      const metadata = object.metadata as Record<string, unknown> | undefined;
      await adminRpc<void>('stripe_mark_checkout', {
        p_session_id: object.id,
        p_status: 'completed',
        p_customer_id: stringId(object.customer),
        p_subscription_id: stringId(object.subscription),
        p_attempt_id: typeof metadata?.checkout_attempt_id === 'string'
          ? metadata.checkout_attempt_id
          : null,
      });
      const subscriptionId = stringId(object.subscription);
      if (subscriptionId) {
        const subscription = await retrieveSubscription(subscriptionId);
        await applyLatestPaidInvoice(subscription, mode);
        await syncSubscription(subscription, mode);
      }
      return 'processed';
    }
    case 'checkout.session.expired': {
      const metadata = object.metadata as Record<string, unknown> | undefined;
      await adminRpc<void>('stripe_mark_checkout', {
        p_session_id: object.id,
        p_status: 'expired',
        p_attempt_id: typeof metadata?.checkout_attempt_id === 'string'
          ? metadata.checkout_attempt_id
          : null,
      });
      return 'processed';
    }
    case 'invoice.paid': {
      await applyPaidInvoice(object.id, mode);
      return 'processed';
    }
    case 'invoice.payment_failed':
    case 'invoice.payment_action_required': {
      const invoice = await stripeRequest<StripeObject>(
        `/v1/invoices/${encodeURIComponent(object.id)}`,
        'GET',
      );
      const customerId = stringId(invoice.customer);
      const subscriptionId = getInvoiceSubscriptionId(invoice);
      if (!customerId || !subscriptionId) throw new Error('Failed invoice is missing subscription details.');
      const subscription = await retrieveSubscription(subscriptionId);
      const failedPeriodEnd = unixDate(invoice.period_end);
      if (!failedPeriodEnd) throw new Error('Failed invoice has no billing period.');
      await adminRpc<void>('stripe_record_payment_issue', {
        p_customer_id: customerId,
        p_subscription_id: subscriptionId,
        p_issue: event.type === 'invoice.payment_action_required' ? 'action_required' : 'payment_failed',
        p_stripe_status: typeof subscription.status === 'string' ? subscription.status : 'unknown',
        p_invoice_period_end: failedPeriodEnd,
      });
      return 'processed';
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = await retrieveSubscription(object.id);
      await applyLatestPaidInvoice(subscription, mode);
      await syncSubscription(subscription, mode);
      return 'processed';
    }
    case 'charge.refunded': {
      const paymentIntentId = stringId(object.payment_intent);
      if (paymentIntentId && typeof object.amount_refunded === 'number' && typeof object.amount === 'number') {
        await adminRpc<void>('stripe_record_refund', {
          p_charge_id: object.id,
          p_payment_intent_id: paymentIntentId,
          p_currency: object.currency,
          p_amount_refunded: object.amount_refunded,
          p_charge_amount: object.amount,
        });
      }
      return 'processed';
    }
    case 'charge.dispute.created':
    case 'charge.dispute.closed':
    case 'refund.created':
    case 'refund.updated':
      return 'processed';
    default:
      return 'ignored';
  }
}

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return jsonResponse({ message: 'Método no permitido.' }, 405);

  let eventId = 'unknown';
  try {
    const mode = stripeMode();
    const payload = await request.text();
    const signature = request.headers.get('stripe-signature');
    if (!signature || !(await verifyStripeSignature(payload, signature, requiredEnv('STRIPE_WEBHOOK_SECRET')))) {
      return jsonResponse({ message: 'Firma de Stripe no válida.' }, 400);
    }

    const event = JSON.parse(payload) as StripeObject & {
      type: string;
      livemode: boolean;
      data: { object: StripeObject };
    };
    eventId = event.id;
    if (!eventId || !event.type || event.livemode !== (mode === 'live')) {
      return jsonResponse({ message: 'Evento de Stripe no válido para este entorno.' }, 400);
    }

    const objectId = event.data?.object?.id ?? null;
    const claimed = await adminRpc<boolean>('stripe_claim_event', {
      p_event_id: event.id,
      p_type: event.type,
      p_object_id: objectId,
    });
    if (!claimed) return jsonResponse({ received: true });

    try {
      const result = await processEvent(event, mode);
      await adminRpc<void>('stripe_finish_event', {
        p_event_id: event.id,
        p_status: result,
      });
      return jsonResponse({ received: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Webhook processing failed.';
      await adminRpc<void>('stripe_finish_event', {
        p_event_id: event.id,
        p_status: 'failed',
        p_error: message,
      });
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed.';
    console.error(JSON.stringify({ eventId, operation: 'stripe-webhook', message }));
    return jsonResponse({ message: 'No se pudo procesar el evento de pago.' }, 500);
  }
});
