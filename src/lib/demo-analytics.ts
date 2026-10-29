import { z } from 'zod';

const eventSchema = z
  .object({
    name: z.enum([
      'landing_view',
      'try_clicked',
      'demo_started',
      'question_completed',
      'demo_completed',
      'registration_started',
      'registration_completed',
      'result_saved',
      'plans_opened',
    ]),
    landingVersion: z.literal('017-v1'),
    demoVersion: z.number().int().positive().optional(),
    position: z.number().int().min(1).max(5).optional(),
    location: z.enum(['header', 'hero', 'inline', 'closing', 'result', 'plans']).optional(),
    audience: z.enum(['anonymous', 'authenticated', 'internal']).optional(),
    repeated: z.boolean().optional(),
    eventId: z.string().uuid().optional(),
  })
  .strict();
export type DemoAnalyticsEvent = z.infer<typeof eventSchema>;
type Sink = (event: DemoAnalyticsEvent) => void;
let integration: { sink: Sink; hasConsent: () => boolean } | null = null;
// Connect only to the application's consent-aware analytics provider. No provider is installed by this feature.
export function configureDemoAnalytics(sink: Sink, hasConsent: () => boolean) {
  integration = { sink, hasConsent };
  return () => {
    integration = null;
  };
}
export function trackDemoEvent(event: Omit<DemoAnalyticsEvent, 'landingVersion'>) {
  const safe = eventSchema.safeParse({ ...event, landingVersion: '017-v1' });
  if (!safe.success || !integration) return;
  try {
    if (integration.hasConsent()) integration.sink(safe.data);
  } catch {
    /* Measurement must never interrupt practice or authentication. */
  }
}
