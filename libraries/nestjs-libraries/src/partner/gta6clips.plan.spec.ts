import {
  copilotRuntimeUrl,
  grantDecision,
  loginDecision,
  partnerChannelOpen,
  partnerFeatureOpen,
  partnerRouteAllowed,
  paymentDialogFor,
  showSubscribeScreen,
  sidebarAppLocked,
  sidebarPartnerPlan,
  sidebarTier,
} from '@gitroom/nestjs-libraries/partner/gta6clips.plan';
import { GTA6CLIPS_FREE } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';
import {
  badgeRemovalOpen,
  customDomainBillingOpen,
} from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.rules';
import { linkProductOpenForPlan } from '@gitroom/nestjs-libraries/partner/gta6clips.plan';
import { linkFeatureOpen } from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.rules';
import { arrivePartnerLink, completePartnerLink, PartnerStore } from '@gitroom/nestjs-libraries/partner/gta6clips.flow';
import { signGta6clipsToken } from '@gitroom/nestjs-libraries/partner/gta6clips.token';

const SECRET = 'test-link-secret';
const NOW = 1_700_000_000;

function memoryStore(): PartnerStore & {
  grants: Map<string, { sub: string; userId: string; email: string; gta6clipsPlan: 'paid' | 'free'; recordedAt: string }>;
  bySub: Map<string, { userId: string; email: string; organizationId: string }>;
  emails: Map<string, { userId: string; email: string; organizationId: string | null; linkedSub: string | null }>;
} {
  const jtis = new Set<string>();
  const grants = new Map<string, { sub: string; userId: string; email: string; gta6clipsPlan: 'paid' | 'free'; recordedAt: string }>();
  const bySub = new Map<string, { userId: string; email: string; organizationId: string }>();
  const emails = new Map<string, { userId: string; email: string; organizationId: string | null; linkedSub: string | null }>();
  const pending = new Map<string, { id: string; jti: string; sub: string; email: string; video: string | null; caption: string; expiresAt: Date; gta6clipsPlan: 'paid' | 'free' }>();
  const store: PartnerStore = {
    async jtiUsed(jti) {
      return jtis.has(jti);
    },
    async saveJti(row) {
      if (jtis.has(row.jti)) {
        return 'replay';
      }
      jtis.add(row.jti);
      return 'saved';
    },
    async attachJti() {},
    async findBySub(sub) {
      return bySub.get(sub) || null;
    },
    async findByEmail(email) {
      return emails.get(email) || null;
    },
    async createAccount(input) {
      const userId = `user-${bySub.size + 1}`;
      const organizationId = `org-${bySub.size + 1}`;
      bySub.set(input.sub, { userId, email: input.email, organizationId });
      emails.set(input.email, { userId, email: input.email, organizationId, linkedSub: input.sub });
      return { userId, organizationId };
    },
    async grant(input) {
      const org = grants.get(input.organizationId);
      const sub = bySub.get(input.sub);
      const decision = grantDecision(
        input.organizationId,
        input.sub,
        org ? { sub: org.sub } : null,
        sub ? { organizationId: sub.organizationId } : null
      );
      if (decision === 'reject') {
        return 'rejected';
      }
      grants.set(input.organizationId, {
        sub: input.sub,
        userId: input.userId,
        email: input.email,
        gta6clipsPlan: input.gta6clipsPlan,
        recordedAt: input.recordedAt.toISOString(),
      });
      bySub.set(input.sub, {
        userId: input.userId,
        email: input.email,
        organizationId: input.organizationId,
      });
      return decision === 'idempotent' ? 'idempotent' : 'granted';
    },
    async savePending(row) {
      pending.set(row.id, row);
    },
    async readPending(id, now) {
      const row = pending.get(id);
      if (!row || row.expiresAt.getTime() <= now.getTime()) {
        return null;
      }
      return row;
    },
  };
  return Object.assign(store, { grants, bySub, emails });
}

function link(overrides: Record<string, unknown> = {}) {
  return signGta6clipsToken(
    {
      sub: 'member-1',
      email: 'ada@example.com',
      jti: 'jti-1',
      iat: NOW,
      exp: NOW + 600,
      ...overrides,
    } as never,
    SECRET
  );
}

describe('gta6clips plan', () => {
  const previous = process.env.BILLING_ENABLED;
  afterEach(() => {
    if (previous === undefined) {
      delete process.env.BILLING_ENABLED;
    } else {
      process.env.BILLING_ENABLED = previous;
    }
  });

  it('grants once for the same sub and workspace and stops a second sub', () => {
    expect(grantDecision('org-1', 'member-1', null, null)).toBe('grant');
    expect(grantDecision('org-1', 'member-1', { sub: 'member-1' }, { organizationId: 'org-1' })).toBe('idempotent');
    expect(grantDecision('org-1', 'member-2', { sub: 'member-1' }, null)).toBe('reject');
    expect(GTA6CLIPS_FREE.channels).toBe(3);
    expect(partnerChannelOpen(2)).toBe(true);
    expect(partnerChannelOpen(3)).toBe(false);
  });

  it('locks every feature except the scheduler and Link in Bio', () => {
    expect(partnerFeatureOpen('compose')).toBe(true);
    expect(partnerFeatureOpen('schedule')).toBe(true);
    expect(partnerFeatureOpen('calendar')).toBe(true);
    expect(partnerFeatureOpen('link')).toBe(true);
    expect(partnerFeatureOpen('stalker')).toBe(false);
    expect(partnerRouteAllowed('GET', '/posts')).toBe(true);
    expect(partnerRouteAllowed('GET', '/link-in-bio')).toBe(true);
    expect(partnerRouteAllowed('GET', '/idea-posts')).toBe(false);
    expect(partnerRouteAllowed('POST', '/media/generate-image')).toBe(false);
    expect(partnerRouteAllowed('POST', '/integrations/social-connect/tiktok')).toBe(true);
    expect(partnerRouteAllowed('POST', '/integrations/social-connect/x')).toBe(false);
    expect(partnerRouteAllowed('GET', '/analytics')).toBe(false);
    expect(partnerRouteAllowed('POST', '/billing/checkout')).toBe(false);
    expect(partnerRouteAllowed('POST', '/sets')).toBe(false);
  });

  it('keeps Link in Bio free when billing is on, with the badge and custom domain locked', () => {
    process.env.BILLING_ENABLED = 'true';
    expect(linkProductOpenForPlan('gta6clips_free', linkFeatureOpen(null))).toBe(true);
    expect(badgeRemovalOpen('org-1', null, 'gta6clips_free')).toBe(false);
    expect(
      customDomainBillingOpen(
        'org-1',
        { subscriptionTier: 'PRO' },
        { customDomainAddon: true },
        'gta6clips_free'
      )
    ).toBe(false);
    expect(badgeRemovalOpen('org-1', { subscriptionTier: 'STANDARD' })).toBe(true);
  });

  it('keeps the badge and custom domain locked while billing is off', () => {
    delete process.env.BILLING_ENABLED;
    expect(badgeRemovalOpen('org-1', null, 'gta6clips_free')).toBe(false);
    expect(
      customDomainBillingOpen('org-1', null, { customDomainAddon: true }, 'gta6clips_free')
    ).toBe(false);
    expect(badgeRemovalOpen('org-1', null)).toBe(true);
  });
});

describe('gta6clips compose shell', () => {
  const search = 'partner=gta6clips&video=https%3A%2F%2Fgta6clips.app%2Fa.mp4&caption=hello&token=once';

  it('an existing partner org with no subscription lands on compose with no paywall', () => {
    expect(
      showSubscribeScreen({
        tier: 'gta6clips_free',
        partnerPlan: 'gta6clips_free',
        pathname: '/compose',
        search,
        billingOn: true,
      })
    ).toBe(false);
    expect(sidebarTier('gta6clips_free', 'gta6clips_free')).toBe('gta6clips_free');
    expect(sidebarAppLocked(sidebarTier('gta6clips_free', 'gta6clips_free'), sidebarPartnerPlan('gta6clips_free', 'gta6clips_free'), '/schedule', 'schedule', true)).toBe(false);
    expect(sidebarAppLocked(sidebarTier('gta6clips_free', 'gta6clips_free'), sidebarPartnerPlan('gta6clips_free', 'gta6clips_free'), '/stalker/mentions', 'stalker', true)).toBe(true);
    expect(copilotRuntimeUrl('gta6clips_free', 'gta6clips_free', 'https://api.crea8.one')).toBeNull();
    expect(paymentDialogFor(402, { locked: true })).toBe(false);
  });

  it('a gta6clips_free layout makes no copilot request and a locked background 402 shows no dialog', () => {
    expect(copilotRuntimeUrl('gta6clips_free', null, 'https://api.crea8.one')).toBeNull();
    expect(copilotRuntimeUrl('FREE', null, 'https://api.crea8.one')).toBe('https://api.crea8.one/copilot/chat');
    expect(paymentDialogFor(402, { locked: true })).toBe(false);
    expect(paymentDialogFor(402, { locked: false })).toBe(true);
    expect(paymentDialogFor(402, null)).toBe(true);
    expect(paymentDialogFor(200, { locked: true })).toBe(false);
  });

  it('a normal free signup still sees the subscribe screen and both locks', () => {
    expect(
      showSubscribeScreen({
        tier: 'FREE',
        partnerPlan: null,
        pathname: '/schedule',
        search: '',
        billingOn: true,
      })
    ).toBe(true);
    expect(sidebarAppLocked('FREE', null, '/schedule', 'schedule', true)).toBe(true);
    expect(sidebarAppLocked('FREE', null, '/stalker/mentions', 'stalker', true)).toBe(true);
  });
});

describe('gta6clips silent login', () => {
  it('creates a passwordless account and grants the plan for a paid claim', async () => {
    const store = memoryStore();
    const result = await arrivePartnerLink(
      { token: link({ gta6clips_plan: 'paid' }), secret: SECRET, caption: 'hello', video: 'https://gta6clips.app/a.mp4', nowSec: NOW + 5 },
      store
    );
    expect(result).toMatchObject({ status: 'session', grant: true, created: true, caption: 'hello', video: 'https://gta6clips.app/a.mp4' });
    expect(store.grants.get('org-1')).toMatchObject({
      sub: 'member-1',
      gta6clipsPlan: 'paid',
      recordedAt: new Date((NOW + 5) * 1000).toISOString(),
    });
  });

  it('logs in again for the same sub and email', async () => {
    const store = memoryStore();
    await arrivePartnerLink(
      { token: link({ gta6clips_plan: 'paid' }), secret: SECRET, nowSec: NOW + 5 },
      store
    );
    const again = await arrivePartnerLink(
      { token: link({ jti: 'jti-2', gta6clips_plan: 'paid' }), secret: SECRET, nowSec: NOW + 6 },
      store
    );
    expect(again).toMatchObject({ status: 'session', grant: true, created: false });
    expect(store.grants.size).toBe(1);
  });

  it('requires a normal login when the email already belongs to someone else', async () => {
    const store = memoryStore();
    store.emails.set('ada@example.com', {
      userId: 'user-existing',
      email: 'ada@example.com',
      organizationId: 'org-existing',
      linkedSub: null,
    });
    const result = await arrivePartnerLink(
      { token: link({ gta6clips_plan: 'paid' }), secret: SECRET, nowSec: NOW + 5 },
      store
    );
    expect(result.status).toBe('collision');
    if (result.status !== 'collision') {
      return;
    }
    const linked = await completePartnerLink(
      {
        pendingId: result.pendingId,
        userId: 'user-existing',
        email: 'ada@example.com',
        organizationId: 'org-existing',
        now: new Date((NOW + 5) * 1000),
      },
      store
    );
    expect(linked).toMatchObject({ status: 'session', grant: true, organizationId: 'org-existing' });
    expect(store.grants.get('org-existing')?.gta6clipsPlan).toBe('paid');
    const takeover = await completePartnerLink(
      {
        pendingId: result.pendingId,
        userId: 'other',
        email: 'other@example.com',
        organizationId: 'org-other',
        now: new Date((NOW + 5) * 1000),
      },
      store
    );
    expect(takeover.status).toBe('refused');
  });

  it('rejects a replayed link and a second sub on the same workspace', async () => {
    const store = memoryStore();
    const first = await arrivePartnerLink(
      { token: link(), secret: SECRET, nowSec: NOW + 5 },
      store
    );
    expect(first.status).toBe('session');
    const replay = await arrivePartnerLink(
      { token: link(), secret: SECRET, nowSec: NOW + 5 },
      store
    );
    expect(replay).toMatchObject({ status: 'replay', grant: false });
    store.emails.set('bee@example.com', {
      userId: 'user-bee',
      email: 'bee@example.com',
      organizationId: 'org-1',
      linkedSub: null,
    });
    const second = await arrivePartnerLink(
      { token: link({ sub: 'member-2', email: 'bee@example.com', jti: 'jti-9' }), secret: SECRET, nowSec: NOW + 5 },
      store
    );
    expect(second.status).toBe('collision');
    if (second.status !== 'collision') {
      return;
    }
    const attached = await completePartnerLink(
      {
        pendingId: second.pendingId,
        userId: 'user-bee',
        email: 'bee@example.com',
        organizationId: 'org-1',
        now: new Date((NOW + 5) * 1000),
      },
      store
    );
    expect(attached.status).toBe('refused');
    expect(store.grants.get('org-1')?.sub).toBe('member-1');
  });

  it('a free claim signs in and stores free', async () => {
    const store = memoryStore();
    const result = await arrivePartnerLink(
      {
        token: link({ gta6clips_plan: 'free' }),
        secret: SECRET,
        caption: 'clip',
        video: 'https://gta6clips.app/a.mp4',
        nowSec: NOW + 5,
      },
      store
    );
    expect(result).toMatchObject({
      status: 'session',
      caption: 'clip',
      video: 'https://gta6clips.app/a.mp4',
    });
    expect(store.grants.get('org-1')?.gta6clipsPlan).toBe('free');
  });

  it('a missing claim signs in and stores free', async () => {
    const store = memoryStore();
    const result = await arrivePartnerLink(
      { token: link(), secret: SECRET, caption: 'clip', video: 'https://gta6clips.app/a.mp4', nowSec: NOW + 5 },
      store
    );
    expect(result.status).toBe('session');
    expect(store.grants.get('org-1')?.gta6clipsPlan).toBe('free');
  });

  it('any other gta6clips_plan value signs in and stores free', async () => {
    const store = memoryStore();
    const result = await arrivePartnerLink(
      { token: link({ gta6clips_plan: 'pro' }), secret: SECRET, nowSec: NOW + 5 },
      store
    );
    expect(result.status).toBe('session');
    expect(store.grants.get('org-1')?.gta6clipsPlan).toBe('free');
  });

  it('a later free token revokes a paid perk', async () => {
    const store = memoryStore();
    await arrivePartnerLink(
      { token: link({ gta6clips_plan: 'paid' }), secret: SECRET, nowSec: NOW + 5 },
      store
    );
    expect(store.grants.get('org-1')?.gta6clipsPlan).toBe('paid');
    const again = await arrivePartnerLink(
      { token: link({ jti: 'jti-free', gta6clips_plan: 'free' }), secret: SECRET, nowSec: NOW + 8 },
      store
    );
    expect(again).toMatchObject({ status: 'session', created: false });
    expect(store.grants.get('org-1')).toMatchObject({
      gta6clipsPlan: 'free',
      recordedAt: new Date((NOW + 8) * 1000).toISOString(),
    });
  });

  it('opens compose and grants nothing when the secret is missing', async () => {
    const store = memoryStore();
    const result = await arrivePartnerLink(
      { token: link(), secret: '', caption: 'still here', video: 'https://gta6clips.app/a.mp4' },
      store
    );
    expect(result).toMatchObject({ status: 'disabled', grant: false, caption: 'still here', video: 'https://gta6clips.app/a.mp4' });
    expect(store.grants.size).toBe(0);
    expect(loginDecision({ sub: 'a', email: 'a@b.c', bySub: null, byEmail: null })).toBe('create');
  });
});
