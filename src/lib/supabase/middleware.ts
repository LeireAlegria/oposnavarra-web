import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

import { getSupabaseConfig } from './config';

export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = getSupabaseConfig();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const protectedPaths = ['/plataforma', '/admin'];
  const authPaths = ['/acceder', '/registro', '/recuperar-contrasena', '/nueva-contrasena', '/verificar-correo'];

  if (protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    if (error || !user) {
      return NextResponse.redirect(new URL('/acceder', request.url));
    }

    if (!user.email_confirmed_at) {
      return NextResponse.redirect(
        new URL(`/verificar-correo?email=${encodeURIComponent(user.email ?? '')}`, request.url),
      );
    }

    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      const { data: profile, error: profileError } = await supabase
        .from('perfiles')
        .select('rol')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || !profile || profile.rol !== 'admin') {
        return NextResponse.redirect(new URL('/plataforma', request.url));
      }
    }
  }

  if (authPaths.includes(pathname) && user && user.email_confirmed_at) {
    return NextResponse.redirect(new URL('/plataforma', request.url));
  }

  return response;
}
