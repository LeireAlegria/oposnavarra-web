import {
  adminRequest,
  authenticateUser,
  handleOptions,
  jsonResponse,
  requiredEnv,
  stripeMode,
  stripeRequest,
  type StripeObject,
} from '../_shared/stripe.ts';

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return jsonResponse({ message: 'Método no permitido.' }, 405);

  try {
    const user = await authenticateUser(request);
    const mode = stripeMode();
    const mappingResponse = await adminRequest(
      `stripe_customers?usuario_id=eq.${encodeURIComponent(user.id)}&stripe_mode=eq.${mode}&select=stripe_customer_id`,
    );
    if (!mappingResponse.ok) throw new Error('Unable to retrieve Stripe customer mapping.');
    const mappings = (await mappingResponse.json()) as Array<{ stripe_customer_id: string }>;
    const customerId = mappings[0]?.stripe_customer_id;
    if (!customerId) return jsonResponse({ message: 'No hay una suscripción de Stripe que gestionar.' }, 404);

    const siteUrl = new URL(requiredEnv('SITE_URL'));
    const configuration = requiredEnv('STRIPE_PORTAL_CONFIGURATION_ID');
    const parameters = new URLSearchParams({
      customer: customerId,
      configuration,
      return_url: new URL('/plataforma?portal=returned', siteUrl).toString(),
    });
    const session = await stripeRequest<StripeObject & { url?: string }>(
      '/v1/billing_portal/sessions',
      'POST',
      parameters,
      `portal-${mode}-${user.id}-${crypto.randomUUID()}`,
    );
    if (!session.url || !session.url.startsWith('https://billing.stripe.com/')) {
      throw new Error('Stripe did not provide a valid portal URL.');
    }
    return jsonResponse({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The portal session could not be created.';
    console.error(JSON.stringify({ operation: 'create-portal-session', message }));
    if (message.includes('Authentication required')) return jsonResponse({ message: 'Inicia sesión para continuar.' }, 401);
    if (message.includes('verified email')) return jsonResponse({ message: 'Verifica tu correo antes de continuar.' }, 403);
    return jsonResponse({ message: 'No se pudo abrir la gestión de pagos. Inténtalo de nuevo.' }, 400);
  }
});
