import type { ReactNode } from 'react';

import { SiteFrame } from '@/components/site-frame';

export default function MarketingLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <SiteFrame>{children}</SiteFrame>;
}
