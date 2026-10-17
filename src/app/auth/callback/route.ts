import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getSafeInternalPath } from '@/lib/navigation';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = getSafeInternalPath(requestUrl.searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (user && user.email_confirmed_at) {
        return NextResponse.redirect(new URL(next, requestUrl.origin));
      }

      return NextResponse.redirect(new URL('/verificar-correo', requestUrl.origin));
    }
  }

  return NextResponse.redirect(new URL('/acceder', requestUrl.origin));
}
