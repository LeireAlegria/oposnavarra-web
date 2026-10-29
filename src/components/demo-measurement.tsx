'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { trackDemoEvent, type DemoAnalyticsEvent } from '@/lib/demo-analytics';
export function LandingMeasurement() {
  const sent = useRef(false);
  useEffect(() => {
    if (!sent.current) {
      sent.current = true;
      trackDemoEvent({ name: 'landing_view' });
    }
  }, []);
  return null;
}
export function DemoTrackedLink({
  href,
  children,
  className,
  location,
  name = 'try_clicked',
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  location: DemoAnalyticsEvent['location'];
  name?: 'try_clicked' | 'plans_opened' | 'registration_started';
}) {
  return (
    <Link href={href} className={className} onClick={() => trackDemoEvent({ name, location })}>
      {children}
    </Link>
  );
}
