import { NextResponse, type NextRequest } from 'next/server';
/** Exposes the request path to server layouts (for login redirect) and adds baseline security headers. */
export function middleware(req: NextRequest) {
  const h = new Headers(req.headers);
  h.set('x-pathname', req.nextUrl.pathname);
  const res = NextResponse.next({ request: { headers: h } });
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'same-origin');
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  return res;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon|hubfares-logo).*)'] };
