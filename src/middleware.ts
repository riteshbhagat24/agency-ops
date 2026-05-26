import { NextResponse, type NextRequest } from 'next/server';
import { updateSupabaseSession } from '@/lib/supabase/middleware';

const PUBLIC_ROUTES = ['/login', '/auth/callback', '/api/health'];
const PUBLIC_PREFIXES = ['/_next', '/static', '/favicon', '/api/webhooks'];

function isPublic(path: string) {
  return (
    PUBLIC_ROUTES.includes(path) ||
    PUBLIC_PREFIXES.some((p) => path.startsWith(p))
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always refresh session cookies
  const { response, user } = await updateSupabaseSession(request);

  if (isPublic(pathname)) return response;

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Optional: enforce allowed email domains here as a soft guard.
  const allowed = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (allowed.length && user.email) {
    const domain = user.email.split('@')[1]?.toLowerCase();
    if (!domain || !allowed.includes(domain)) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('error', 'unauthorized_domain');
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
