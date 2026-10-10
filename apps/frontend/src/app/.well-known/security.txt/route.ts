export const dynamic = 'force-dynamic';

function contactLine() {
  const raw = (process.env.SECURITY_CONTACT || 'mailto:support@crea8.one').trim();
  if (!raw) {
    return 'mailto:support@crea8.one';
  }
  if (raw.includes(':')) {
    return raw;
  }
  return `mailto:${raw}`;
}

export function GET() {
  const origin = (process.env.FRONTEND_URL || '').trim().replace(/\/+$/, '');
  const lines = [
    `Contact: ${contactLine()}`,
    'Expires: 2027-10-10T23:59:59.000Z',
    'Preferred-Languages: en',
  ];
  if (origin) {
    lines.push(`Canonical: ${origin}/.well-known/security.txt`);
  }
  return new Response(`${lines.join('\n')}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
