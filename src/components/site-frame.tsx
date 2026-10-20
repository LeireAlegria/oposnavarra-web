import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { createClient } from '@/lib/supabase/server';

export async function SiteFrame({ children }: Readonly<{ children: ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user && user.email_confirmed_at);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader isAuthenticated={isAuthenticated} />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
