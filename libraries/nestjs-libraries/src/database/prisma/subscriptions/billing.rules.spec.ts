import { createHmac } from 'crypto';
import {
  CREDIT_COSTS,
  PLANS,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';
import {
  badgeRemovalOpen,
  customDomainBillingOpen,
} from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.rules';
import {
  AI_POST_CALL_REASON,
  AI_POST_REASON,
  MemoryWebhookStore,
  applyWebhookOnce,
  aiPostCharge,
  canAddTeamMember,
  canConnectChannel,
  creditUsage,
  emptyBillingSnapshot,
  ledgerRowsForHistory,
  planSpend,
  postableChannelIds,
  postsCovered,
  reduceBillingEvent,
  stalkerReadCost,
  verifyDodoSignature,
  xPostCost,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.rules';

const SECRET = 'whsec_' + Buffer.from('test-webhook-secret').toString('base64');

function sign(id: string, timestamp: string, body: string, secret = SECRET) {
  const key = Buffer.from(secret.slice('whsec_'.length), 'base64');
  const mac = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64');
  return `v1,${mac}`;
}

describe('dodo webhook signatures', () => {
  const now = 1_700_000_000_000;
  const body = JSON.stringify({ type: 'subscription.active' });

  it('rejects a request with no signature headers', () => {
    expect(() =>
      verifyDodoSignature(Buffer.from(body), {}, SECRET, now)
    ).toThrow(/signature/i);
  });

  it('rejects a signature that does not match', () => {
    expect(() =>
      verifyDodoSignature(
        Buffer.from(body),
        {
          'webhook-id': 'msg_1',
          'webhook-timestamp': String(Math.floor(now / 1000)),
          'webhook-signature': 'v1,bm90LWEtcmVhbC1zaWduYXR1cmU',
        },
        SECRET,
        now
      )
    ).toThrow(/invalid webhook signature/i);
  });

  it('accepts a valid signature and returns the event id', () => {
    const timestamp = String(Math.floor(now / 1000));
    const verified = verifyDodoSignature(
      Buffer.from(body),
      {
        'webhook-id': 'msg_1',
        'webhook-timestamp': timestamp,
        'webhook-signature': sign('msg_1', timestamp, body),
      },
      SECRET,
      now
    );
    expect(verified.id).toBe('msg_1');
    expect(verified.payload.type).toBe('subscription.active');
  });
});

describe('webhook idempotency', () => {
  it('ignores a replay so a plan change and credit grant happen once', () => {
    const store = new MemoryWebhookStore();
    const event = {
      id: 'evt_renew',
      type: 'subscription.renewed',
      tier: 'TEAM' as const,
      period: 'MONTHLY' as const,
      status: 'active',
      cycleKey: '2026-11-01',
    };
    const first = applyWebhookOnce(store, emptyBillingSnapshot(), event);
    const second = applyWebhookOnce(store, first.state, event);
    expect(first.duplicate).toBe(false);
    expect(first.state.tier).toBe('TEAM');
    expect(first.state.monthly).toBe(PLANS.TEAM.monthlyCredits);
    expect(second.duplicate).toBe(true);
    expect(second.state.monthly).toBe(first.state.monthly);
    expect(second.state.pack).toBe(first.state.pack);
  });

  it('does not grant a credit pack twice when the same payment is replayed', () => {
    const store = new MemoryWebhookStore();
    const start = { ...emptyBillingSnapshot(), tier: 'PRO' as const, deleted: false };
    const event = {
      id: 'evt_pack',
      type: 'payment.succeeded',
      packCredits: 150,
    };
    const first = applyWebhookOnce(store, start, event);
    const second = applyWebhookOnce(store, first.state, event);
    expect(first.state.pack).toBe(150);
    expect(second.duplicate).toBe(true);
    expect(second.state.pack).toBe(150);
  });
});

describe('credit deduction', () => {
  it('charges 1 credit for an X post and 13 when the post contains a URL', () => {
    expect(xPostCost('hello from crea8')).toBe(CREDIT_COSTS.xPost);
    expect(xPostCost('read https://crea8.one/pricing')).toBe(
      CREDIT_COSTS.xPostWithUrl
    );
    expect(xPostCost('see crea8.one/pricing today')).toBe(13);
  });

  it('blocks at zero and never plans a negative balance', () => {
    expect(planSpend({ monthly: 0, pack: 0 }, 1).ok).toBe(false);
    expect(planSpend({ monthly: 0, pack: 0 }, 13).ok).toBe(false);
    const blocked = planSpend({ monthly: 4, pack: 2 }, 13);
    expect(blocked.ok).toBe(false);
  });

  it('spends monthly credits before pack credits', () => {
    const plan = planSpend({ monthly: 2, pack: 20 }, 13);
    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      return;
    }
    expect(plan.monthlySpend).toBe(2);
    expect(plan.packSpend).toBe(11);
    expect(plan.monthlyAfter).toBe(0);
    expect(plan.packAfter).toBe(9);
  });

  it('keeps the existing credit prices and charges 1 credit on every 2nd AI post call', () => {
    expect(CREDIT_COSTS.xPost).toBe(1);
    expect(CREDIT_COSTS.xPostWithUrl).toBe(13);
    expect(CREDIT_COSTS.aiImage).toBe(3);
    expect(CREDIT_COSTS.stalkerPostsPerCredit).toBe(3);
    expect(CREDIT_COSTS.aiPostsPerCredit).toBe(2);
    expect(CREDIT_COSTS).not.toHaveProperty('brandVoice');
    expect(aiPostCharge(0)).toBe(0);
    expect(aiPostCharge(1)).toBe(0);
    expect(aiPostCharge(2)).toBe(1);
    expect(aiPostCharge(3)).toBe(0);
    expect(aiPostCharge(4)).toBe(1);
  });

  it('counts a brand-voice learn as an AI post call and not as its own price', () => {
    const usage = creditUsage({
      allowance: 300,
      monthlyRemaining: 299,
      packRemaining: 40,
      entries: [
        {
          amount: 0,
          type: 'SPEND',
          reason: AI_POST_CALL_REASON,
          idempotencyKey: 'ai-post:1',
        },
        {
          amount: 0,
          type: 'SPEND',
          reason: AI_POST_CALL_REASON,
          idempotencyKey: 'brand-voice:1',
        },
        {
          amount: -1,
          type: 'SPEND',
          reason: AI_POST_REASON,
          idempotencyKey: 'brand-voice:1:charge',
        },
      ],
    });
    expect(usage.actions.map((action) => action.key)).toEqual([
      'ai_post',
      'x_post',
      'x_post_with_link',
      'ai_image',
      'stalker_search',
    ]);
    expect(usage.actions[0]).toEqual({ key: 'ai_post', count: 2, credits: 1 });
    expect(usage.allowance).toBe(300);
    expect(usage.used).toBe(1);
    expect(usage.left).toBe(299);
    expect(usage.packCredits).toBe(40);
    expect(usage).not.toHaveProperty('resetDate');
    expect(usage).not.toHaveProperty('resetsIn');
  });

  it('breaks the current period into action counts and credits', () => {
    const usage = creditUsage({
      allowance: 300,
      monthlyRemaining: 277,
      packRemaining: 11,
      entries: [
        {
          amount: 0,
          type: 'SPEND',
          reason: AI_POST_CALL_REASON,
          idempotencyKey: 'ai:1',
        },
        {
          amount: 0,
          type: 'SPEND',
          reason: AI_POST_CALL_REASON,
          idempotencyKey: 'ai:2',
        },
        {
          amount: -1,
          type: 'SPEND',
          reason: AI_POST_REASON,
          idempotencyKey: 'ai:2:charge',
        },
        {
          amount: -2,
          type: 'SPEND',
          reason: 'x_post',
          idempotencyKey: 'xpost:a:plain:monthly',
        },
        {
          amount: -1,
          type: 'SPEND',
          reason: 'x_post',
          idempotencyKey: 'xpost:a:plain:pack',
        },
        {
          amount: -13,
          type: 'SPEND',
          reason: 'x_post_with_link',
          idempotencyKey: 'xpost:b:link',
        },
        {
          amount: -3,
          type: 'SPEND',
          reason: 'ai_image',
          idempotencyKey: 'img:1',
        },
        {
          amount: 3,
          type: 'GRANT',
          reason: 'ai_image_refund',
          idempotencyKey: 'img:1:refund',
        },
        {
          amount: -3,
          type: 'SPEND',
          reason: 'ai_image',
          idempotencyKey: 'img:2',
        },
        {
          amount: -1,
          type: 'SPEND',
          reason: 'stalker_read',
          idempotencyKey: 'stalker:hour:monthly',
        },
        {
          amount: -1,
          type: 'SPEND',
          reason: 'stalker_read',
          idempotencyKey: 'stalker:hour:pack',
        },
        {
          amount: 300,
          type: 'GRANT',
          reason: 'cycle_grant',
          idempotencyKey: 'monthly:org:2026-10',
        },
      ],
    });
    expect(usage.used).toBe(1 + 3 + 13 + 3 + 2);
    expect(usage.left).toBe(277);
    expect(usage.packCredits).toBe(11);
    expect(usage.actions).toEqual([
      { key: 'ai_post', count: 2, credits: 1 },
      { key: 'x_post', count: 3, credits: 3 },
      { key: 'x_post_with_link', count: 1, credits: 13 },
      { key: 'ai_image', count: 1, credits: 3 },
      { key: 'stalker_search', count: 1, credits: 2 },
    ]);
    expect(
      ledgerRowsForHistory([
        { reason: AI_POST_CALL_REASON },
        { reason: AI_POST_REASON },
        { reason: 'x_post' },
      ])
    ).toEqual([{ reason: AI_POST_REASON }, { reason: 'x_post' }]);
  });

  it('charges one Stalker credit for every three X posts', () => {
    expect(stalkerReadCost(0)).toBe(0);
    expect(stalkerReadCost(1)).toBe(1);
    expect(stalkerReadCost(3)).toBe(1);
    expect(stalkerReadCost(4)).toBe(2);
    expect(postsCovered(1, 7)).toBe(3);
    const replay = reduceBillingEvent(
      { ...emptyBillingSnapshot(), pack: 5 },
      { id: 'x', type: 'payment.failed' }
    );
    expect(replay.pack).toBe(5);
  });
});

describe('plan limits', () => {
  it('refuses a new channel once the plan is full', () => {
    expect(canConnectChannel(4, PLANS.STANDARD.channels)).toBe(true);
    expect(canConnectChannel(5, PLANS.STANDARD.channels)).toBe(false);
    expect(canConnectChannel(10, PLANS.TEAM.channels)).toBe(false);
    expect(canConnectChannel(99, PLANS.ULTIMATE.channels)).toBe(true);
  });

  it('keeps the earliest channels postable and blocks the rest after a downgrade', () => {
    const channels = [
      { id: 'newest', createdAt: '2026-03-01' },
      { id: 'oldest', createdAt: '2026-01-01' },
      { id: 'middle', createdAt: '2026-02-01' },
    ];
    expect(postableChannelIds(channels, 1)).toEqual(['oldest']);
    expect(postableChannelIds(channels, PLANS.STANDARD.channels)).toEqual([
      'oldest',
      'middle',
      'newest',
    ]);
    expect(postableChannelIds(channels, 2)).not.toContain('newest');
  });

  it('caps Creator at one team member and leaves higher plans open', () => {
    expect(canAddTeamMember(1, PLANS.STANDARD.teamMemberLimit)).toBe(false);
    expect(canAddTeamMember(1, PLANS.TEAM.teamMemberLimit)).toBe(true);
    expect(PLANS.STANDARD.stalkerKeywords).toBe(3);
    expect(PLANS.TEAM.stalkerKeywords).toBe(10);
    expect(PLANS.PRO.stalkerKeywords).toBe(25);
    expect(PLANS.ULTIMATE.stalkerKeywords).toBe(75);
    expect(PLANS.STANDARD.stalkerScanHours).toBe(12);
    expect(PLANS.ULTIMATE.stalkerManualChecksPerDay).toBeNull();
    expect(PLANS.PRO.mentionRetentionDays).toBe(365);
  });
});

describe('link badge and custom domain when billing is enforced', () => {
  const previous = process.env.BILLING_ENABLED;
  const previousGrandfather = process.env.BILLING_GRANDFATHERED_ORG_IDS;
  afterEach(() => {
    if (previous === undefined) {
      delete process.env.BILLING_ENABLED;
    } else {
      process.env.BILLING_ENABLED = previous;
    }
    if (previousGrandfather === undefined) {
      delete process.env.BILLING_GRANDFATHERED_ORG_IDS;
    } else {
      process.env.BILLING_GRANDFATHERED_ORG_IDS = previousGrandfather;
    }
  });

  it('keeps both open while the flag is off', () => {
    delete process.env.BILLING_ENABLED;
    expect(badgeRemovalOpen('org-1')).toBe(true);
    expect(customDomainBillingOpen('org-1', undefined, { customDomainAddon: false })).toBe(true);
  });

  it('opens badge removal from Creator up and keeps a custom domain on the add-on', () => {
    process.env.BILLING_ENABLED = 'true';
    delete process.env.BILLING_GRANDFATHERED_ORG_IDS;
    expect(badgeRemovalOpen('org-1')).toBe(false);
    expect(badgeRemovalOpen('org-1', { subscriptionTier: 'FREE' })).toBe(false);
    expect(
      badgeRemovalOpen('org-1', {
        subscriptionTier: 'STANDARD',
        deletedAt: null,
        isLifetime: false,
      })
    ).toBe(true);
    expect(
      badgeRemovalOpen('org-1', {
        subscriptionTier: 'PRO',
        deletedAt: null,
        isLifetime: false,
      })
    ).toBe(true);
    expect(customDomainBillingOpen('org-1', { subscriptionTier: 'PRO' }, { customDomainAddon: true })).toBe(true);
    expect(customDomainBillingOpen('org-1', { subscriptionTier: 'PRO' }, { customDomainAddon: false })).toBe(false);
    process.env.BILLING_GRANDFATHERED_ORG_IDS = 'gf-org';
    expect(customDomainBillingOpen('gf-org')).toBe(false);
    expect(customDomainBillingOpen('gf-org', undefined, { customDomainAddon: true })).toBe(true);
    expect(badgeRemovalOpen('gf-org')).toBe(true);
  });
});
