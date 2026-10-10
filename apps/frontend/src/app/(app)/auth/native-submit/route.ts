export const dynamic = 'force-dynamic';

// Native form submit before hydration posts here and stops. The body is
// discarded so a password never lands in a URL or a log line.
function empty() {
  return new Response(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

export function POST() {
  return empty();
}

export function GET() {
  return empty();
}
