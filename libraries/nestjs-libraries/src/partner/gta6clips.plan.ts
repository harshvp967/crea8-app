import {
  CREA8_PRICING_URL,
  GTA6CLIPS_FREE,
  GTA6CLIPS_PLAN_ID,
  billingPaywallForTier,
  gta6clipsProviderAllowed,
  isGta6clipsPlan,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';

export { CREA8_PRICING_URL, GTA6CLIPS_PLAN_ID, isGta6clipsPlan };

export function partnerChannelOpen(activeCount: number) {
  return activeCount < GTA6CLIPS_FREE.channels;
}

export function partnerProviderOpen(identifier: string) {
  return gta6clipsProviderAllowed(identifier);
}

const OPEN = new Set<string>(GTA6CLIPS_FREE.open);

export function partnerFeatureOpen(feature: string) {
  return OPEN.has(feature);
}

export function linkProductOpenForPlan(plan: string | null | undefined, fallbackOpen: boolean) {
  if (isGta6clipsPlan(plan)) {
    return true;
  }
  return fallbackOpen;
}

export function partnerHref(plan: string | null | undefined, path: string) {
  return partnerSurfaceLocked(plan, path) ? CREA8_PRICING_URL : path;
}

export function showSubscribeScreen(input: {
  tier?: string | null;
  partnerPlan?: string | null;
  pathname: string;
  search: string;
  billingOn: boolean;
}) {
  if (isGta6clipsPlan(input.partnerPlan) || isGta6clipsPlan(input.tier)) {
    return false;
  }
  const path = (input.pathname || '/').replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(
    input.search.startsWith('?') ? input.search.slice(1) : input.search
  );
  if (
    path === '/compose' &&
    (params.has('token') ||
      params.has('pending') ||
      params.has('connect') ||
      params.get('partner') === 'gta6clips')
  ) {
    return false;
  }
  return input.billingOn && billingPaywallForTier(input.tier);
}

export function copilotRuntimeUrl(
  tier: string | null | undefined,
  partnerPlan: string | null | undefined,
  backendUrl: string
) {
  if (isGta6clipsPlan(tier) || isGta6clipsPlan(partnerPlan)) {
    return null;
  }
  return `${backendUrl}/copilot/chat`;
}

export function paymentDialogFor(status: number, body: { locked?: boolean } | null) {
  if (status !== 402) {
    return false;
  }
  return body?.locked !== true;
}

export function sidebarTier(
  tier: string | null | undefined,
  partnerPlan: string | null | undefined
) {
  if (isGta6clipsPlan(partnerPlan) || isGta6clipsPlan(tier)) {
    return GTA6CLIPS_PLAN_ID;
  }
  return tier;
}

export function sidebarPartnerPlan(
  tier: string | null | undefined,
  partnerPlan: string | null | undefined
) {
  if (isGta6clipsPlan(partnerPlan)) {
    return partnerPlan;
  }
  if (isGta6clipsPlan(tier) || isGta6clipsPlan(sidebarTier(tier, partnerPlan))) {
    return GTA6CLIPS_PLAN_ID;
  }
  return partnerPlan;
}

export function sidebarAppLocked(
  tier: string | null | undefined,
  partnerPlan: string | null | undefined,
  href: string,
  id: string,
  billingOn: boolean
) {
  const planLocked = billingOn && billingPaywallForTier(tier);
  return (
    partnerSurfaceLocked(partnerPlan, href) ||
    (planLocked && (id === 'schedule' || id === 'stalker'))
  );
}

export function partnerSurfaceLocked(plan: string | null | undefined, path: string) {
  if (!isGta6clipsPlan(plan)) {
    return false;
  }
  const bare = path.split('?')[0].replace(/\/+$/, '') || '/';
  if (bare === '/schedule' || bare === '/compose' || bare === '/pricing') {
    return false;
  }
  if (
    bare === '/linkinbio' ||
    bare.startsWith('/linkinbio/') ||
    bare === '/link' ||
    bare.startsWith('/link/')
  ) {
    return false;
  }
  return true;
}

export function partnerRouteAllowed(method: string, path: string) {
  const bare = path.split('?')[0].replace(/\/+$/, '') || '/';
  const verb = method.toUpperCase();
  if (
    bare === '/analytics' ||
    bare.startsWith('/analytics/') ||
    bare === '/stalker' ||
    bare.startsWith('/stalker/') ||
    bare === '/copilot' ||
    bare.startsWith('/copilot/') ||
    bare === '/autopost' ||
    bare.startsWith('/autopost/') ||
    bare === '/third-party' ||
    bare.startsWith('/third-party/') ||
    bare === '/webhooks' ||
    bare.startsWith('/webhooks/') ||
    bare === '/billing' ||
    bare.startsWith('/billing/') ||
    bare === '/payment' ||
    bare.startsWith('/payment/') ||
    bare === '/stripe' ||
    bare.startsWith('/stripe/') ||
    bare === '/clipping' ||
    bare.startsWith('/clipping/') ||
    bare.startsWith('/idea-posts') ||
    bare.startsWith('/brand') ||
    bare.startsWith('/agents') ||
    bare.startsWith('/signatures') ||
    bare.startsWith('/admin') ||
    bare.startsWith('/enterprise') ||
    bare.startsWith('/media/generate') ||
    bare.includes('/plug')
  ) {
    return false;
  }
  if (bare === '/sets' || bare.startsWith('/sets/')) {
    return verb === 'GET' || verb === 'HEAD';
  }
  const connect = bare.match(/^\/integrations\/social-connect\/([^/]+)$/);
  if (connect) {
    return partnerProviderOpen(connect[1]);
  }
  const oauth = bare.match(/^\/integrations\/social\/([^/]+)$/);
  if (oauth) {
    return partnerProviderOpen(oauth[1]);
  }
  if (bare.startsWith('/schedule/agents') || bare.startsWith('/schedule/analytics') || bare.startsWith('/schedule/plugs') || bare.startsWith('/schedule/integrations')) {
    return false;
  }
  return true;
}

export type GrantRow = { sub: string; organizationId: string };

export function grantDecision(
  organizationId: string,
  sub: string,
  existingForOrg: { sub: string } | null,
  existingForSub: { organizationId: string } | null
): 'grant' | 'idempotent' | 'reject' {
  if (existingForOrg?.sub === sub || existingForSub?.organizationId === organizationId) {
    return 'idempotent';
  }
  if (existingForOrg || existingForSub) {
    return 'reject';
  }
  return 'grant';
}

export type EmailRow = {
  userId: string;
  email: string;
  organizationId: string | null;
  linkedSub: string | null;
};

export function loginDecision(input: {
  sub: string;
  email: string;
  bySub: { userId: string; email: string; organizationId: string } | null;
  byEmail: EmailRow | null;
}): 'create' | 'login' | 'collision' | 'refuse' {
  if (input.bySub) {
    return input.bySub.email.toLowerCase() === input.email.toLowerCase() ? 'login' : 'refuse';
  }
  if (input.byEmail) {
    return input.byEmail.linkedSub === input.sub ? 'login' : 'collision';
  }
  return 'create';
}
