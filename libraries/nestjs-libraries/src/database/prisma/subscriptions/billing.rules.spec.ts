import { createHmac } from 'crypto';
import {
  CHECKOUT_GST_NOTE,
  CREDIT_COSTS,
  PLANS,
  TRIAL_CHECKOUT_FAQ,
  TRIAL_MONTHLY_CREDITS,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';
import {
  badgeRemovalOpen,
  customDomainBillingOpen,
} from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.rules';
import {
  billingStatus,
  checkoutReturnKind,
  paywallAllowsTrial,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.view';
import {
  AI_POST_CALL_REASON,
  AI_POST_REASON,
  MemoryWebhookStore,
  applyWebhookOnce,
  aiPostCharge,
  canAddTeamMember,
  canConnectChannel,
  cancelAccessUntil,
  creditUsage,
  displayedPlanAfterEvent,
  dodoCheckoutPrefill,
  emptyBillingSnapshot,
  ignoreRemoteSubscription,
  invoiceIsVisible,
  ledgerRowsForHistory,
  monthlyCreditAllowance,
  planChangeBilling,
  planSpend,
  postableChannelIds,
  postsCovered,
  preservedTrialEnd,
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

describe('trial credit cap', () => {
  const plans = ['STANDARD', 'TEAM', 'PRO', 'ULTIMATE'] as const;

  it('caps every plan at 50 monthly credits during the trial and keeps pack credits', () => {
    expect(TRIAL_MONTHLY_CREDITS).toBe(50);
    for (const tier of plans) {
      expect(monthlyCreditAllowance(tier, true)).toBe(50);
      expect(PLANS[tier].monthlyCredits).toBeGreaterThan(50);
      const trial = reduceBillingEvent(
        { ...emptyBillingSnapshot(), pack: 150 },
        {
          id: `${tier}-trial`,
          type: 'subscription.active',
          tier,
          period: 'MONTHLY',
          status: 'active',
          cycleKey: '2026-10-01',
          inTrial: true,
        }
      );
      expect(trial.status).toBe('trialing');
      expect(trial.monthly).toBe(50);
      expect(trial.pack).toBe(150);
      expect(trial.cycleKey).toBe('trial:2026-10-01');
      const shown = creditUsage({
        allowance: monthlyCreditAllowance(tier, true),
        monthlyRemaining: 38,
        packRemaining: trial.pack,
        entries: [],
      });
      expect(shown.allowance).toBe(50);
      expect(shown.packCredits).toBe(150);
      const store = new MemoryWebhookStore();
      const event = {
        id: `${tier}-trial`,
        type: 'subscription.active' as const,
        tier,
        period: 'MONTHLY' as const,
        status: 'active',
        cycleKey: '2026-10-01',
        inTrial: true,
      };
      const first = applyWebhookOnce(
        store,
        { ...emptyBillingSnapshot(), pack: 150 },
        event
      );
      const again = applyWebhookOnce(store, first.state, event);
      expect(first.duplicate).toBe(false);
      expect(first.state.monthly).toBe(50);
      expect(again.duplicate).toBe(true);
      expect(again.state.monthly).toBe(50);
      expect(again.state.pack).toBe(150);
    }
  });

  it('grants the full plan allowance when the trial converts or the subscription starts active', () => {
    for (const tier of plans) {
      const trial = reduceBillingEvent(
        { ...emptyBillingSnapshot(), pack: 500 },
        {
          id: `${tier}-trial`,
          type: 'subscription.active',
          tier,
          period: 'MONTHLY',
          status: 'active',
          cycleKey: '2026-10-01',
          inTrial: true,
        }
      );
      const converted = reduceBillingEvent(trial, {
        id: `${tier}-renewed`,
        type: 'subscription.renewed',
        tier,
        period: 'MONTHLY',
        status: 'active',
        cycleKey: '2026-10-08',
        inTrial: true,
      });
      expect(converted.status).toBe('active');
      expect(converted.monthly).toBe(PLANS[tier].monthlyCredits);
      expect(converted.pack).toBe(500);
      const sameCycle = reduceBillingEvent(trial, {
        id: `${tier}-renewed-same-cycle`,
        type: 'subscription.renewed',
        tier,
        period: 'MONTHLY',
        status: 'active',
        cycleKey: '2026-10-01',
        inTrial: true,
      });
      expect(sameCycle.status).toBe('active');
      expect(sameCycle.cycleKey).toBe('2026-10-01');
      expect(sameCycle.monthly).toBe(PLANS[tier].monthlyCredits);
      expect(sameCycle.pack).toBe(500);
      expect(monthlyCreditAllowance(tier, false)).toBe(PLANS[tier].monthlyCredits);
      const shown = creditUsage({
        allowance: monthlyCreditAllowance(tier, false),
        monthlyRemaining: converted.monthly,
        packRemaining: converted.pack,
        entries: [],
      });
      expect(shown.allowance).toBe(PLANS[tier].monthlyCredits);
      expect(shown.packCredits).toBe(500);

      const started = reduceBillingEvent(emptyBillingSnapshot(), {
        id: `${tier}-active`,
        type: 'subscription.active',
        tier,
        period: 'MONTHLY',
        status: 'active',
        cycleKey: '2026-10-01',
      });
      expect(started.status).toBe('active');
      expect(started.monthly).toBe(PLANS[tier].monthlyCredits);
      expect(started.pack).toBe(0);
    }
    expect(PLANS.STANDARD.monthlyCredits).toBe(300);
    expect(PLANS.TEAM.monthlyCredits).toBe(700);
    expect(PLANS.PRO.monthlyCredits).toBe(1100);
    expect(PLANS.ULTIMATE.monthlyCredits).toBe(1800);
  });

  it('computes Left from the effective allowance minus used, with pack credits separate', () => {
    const packCredits = 150;
    const used = 12;
    const spend = (key: string) => ({
      amount: -used,
      type: 'SPEND' as const,
      reason: 'x_post',
      idempotencyKey: key,
    });
    const agencyTrial = creditUsage({
      allowance: monthlyCreditAllowance('ULTIMATE', true),
      monthlyRemaining: PLANS.ULTIMATE.monthlyCredits,
      packRemaining: packCredits,
      entries: [],
    });
    expect(agencyTrial.allowance).toBe(50);
    expect(agencyTrial.used).toBe(0);
    expect(agencyTrial.left).toBe(50);
    expect(agencyTrial.left).not.toBe(1800);
    expect(agencyTrial.packCredits).toBe(packCredits);

    for (const tier of plans) {
      const duringTrial = creditUsage({
        allowance: monthlyCreditAllowance(tier, true),
        monthlyRemaining: PLANS[tier].monthlyCredits,
        packRemaining: packCredits,
        entries: [spend(`${tier}-trial`)],
      });
      expect(duringTrial.allowance).toBe(50);
      expect(duringTrial.used).toBe(used);
      expect(duringTrial.left).toBe(50 - used);
      expect(duringTrial.left).not.toBe(PLANS[tier].monthlyCredits);
      expect(duringTrial.left).not.toBe(50 - used + packCredits);
      expect(duringTrial.packCredits).toBe(packCredits);

      const converted = creditUsage({
        allowance: monthlyCreditAllowance(tier, false),
        monthlyRemaining: PLANS[tier].monthlyCredits,
        packRemaining: packCredits,
        entries: [spend(`${tier}-paid`)],
      });
      expect(converted.allowance).toBe(PLANS[tier].monthlyCredits);
      expect(converted.used).toBe(used);
      expect(converted.left).toBe(PLANS[tier].monthlyCredits - used);
      expect(converted.left).not.toBe(PLANS[tier].monthlyCredits - used + packCredits);
      expect(converted.packCredits).toBe(packCredits);
    }
    expect(PLANS.STANDARD.monthlyCredits - used).toBe(288);
    expect(PLANS.TEAM.monthlyCredits - used).toBe(688);
    expect(PLANS.PRO.monthlyCredits - used).toBe(1088);
    expect(PLANS.ULTIMATE.monthlyCredits - used).toBe(1788);
  });

  it('keeps a bought pack spendable after the trial monthly credits are gone', () => {
    const plan = planSpend({ monthly: TRIAL_MONTHLY_CREDITS, pack: 150 }, 63);
    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      return;
    }
    expect(plan.monthlySpend).toBe(50);
    expect(plan.packSpend).toBe(13);
    expect(plan.monthlyAfter).toBe(0);
    expect(plan.packAfter).toBe(137);
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
    expect(usage.left).toBe(usage.allowance - usage.used);
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

describe('checkout return and failed payment', () => {
  it('shows a failure for status=failed or cancelled instead of waiting', () => {
    expect(checkoutReturnKind({ checkout: 'pending', status: 'failed' })).toBe('failure');
    expect(checkoutReturnKind({ checkout: 'pending', status: 'cancelled' })).toBe('failure');
    expect(checkoutReturnKind({ checkout: 'pending', status: 'canceled' })).toBe('failure');
    expect(checkoutReturnKind({ checkout: 'failure' })).toBe('failure');
    expect(checkoutReturnKind({ checkout: 'pending' })).toBe('pending');
    expect(checkoutReturnKind({ checkout: 'pending', status: 'succeeded' })).toBe('pending');
  });

  it('does not turn a declined checkout into a subscription that changes the paywall', () => {
    expect(ignoreRemoteSubscription({ status: 'failed', hadLiveSubscription: false })).toBe(true);
    expect(ignoreRemoteSubscription({ status: 'failed', hadLiveSubscription: true })).toBe(true);
    expect(ignoreRemoteSubscription({ status: 'cancelled', hadLiveSubscription: false })).toBe(true);
    expect(ignoreRemoteSubscription({ status: 'cancelled', hadLiveSubscription: true })).toBe(false);
    expect(ignoreRemoteSubscription({ status: 'active', hadLiveSubscription: false })).toBe(false);
    expect(billingStatus({ active: false, status: 'failed' })).toBe('none');
    expect(billingStatus({ active: false, status: 'cancelled' })).toBe('cancelled');
    expect(
      paywallAllowsTrial({
        allowTrial: false,
        hasActiveSubscription: false,
        latestStatus: 'failed',
      })
    ).toBe(true);
    expect(
      paywallAllowsTrial({
        allowTrial: true,
        hasActiveSubscription: false,
        latestStatus: null,
      })
    ).toBe(true);
    const before = { ...emptyBillingSnapshot(), pack: 40 };
    const after = reduceBillingEvent(before, { id: 'pay_fail', type: 'payment.failed' });
    expect(after).toEqual(before);
    expect(invoiceIsVisible({ amount: 0, status: 'succeeded' })).toBe(false);
    expect(invoiceIsVisible({ amount: 19, status: 'failed' })).toBe(false);
    expect(invoiceIsVisible({ amount: 5, status: 'cancelled' })).toBe(false);
    expect(invoiceIsVisible({ amount: 5, status: 'succeeded' })).toBe(true);
  });

  it('keeps the trial button copy and says GST is added, with no $2 hold', () => {
    expect(TRIAL_CHECKOUT_FAQ).toContain('GST is added at checkout');
    expect(TRIAL_CHECKOUT_FAQ).toContain('$0');
    expect(TRIAL_CHECKOUT_FAQ.toLowerCase()).not.toContain('$2');
    expect(TRIAL_CHECKOUT_FAQ.toLowerCase()).not.toContain('hold');
    expect(CHECKOUT_GST_NOTE).toBe('GST is added at checkout.');
  });
});

describe('trial upgrade and scheduled downgrade', () => {
  const created = '2026-10-29T00:00:00.000Z';
  const trialEnd = new Date(Date.parse(created) + 7 * 24 * 60 * 60 * 1000).toISOString();
  const restarted = new Date(Date.parse(created) + 30 * 24 * 60 * 60 * 1000).toISOString();

  it('does not charge a trial upgrade now and does not restart the trial as 30 days', () => {
    const decision = planChangeBilling({
      inTrial: true,
      upgrade: true,
      trialEndsAt: trialEnd,
    });
    expect(decision.chargeNow).toBe(false);
    expect(decision.prorationBillingMode).toBe('do_not_bill');
    expect(decision.applyTierNow).toBe(true);
    expect(decision.keepTrialEnd).toBe(trialEnd);
    expect(decision.keepTrialEnd).not.toBe(restarted);
    expect(preservedTrialEnd({ previousEnd: trialEnd, incomingEnd: restarted })).toBe(trialEnd);
    expect(
      preservedTrialEnd({
        previousEnd: null,
        incomingEnd: restarted,
        createdAt: created,
        trialDays: 7,
      })
    ).toBe(trialEnd);
    const shown = displayedPlanAfterEvent({
      currentTier: 'STANDARD',
      currentPeriod: 'MONTHLY',
      pendingTier: null,
      pendingPeriod: null,
      eventType: 'subscription.plan_changed',
      eventTier: 'TEAM',
      eventPeriod: 'MONTHLY',
    });
    expect(shown.tier).toBe('TEAM');
    expect(shown.pendingTier).toBeNull();
  });

  it('keeps the current plan visible until a scheduled downgrade renews', () => {
    const pending = displayedPlanAfterEvent({
      currentTier: 'PRO',
      currentPeriod: 'MONTHLY',
      pendingTier: null,
      pendingPeriod: null,
      eventType: 'subscription.plan_changed',
      eventTier: 'STANDARD',
      eventPeriod: 'MONTHLY',
    });
    expect(pending.tier).toBe('PRO');
    expect(pending.pendingTier).toBe('STANDARD');
    expect(pending.pendingPeriod).toBe('MONTHLY');
    const echoed = displayedPlanAfterEvent({
      currentTier: 'PRO',
      currentPeriod: 'MONTHLY',
      pendingTier: 'STANDARD',
      pendingPeriod: 'MONTHLY',
      eventType: 'subscription.updated',
      eventTier: 'PRO',
      eventPeriod: 'MONTHLY',
    });
    expect(echoed.tier).toBe('PRO');
    expect(echoed.pendingTier).toBe('STANDARD');
    const renewed = displayedPlanAfterEvent({
      currentTier: 'PRO',
      currentPeriod: 'MONTHLY',
      pendingTier: 'STANDARD',
      pendingPeriod: 'MONTHLY',
      eventType: 'subscription.renewed',
      eventTier: 'STANDARD',
      eventPeriod: 'MONTHLY',
    });
    expect(renewed.tier).toBe('STANDARD');
    expect(renewed.pendingTier).toBeNull();
    expect(
      billingStatus({
        active: true,
        status: 'trialing',
        isTrailing: true,
        pendingTier: 'STANDARD',
      })
    ).toBe('trialing');
    const decision = planChangeBilling({
      inTrial: false,
      upgrade: false,
      trialEndsAt: null,
    });
    expect(decision.chargeNow).toBe(false);
    expect(decision.effectiveAt).toBe('next_billing_date');
    expect(decision.applyTierNow).toBe(false);
  });

  it('keeps the trial or period end date when a subscription is cancelled', () => {
    const end = new Date(trialEnd);
    expect(
      cancelAccessUntil({
        currentPeriodEnd: end,
        createdAt: new Date(created),
        inTrial: true,
        trialDays: 7,
      })
    ).toEqual(end);
    expect(
      cancelAccessUntil({
        currentPeriodEnd: null,
        createdAt: new Date(created),
        inTrial: true,
        trialDays: 7,
      })?.toISOString()
    ).toBe(trialEnd);
  });
});

describe('dodo checkout prefill', () => {
  it('sends the full name and IN / +91 when those are known, and does not lock a first name or +1', () => {
    const india = dodoCheckoutPrefill({
      name: 'Harsh',
      lastName: 'Patel',
      country: 'in',
      phone: '9876543210',
    });
    expect(india.name).toBe('Harsh Patel');
    expect(india.country).toBe('IN');
    expect(india.phoneNumber).toBe('+919876543210');
    expect(india.currency).toBe('INR');
    expect(india.lockName).toBe(false);
    expect(india.lockPhoneToPlusOne).toBe(false);
    const firstOnly = dodoCheckoutPrefill({ name: 'Harsh', country: 'US', phone: '+1' });
    expect(firstOnly.name).toBeUndefined();
    expect(firstOnly.phoneNumber).toBeUndefined();
    expect(firstOnly.country).toBeUndefined();
    const dropped = dodoCheckoutPrefill({
      name: 'Harsh',
      lastName: 'Patel',
      country: 'IN',
      phone: '+14155552671',
    });
    expect(dropped.phoneNumber).toBeUndefined();
    expect(dropped.country).toBe('IN');
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
