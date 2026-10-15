import { NextResponse } from 'next/server';

function backend() {
  return (process.env.BACKEND_INTERNAL_URL || '').replace(/\/$/, '');
}

export async function GET() {
  const base = backend();
  if (!base) {
    return NextResponse.json({ slugs: [] }, { status: 503 });
  }
  try {
    const response = await fetch(`${base}/public/links`, { cache: 'no-store' });
    const data = await response.json().catch(() => null);
    const slugs = Array.isArray(data?.slugs)
      ? data.slugs.filter((slug: unknown) => typeof slug === 'string')
      : [];
    return NextResponse.json({ slugs }, { status: response.ok ? 200 : response.status });
  } catch {
    return NextResponse.json({ slugs: [] }, { status: 502 });
  }
}
