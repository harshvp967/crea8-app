import { NextRequest, NextResponse } from 'next/server';

function backend() {
  return (process.env.BACKEND_INTERNAL_URL || '').replace(/\/$/, '');
}

function country(request: NextRequest) {
  return request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry') || '';
}

function visitor(request: NextRequest) {
  return (request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
}

export async function GET(request: NextRequest, props: { params: Promise<{ action: string }> }) {
  const { action } = await props.params;
  if (action !== 'open') {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }
  const base = backend();
  if (!base) {
    return NextResponse.json(null, { status: 503 });
  }
  const slug = request.nextUrl.searchParams.get('slug') || '';
  const host = request.nextUrl.searchParams.get('host') || '';
  const path = host
    ? `/public/link/host/${encodeURIComponent(host)}`
    : `/public/link/${encodeURIComponent(slug)}`;
  const response = await fetch(`${base}${path}`, { cache: 'no-store' });
  const data = await response.json().catch(() => null);
  return NextResponse.json(data, { status: response.ok ? 200 : response.status });
}

export async function POST(request: NextRequest, props: { params: Promise<{ action: string }> }) {
  const { action } = await props.params;
  if (action !== 'view' && action !== 'click' && action !== 'subscribe' && action !== 'unlock' && action !== 'contact') {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }
  const base = backend();
  if (!base) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  const body = await request.json().catch(() => ({}));
  const ip = visitor(request);
  const response = await fetch(`${base}/public/link/${action}`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'x-link-country': country(request),
      'x-link-ua': request.headers.get('user-agent') || '',
      ...(ip ? { 'x-forwarded-for': ip } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}
