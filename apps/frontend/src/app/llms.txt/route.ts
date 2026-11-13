import { MARKETING_ORIGIN, siteStealth } from '@gitroom/frontend/components/layout/site.metadata';

export const dynamic = 'force-dynamic';

const BODY = `# crea8.one

The public site is ${MARKETING_ORIGIN}.

- ${MARKETING_ORIGIN}/
- ${MARKETING_ORIGIN}/pricing
- ${MARKETING_ORIGIN}/privacy
- ${MARKETING_ORIGIN}/terms
- ${MARKETING_ORIGIN}/data-deletion
- ${MARKETING_ORIGIN}/refund-policy
`;

export function GET() {
  if (siteStealth()) {
    return new Response(null, { status: 404 });
  }
  return new Response(BODY, {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
