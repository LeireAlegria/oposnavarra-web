import { describe, expect, it } from 'vitest';

import {
  createStripeSignature,
  verifyStripeSignature,
} from '../../supabase/functions/_shared/stripe-signature';

describe('Stripe webhook signature verification', () => {
  it('accepts the original signed payload within the timestamp tolerance', async () => {
    const payload = '{"id":"evt_test","type":"invoice.paid"}';
    const timestamp = 1_800_000_000;
    const signature = await createStripeSignature(payload, 'whsec_test_secret', timestamp);

    await expect(verifyStripeSignature(payload, signature, 'whsec_test_secret', timestamp)).resolves.toBe(true);
  });

  it('rejects a changed payload', async () => {
    const timestamp = 1_800_000_000;
    const signature = await createStripeSignature('{"id":"evt_test"}', 'whsec_test_secret', timestamp);

    await expect(
      verifyStripeSignature('{"id":"evt_other"}', signature, 'whsec_test_secret', timestamp),
    ).resolves.toBe(false);
  });

  it('rejects signatures outside the timestamp tolerance', async () => {
    const timestamp = 1_800_000_000;
    const signature = await createStripeSignature('{}', 'whsec_test_secret', timestamp);

    await expect(verifyStripeSignature('{}', signature, 'whsec_test_secret', timestamp + 301)).resolves.toBe(false);
  });
});
