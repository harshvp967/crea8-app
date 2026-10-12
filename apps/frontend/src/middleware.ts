import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ALLOWED = new Set([
  'https://crea8.one',
  'https://www.crea8.one',
  'http://crea8.one',
  'http://www.crea8.one',
]);

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const allowed = ALLOWED.has(origin);
  if (request.method === 'OPTIONS') {
    const headers = new Headers();
    if (allowed) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Vary', 'Origin');
      headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Accept');
    }
    return new NextResponse(null, { status: 204, headers });
  }
  const response = NextResponse.next();
  if (allowed) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Vary', 'Origin');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Accept');
  }
  return response;
}

export const config = {
  matcher: ['/api/link/:path*'],
};
