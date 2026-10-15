# Stripe payments

OposNavarra uses Stripe Checkout for recurring card payments, Stripe Billing for renewals, and the Stripe Customer Portal for payment-method, invoice, and end-of-period cancellation management. Supabase remains the source of truth for access. A successful return URL or `checkout.session.completed` event never grants access; a validated, paid invoice does.

The Stripe REST API and webhook endpoint are pinned to `2026-09-30.endive`. The integration uses Supabase Edge Functions and does not add a separate application server or persist card details.

## Before connecting Stripe

1. Keep test and production credentials in separate deployments. Set `STRIPE_MODE=test` with a test secret key or `STRIPE_MODE=live` with a live secret key; the function rejects a key whose prefix does not match the mode.
2. In Stripe, create one Product and recurring EUR Price for each plan:
   - Mensual: 1,500 EUR cents, monthly.
   - Semestral: 7,900 EUR cents, every six months.
   - Anual: 12,000 EUR cents, yearly.
   Prices must not add a tax or surcharge to the amount shown by the application. Validate the applicable tax configuration before enabling production.
3. Save each environment's Product and Price IDs in its plan row. Do this through the Supabase SQL editor using the values from that same Stripe environment:

   ```sql
   UPDATE public.planes
   SET stripe_product_test = '<test_product_id>',
       stripe_price_test = '<test_price_id>'
   WHERE codigo = 'mensual';

   UPDATE public.planes
   SET stripe_product_test = '<test_product_id>',
       stripe_price_test = '<test_price_id>'
   WHERE codigo = 'semestral';

   UPDATE public.planes
   SET stripe_product_test = '<test_product_id>',
       stripe_price_test = '<test_price_id>'
   WHERE codigo = 'anual';
   ```

   Replace the placeholders and use `stripe_product_live` / `stripe_price_live` for the production deployment. Unique indexes prevent mapping one Price to more than one plan in the same environment. Until a Price is configured, Checkout fails closed.
4. Create a Stripe Customer Portal configuration that permits payment-method updates, invoice history, and cancellation at the end of the current period. Disable plan changes, pauses, and immediate cancellation. Use that configuration's ID as `STRIPE_PORTAL_CONFIGURATION_ID`.
5. Configure the Stripe webhook endpoint at:

   ```text
   https://<project-ref>.supabase.co/functions/v1/stripe-webhook
   ```

   Pin the endpoint's event API version to `2026-09-30.endive` and subscribe to:
   `checkout.session.completed`, `checkout.session.expired`, `invoice.paid`,
   `invoice.payment_failed`, `invoice.payment_action_required`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `charge.refunded`,
   `charge.dispute.created`, `charge.dispute.closed`, `refund.created`, and
   `refund.updated`.

## Secrets and deployment

Set Edge Function secrets in the Supabase project. Do not place Stripe secrets or the Supabase service-role key in `NEXT_PUBLIC_*`, source control, client bundles, or logs:

```powershell
npx supabase secrets set STRIPE_MODE=test STRIPE_SECRET_KEY=<test_secret_key> STRIPE_WEBHOOK_SECRET=<test_webhook_secret> STRIPE_PORTAL_CONFIGURATION_ID=<portal_configuration_id> SITE_URL=https://<application-host>
npx supabase db push
npx supabase functions deploy create-checkout-session
npx supabase functions deploy create-portal-session
npx supabase functions deploy stripe-webhook
npx supabase functions deploy stripe-reconcile
```

Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Never add the service-role key to the web application environment. The webhook is the only function configured with `verify_jwt = false`; it verifies Stripe's signature over the exact raw request body and rejects timestamps outside a five-minute tolerance. Checkout, portal, and reconciliation require a Supabase user JWT.

For local development, use Stripe test-mode credentials and the webhook signing secret printed by `stripe listen`. Do not use real cards or live keys for verification. Test the monthly, six-month, and yearly recurring Prices, authentication-required payments, failed payments, cancellation at period end, and refunds using Stripe test data and Test Clocks.

## Processing and recovery

- Each Checkout reservation is serialized per user in PostgreSQL. A reservation has a stable Stripe idempotency key and a matching Stripe expiry, so concurrent requests reuse the same session. Before replacing a session whose expiry has passed, the function retrieves its current Stripe status; a completed session is never treated as an abandoned checkout.
- Webhook IDs are unique. Events move through `received`, `processing`, `processed`, `ignored`, and `failed`; duplicate deliveries do not repeat invoice application. A failed or stale processing event can be retried. Database changes for an invoice and its subscription period are performed in one PostgreSQL transaction.
- Subscription lifecycle events only synchronize Stripe status and cancellation intent. They do not extend the paid period. Invoice periods come from the verified Stripe invoice lines; the subscription period advances only for a matching EUR Price and amount.
- A full refund is stored against its charge and invoice. A full refund of the currently covered invoice stops access; partial refunds and disputes are recorded without automatically changing access.
- Stripe automatically retries webhook deliveries. To recover a failed delivery, use Stripe Workbench's event delivery retry or call the admin-only `stripe-reconcile` Edge Function with the event ID. The function fetches the event from Stripe and sends it through the same signed, idempotent webhook processor.
- To reconcile a subscription's current Stripe state, an authenticated administrator may call `stripe-reconcile` with its Stripe Subscription ID. The function reads the subscription and latest invoice from Stripe; only a paid, matching invoice can apply or extend access. It never accepts a Customer ID, amount, invoice status, or period from the caller.
- Reconciliation is an operational action, not exposed in the customer UI. Review the Stripe Dashboard and the `stripe_webhook_events` / `stripe_invoices` rows before and after recovery. Do not manually change subscription status or period dates in the database.

Example admin-only event retry (run from a trusted terminal; use an administrator access token and never store it in a script):

```powershell
curl.exe -X POST "https://<project-ref>.supabase.co/functions/v1/stripe-reconcile" `
  -H "Authorization: Bearer <admin_access_token>" `
  -H "apikey: <publishable_key>" `
  -H "Content-Type: application/json" `
  -d "{\"stripeEventId\":\"evt_...\"}"
```

For a subscription reconciliation, send `{"subscriptionId":"sub_..."}` instead. The function checks `public.perfiles.rol` on the server; a non-admin receives `403`.

## Production gate

Keep `STRIPE_MODE=test` until all three plans, webhook signing, payment failures and recovery, portal cancellation, access expiration, duplicate webhook delivery, full/partial refunds, and admin reconciliation have been verified in Stripe test mode. Before switching to `live`, verify the live Price IDs, portal configuration, webhook secret and endpoint version independently, and obtain an explicit decision on tax treatment. The integration has no grace period and does not grant access based on a browser redirect.
