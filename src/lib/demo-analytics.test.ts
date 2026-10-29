import { afterEach, expect, it, vi } from 'vitest';
import { configureDemoAnalytics, trackDemoEvent, type DemoAnalyticsEvent } from './demo-analytics';
let disconnect = () => {};
afterEach(() => disconnect());
it('sends nothing before consent and excludes secrets or unknown payload fields', () => {
  const sink = vi.fn();
  trackDemoEvent({ name: 'demo_started' });
  expect(sink).not.toHaveBeenCalled();
  let consent = false;
  disconnect = configureDemoAnalytics(sink, () => consent);
  trackDemoEvent({ name: 'demo_started' });
  expect(sink).not.toHaveBeenCalled();
  consent = true;
  trackDemoEvent({
    name: 'demo_completed',
    demoVersion: 2,
    eventId: '00000000-0000-4000-8000-000000000001',
  });
  expect(sink).toHaveBeenCalledWith({
    name: 'demo_completed',
    demoVersion: 2,
    eventId: '00000000-0000-4000-8000-000000000001',
    landingVersion: '017-v1',
  });
  trackDemoEvent({ name: 'demo_started', token: 'secret' } as unknown as DemoAnalyticsEvent);
  expect(sink).toHaveBeenCalledTimes(1);
});
it('isolates analytics provider failures from the user flow', () => {
  disconnect = configureDemoAnalytics(
    () => {
      throw new Error('offline');
    },
    () => true,
  );
  expect(() => trackDemoEvent({ name: 'landing_view' })).not.toThrow();
});
