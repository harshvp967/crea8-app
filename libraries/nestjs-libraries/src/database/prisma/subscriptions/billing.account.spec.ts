import { HttpException } from '@nestjs/common';
import {
  AI_VIDEO_CREDIT_COST,
  CREDIT_COSTS,
  PAID_TIERS,
  PLAN_CARD_ENFORCEMENT,
  PLAN_CARD_KEYS,
  PLANS,
  TRIAL_MONTHLY_CREDITS,
  cardLimitAllows,
  planCardLines,
  planCardQuota,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';
import {
  loadBillingAccount,
  subscriptionGrantsAccess,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.account';
import { CreditsService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/credits.service';
import { EntitlementService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/entitlement.service';

type Sub = {
  organizationId: string;
  subscriptionTier: string;
  status: string;
  period: 'MONTHLY';
  cancelAt: Date | null;
  currentPeriodEnd: Date | null;
  isLifetime: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  provider: string;
  identifier: string;
  pendingTier: null;
  pendingPeriod: null;
};

type Org = {
  id: string;
  isTrailing: boolean;
  allowTrial: boolean;
  paymentId: string | null;
  deletedAt: Date | null;
  subscription: Sub | null;
};

type Member = {
  userId: string;
  organizationId: string;
  role: string;
  disabled: boolean;
  createdAt: Date;
};

type Channel = {
  id: string;
  internalId: string;
  organizationId: string;
  createdAt: Date;
  deletedAt: Date | null;
  disabled: boolean;
  refreshNeeded: boolean;
};

function sub(organizationId: string, patch: Partial<Sub>): Sub {
  return {
    organizationId,
    subscriptionTier: 'STANDARD',
    status: 'active',
    period: 'MONTHLY',
    cancelAt: null,
    currentPeriodEnd: null,
    isLifetime: false,
    deletedAt: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-02T00:00:00.000Z'),
    provider: 'dodo',
    identifier: 'sub_1',
    pendingTier: null,
    pendingPeriod: null,
    ...patch,
  };
}

function workspaceDb(input: {
  orgs: Org[];
  members: Member[];
  channels?: Channel[];
  keywords?: { organizationId: string }[];
}) {
  const orgs = new Map(input.orgs.map((org) => [org.id, org]));
  const members = input.members;
  const channels = input.channels || [];
  const keywords = input.keywords || [];
  const balances = new Map<string, { organizationId: string; monthlyRemaining: number; packRemaining: number; cycleKey: string | null }>();
  const ledger: { organizationId: string; amount: number; bucket: string; type: string; reason: string; cycleKey: string | null; idempotencyKey: string }[] = [];

  const memberMatches = (member: Member, where: any) => {
    if (!where) return true;
    if (where.userId && member.userId !== where.userId) return false;
    if (where.role && member.role !== where.role) return false;
    if (where.disabled === false && member.disabled) return false;
    if (where.organizationId?.in && !where.organizationId.in.includes(member.organizationId)) return false;
    if (where.organizationId && typeof where.organizationId === 'string' && member.organizationId !== where.organizationId) {
      return false;
    }
    if (where.organization?.deletedAt === null) {
      const org = orgs.get(member.organizationId);
      if (!org || org.deletedAt) return false;
    }
    return true;
  };

  const api: any = {
    userOrganization: {
      findFirst: async ({ where }: { where: any }) => {
        const found = members
          .filter((member) => memberMatches(member, where))
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
        return found ? { userId: found.userId } : null;
      },
      findMany: async ({ where, select }: { where: any; select?: any }) => {
        const rows = members.filter((member) => memberMatches(member, where));
        if (select?.organization) {
          return rows.map((member) => ({ organization: orgs.get(member.organizationId) || null }));
        }
        if (select?.userId) {
          return rows.map((member) => ({ userId: member.userId }));
        }
        return rows;
      },
    },
    organization: {
      findUnique: async ({ where }: { where: { id: string } }) => orgs.get(where.id) || null,
    },
    integration: {
      findMany: async ({ where }: { where: any }) =>
        channels.filter((channel) => {
          if (where.organizationId?.in && !where.organizationId.in.includes(channel.organizationId)) return false;
          if (where.deletedAt === null && channel.deletedAt) return false;
          if (where.disabled === false && channel.disabled) return false;
          if (where.refreshNeeded === false && channel.refreshNeeded) return false;
          return true;
        }),
    },
    stalkerKeyword: {
      count: async ({ where }: { where: { organizationId: { in: string[] } } }) =>
        keywords.filter((row) => where.organizationId.in.includes(row.organizationId)).length,
    },
    webhooks: { count: async () => 0 },
    stalkerScanRun: { count: async () => 0 },
    post: { count: async () => 0 },
    creditBalance: {
      findUnique: async ({ where }: { where: { organizationId: string } }) =>
        balances.get(where.organizationId) || null,
      upsert: async ({ where, create, update }: any) => {
        const existing = balances.get(where.organizationId);
        if (!existing) {
          const row = {
            organizationId: create.organizationId,
            monthlyRemaining: create.monthlyRemaining || 0,
            packRemaining: create.packRemaining || 0,
            cycleKey: create.cycleKey ?? null,
          };
          balances.set(where.organizationId, row);
          return row;
        }
        if (update.monthlyRemaining?.increment) existing.monthlyRemaining += update.monthlyRemaining.increment;
        else if (update.monthlyRemaining?.decrement) existing.monthlyRemaining -= update.monthlyRemaining.decrement;
        else if (typeof update.monthlyRemaining === 'number') existing.monthlyRemaining = update.monthlyRemaining;
        if (update.packRemaining?.increment) existing.packRemaining += update.packRemaining.increment;
        if (update.cycleKey) existing.cycleKey = update.cycleKey;
        return existing;
      },
      update: async ({ where, data }: any) => {
        const row = balances.get(where.organizationId);
        if (!row) throw new Error('missing balance');
        if (typeof data.monthlyRemaining === 'number') row.monthlyRemaining = data.monthlyRemaining;
        if (data.cycleKey) row.cycleKey = data.cycleKey;
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        const row = balances.get(where.organizationId);
        if (!row) return { count: 0 };
        if (row.monthlyRemaining < (where.monthlyRemaining?.gte ?? 0)) return { count: 0 };
        if (row.packRemaining < (where.packRemaining?.gte ?? 0)) return { count: 0 };
        if (data.monthlyRemaining?.decrement) row.monthlyRemaining -= data.monthlyRemaining.decrement;
        if (data.packRemaining?.decrement) row.packRemaining -= data.packRemaining.decrement;
        return { count: 1 };
      },
    },
    creditLedger: {
      findUnique: async ({ where }: { where: { idempotencyKey: string } }) =>
        ledger.find((row) => row.idempotencyKey === where.idempotencyKey) || null,
      findMany: async ({ where }: { where?: any }) =>
        ledger.filter((row) => {
          if (where?.organizationId && row.organizationId !== where.organizationId) return false;
          if (where?.idempotencyKey?.in && !where.idempotencyKey.in.includes(row.idempotencyKey)) return false;
          if (where?.cycleKey && row.cycleKey !== where.cycleKey) return false;
          return true;
        }),
      count: async () => 0,
      create: async ({ data }: any) => {
        const row = { ...data, cycleKey: data.cycleKey ?? null };
        ledger.push(row);
        return row;
      },
    },
    $transaction: async (fn: (tx: any) => Promise<any>) => fn(api),
  };
  return { api, balances };
}

function owner(status: Partial<Sub>, orgA: Partial<Org> = {}) {
  const subscription = sub('org-a', status);
  const orgs: Org[] = [
    {
      id: 'org-a',
      isTrailing: false,
      allowTrial: false,
      paymentId: 'cus_a',
      deletedAt: null,
      subscription,
      ...orgA,
    },
    {
      id: 'org-b',
      isTrailing: true,
      allowTrial: true,
      paymentId: null,
      deletedAt: null,
      subscription: null,
    },
  ];
  const members: Member[] = [
    { userId: 'harsh', organizationId: 'org-a', role: 'SUPERADMIN', disabled: false, createdAt: new Date('2026-01-01') },
    { userId: 'harsh', organizationId: 'org-b', role: 'SUPERADMIN', disabled: false, createdAt: new Date('2026-02-01') },
  ];
  return workspaceDb({ orgs, members });
}

describe('shared workspace billing', () => {
  const previous = process.env.BILLING_ENABLED;

  beforeEach(() => {
    process.env.BILLING_ENABLED = 'true';
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.BILLING_ENABLED;
    else process.env.BILLING_ENABLED = previous;
  });

  it('maps every remaining card line to a plan field and an enforced check', () => {
    expect(AI_VIDEO_CREDIT_COST).toBeNull();
    expect(CREDIT_COSTS.aiImage).toBe(3);
    expect(TRIAL_MONTHLY_CREDITS).toBe(50);
    expect('imageGenerationCount' in PLANS.STANDARD).toBe(false);
    expect('generateVideos' in PLANS.STANDARD).toBe(false);

    for (const tier of PAID_TIERS) {
      const plan = PLANS[tier];
      const lines = planCardLines(plan);
      const text = lines.map((line) => line.text).join('\n');
      expect(text).not.toMatch(/AI images/);
      expect(text).not.toMatch(/AI videos/);
      expect(lines.map((line) => line.key)).toEqual(
        PLAN_CARD_KEYS.filter((key) => key !== 'aiPost' || plan.ai)
      );
      for (const line of lines) {
        expect(PLAN_CARD_ENFORCEMENT[line.key]).toBeTruthy();
        if (line.key === 'channels') expect(planCardQuota(plan, line.key)).toBe(plan.channels);
        if (line.key === 'teamMembers') expect(planCardQuota(plan, line.key)).toBe(plan.teamMemberLimit);
        if (line.key === 'monthlyCredits') expect(planCardQuota(plan, line.key)).toBe(plan.monthlyCredits);
        if (line.key === 'stalkerKeywords') expect(planCardQuota(plan, line.key)).toBe(plan.stalkerKeywords);
        if (line.key === 'stalkerScanHours') expect(planCardQuota(plan, line.key)).toBe(plan.stalkerScanHours);
        if (line.key === 'stalkerChecks') expect(planCardQuota(plan, line.key)).toBe(plan.stalkerManualChecksPerDay);
        if (line.key === 'mentionRetentionDays') expect(planCardQuota(plan, line.key)).toBe(plan.mentionRetentionDays);
        if (line.key === 'webhooks') expect(planCardQuota(plan, line.key)).toBe(plan.webhooks);
        if (line.key === 'postsPerMonth') expect(planCardQuota(plan, line.key)).toBe(plan.postsPerMonth);
        if (line.key === 'workspaces') expect(planCardQuota(plan, line.key)).toBeNull();
      }
    }

    expect(planCardLines(PLANS.STANDARD).map((line) => line.text)).toEqual([
      '5 channels',
      '1 team member',
      'Unlimited workspaces',
      '300 credits a month',
      '3 Stalker keywords',
      'Stalker scan every 12 hours',
      '3 Stalker checks a day',
      '30 days of mentions',
      '2 webhooks',
      'Unlimited posts a month',
      'AI post',
      'Posting sets',
      'Analytics',
      'Link in Bio, all themes',
      'Badge removed',
    ]);
    expect(planCardLines(PLANS.TEAM).map((line) => line.text)).toContain('10 channels');
    expect(planCardLines(PLANS.TEAM).map((line) => line.text)).toContain('Unlimited team members');
    expect(planCardLines(PLANS.TEAM).map((line) => line.text)).toContain('700 credits a month');
    expect(planCardLines(PLANS.PRO).map((line) => line.text)).toContain('1,100 credits a month');
    expect(planCardLines(PLANS.ULTIMATE).map((line) => line.text)).toContain('1,800 credits a month');
    expect(planCardLines(PLANS.ULTIMATE).map((line) => line.text)).toContain('Unlimited Stalker checks a day');
    expect(planCardLines(PLANS.ULTIMATE).map((line) => line.text)).toContain('Stalker scan every 1 hour');
    expect(cardLimitAllows('channels', PLANS.STANDARD, 4)).toBe(true);
    expect(cardLimitAllows('channels', PLANS.STANDARD, 5)).toBe(false);
    expect(cardLimitAllows('workspaces', PLANS.STANDARD, 99)).toBe(true);
    expect(cardLimitAllows('stalkerKeywords', PLANS.STANDARD, 3)).toBe(false);
    expect(cardLimitAllows('webhooks', PLANS.STANDARD, 2)).toBe(false);
  });

  it('shows the owner plan, trial state, and credit pool on a second workspace', async () => {
    const future = new Date('2026-12-01T00:00:00.000Z');
    const past = new Date('2026-01-01T00:00:00.000Z');
    const cases = [
      {
        name: 'paid',
        status: sub('org-a', { status: 'active', subscriptionTier: 'ULTIMATE' }),
        org: { isTrailing: false, allowTrial: false },
        tier: 'ULTIMATE',
        trailing: false,
      },
      {
        name: 'trial',
        status: sub('org-a', { status: 'trialing' }),
        org: { isTrailing: true, allowTrial: false },
        tier: 'STANDARD',
        trailing: true,
      },
      {
        name: 'cancelled',
        status: sub('org-a', { status: 'cancel_scheduled', cancelAt: future, currentPeriodEnd: future }),
        org: { isTrailing: false, allowTrial: false },
        tier: 'STANDARD',
        trailing: false,
      },
    ];

    for (const item of cases) {
      const { api } = owner(item.status, item.org);
      const entitlements = new EntitlementService(api);
      const home = await entitlements.account('org-a');
      const other = await entitlements.account('org-b');
      expect(await entitlements.tier('org-b')).toBe(item.tier);
      expect(other.billingOrganizationId).toBe('org-a');
      expect(other.subscription?.status).toBe(home.subscription?.status);
      expect(other.isTrailing).toBe(item.trailing);
      expect(other.allowTrial).toBe(home.allowTrial);
      expect(subscriptionGrantsAccess(other.subscription)).toBe(true);
    }

    const ended = owner(
      sub('org-a', { status: 'cancelled', deletedAt: past, currentPeriodEnd: past }),
      { isTrailing: false, allowTrial: false }
    );
    const endedEntitlements = new EntitlementService(ended.api);
    expect(await endedEntitlements.tier('org-a')).toBe('FREE');
    expect(await endedEntitlements.tier('org-b')).toBe('FREE');
    expect((await loadBillingAccount(ended.api, 'org-b')).isTrailing).toBe(false);
  });

  it('grants a paid pack once into the shared pool and refuses one during a trial', async () => {
    const paid = owner(sub('org-a', { status: 'active', subscriptionTier: 'STANDARD' }), {
      isTrailing: false,
      allowTrial: false,
    });
    const paidCredits = new CreditsService(paid.api);
    const payment = {
      payment_id: 'pay_shared_150',
      status: 'succeeded',
      metadata: {
        organizationId: 'org-b',
        kind: 'credit_pack',
        pack: 'PACK_150',
        credits: 150,
      },
    };
    expect(await paidCredits.applyReportedPackPayment(paid.api, payment)).toBe(true);
    expect(await paidCredits.applyReportedPackPayment(paid.api, payment)).toBe(true);
    expect((await paidCredits.balance('org-b')).packRemaining).toBe(150);
    expect((await paidCredits.balance('org-a')).packRemaining).toBe(150);

    const trial = owner(sub('org-a', { status: 'trialing', subscriptionTier: 'STANDARD' }), {
      isTrailing: true,
      allowTrial: false,
    });
    const trialCredits = new CreditsService(trial.api);
    expect(
      await trialCredits.applyReportedPackPayment(trial.api, {
        ...payment,
        payment_id: 'pay_trial_shared',
      })
    ).toBe(false);
    expect((await trialCredits.balance('org-a')).packRemaining).toBe(0);
    expect((await trialCredits.balance('org-b')).packRemaining).toBe(0);
  });

  it('spends the shared credit pool from either workspace', async () => {
    const { api } = owner(sub('org-a', { status: 'active', subscriptionTier: 'STANDARD' }));
    const credits = new CreditsService(api);
    await credits.grantMonthly(api, 'org-a', '2026-10', PLANS.STANDARD.monthlyCredits);
    expect((await credits.balance('org-b')).total).toBe(300);
    expect((await credits.balance('org-a')).total).toBe(300);
    await credits.spend('org-b', CREDIT_COSTS.aiImage, 'ai_image', 'img:b');
    expect((await credits.balance('org-a')).total).toBe(297);
    expect((await credits.balance('org-b')).total).toBe(297);
    expect((await credits.balance('org-b')).monthlyRemaining).toBe(297);
  });

  it('blocks a new channel and a new keyword on workspace B when workspace A used the cap', async () => {
    const channels = Array.from({ length: 5 }, (_, index) => ({
      id: `ch-${index}`,
      internalId: `social-${index}`,
      organizationId: 'org-a',
      createdAt: new Date(2026, 0, index + 1),
      deletedAt: null,
      disabled: false,
      refreshNeeded: false,
    }));
    const built = workspaceDb({
      orgs: [
        {
          id: 'org-a',
          isTrailing: false,
          allowTrial: false,
          paymentId: 'cus_a',
          deletedAt: null,
          subscription: sub('org-a', { status: 'active' }),
        },
        {
          id: 'org-b',
          isTrailing: true,
          allowTrial: true,
          paymentId: null,
          deletedAt: null,
          subscription: null,
        },
      ],
      members: [
        { userId: 'harsh', organizationId: 'org-a', role: 'SUPERADMIN', disabled: false, createdAt: new Date('2026-01-01') },
        { userId: 'harsh', organizationId: 'org-b', role: 'SUPERADMIN', disabled: false, createdAt: new Date('2026-02-01') },
      ],
      channels,
      keywords: [{ organizationId: 'org-a' }, { organizationId: 'org-a' }, { organizationId: 'org-a' }],
    });
    const entitlements = new EntitlementService(built.api);
    await expect(entitlements.assertCanConnect('org-b', 'social-new')).rejects.toBeInstanceOf(HttpException);
    await expect(entitlements.assertCanConnect('org-a', 'social-new')).rejects.toBeInstanceOf(HttpException);
    await expect(entitlements.assertCanConnect('org-a', 'social-0')).resolves.toBeUndefined();
    await expect(entitlements.assertCanAddKeyword('org-b')).rejects.toBeInstanceOf(HttpException);
    expect(await entitlements.countChannels('org-b')).toBe(5);
    expect(await entitlements.countKeywords('org-a')).toBe(3);
    expect(cardLimitAllows('webhooks', PLANS.STANDARD, 2)).toBe(false);
  });
});
