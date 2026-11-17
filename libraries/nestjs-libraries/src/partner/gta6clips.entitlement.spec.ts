import { HttpException } from '@nestjs/common';
import {
  GTA6CLIPS_FREE,
  GTA6CLIPS_PLAN_ID,
  PLANS,
  billingPaywallForTier,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';
import {
  BillingBlocked,
  channelUpgradeMessage,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.rules';
import { EntitlementService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/entitlement.service';
import { Gta6clipsRepository } from '@gitroom/nestjs-libraries/partner/gta6clips.repository';
import {
  partnerRouteAllowed,
  sidebarAppLocked,
} from '@gitroom/nestjs-libraries/partner/gta6clips.plan';

type PartnerRow = {
  partner: string;
  sub: string;
  email: string;
  plan: string;
  userId: string;
  organizationId: string;
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

function dodoSubscription(organizationId: string) {
  return {
    organizationId,
    subscriptionTier: 'STANDARD',
    status: 'active',
    provider: 'dodo',
    identifier: 'sub_dodo_1',
    period: 'MONTHLY',
    isLifetime: false,
    deletedAt: null as Date | null,
    cancelAt: null as Date | null,
    currentPeriodEnd: null as Date | null,
    pendingTier: null as string | null,
    pendingPeriod: null as string | null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-02-01'),
  };
}

function harness() {
  const partners = new Map<string, PartnerRow>();
  const orgs = new Map<string, { id: string; isTrailing: boolean; allowTrial: boolean; paymentId: string | null; subscription: ReturnType<typeof dodoSubscription> | null }>();
  const channels: Channel[] = [];
  const writes: string[] = [];
  const prisma = {
    partnerAccount: {
      async findUnique({ where }: { where: { organizationId: string } }) {
        return partners.get(where.organizationId) || null;
      },
      async findFirst({ where }: { where?: { partner?: string; sub?: string; organizationId?: string } }) {
        for (const row of partners.values()) {
          if (where?.partner && row.partner !== where.partner) continue;
          if (where?.sub && row.sub !== where.sub) continue;
          if (where?.organizationId && row.organizationId !== where.organizationId) continue;
          return row;
        }
        return null;
      },
      async create({ data }: { data: PartnerRow }) {
        writes.push(`create:${data.organizationId}`);
        partners.set(data.organizationId, { ...data });
        return data;
      },
      async update({ where, data }: { where: { organizationId: string }; data: Partial<PartnerRow> }) {
        const row = partners.get(where.organizationId);
        if (!row) {
          throw new Error('missing partner');
        }
        writes.push(`update:${where.organizationId}`);
        Object.assign(row, data);
        return row;
      },
    },
    organization: {
      async findUnique({ where }: { where: { id: string } }) {
        return orgs.get(where.id) || null;
      },
    },
    userOrganization: {
      async findFirst(): Promise<null> {
        return null;
      },
      async findMany(): Promise<never[]> {
        return [];
      },
    },
    integration: {
      async findMany({ where }: { where?: { organizationId?: { in?: string[] }; deletedAt?: null; disabled?: boolean; refreshNeeded?: boolean } }) {
        return channels.filter((channel) => {
          if (where?.organizationId?.in && !where.organizationId.in.includes(channel.organizationId)) return false;
          if (where?.deletedAt === null && channel.deletedAt) return false;
          if (where?.disabled === false && channel.disabled) return false;
          if (where?.refreshNeeded === false && channel.refreshNeeded) return false;
          return true;
        });
      },
    },
  };
  return { prisma, partners, orgs, channels, writes };
}

function addChannels(db: ReturnType<typeof harness>, organizationId: string, count: number) {
  for (let index = 0; index < count; index += 1) {
    db.channels.push({
      id: `${organizationId}-ch-${index + 1}`,
      internalId: `${organizationId}-social-${index + 1}`,
      organizationId,
      createdAt: new Date(Date.UTC(2026, 0, index + 1)),
      deletedAt: null,
      disabled: false,
      refreshNeeded: false,
    });
  }
}

describe('gta6clips entitlement', () => {
  const previous = process.env.BILLING_ENABLED;
  beforeEach(() => {
    process.env.BILLING_ENABLED = 'true';
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.BILLING_ENABLED;
    else process.env.BILLING_ENABLED = previous;
  });

  it('a new exchange account sees compose unlocked', async () => {
    const db = harness();
    db.orgs.set('org-new', {
      id: 'org-new',
      isTrailing: false,
      allowTrial: false,
      paymentId: null,
      subscription: null,
    });
    const repo = new Gta6clipsRepository(db.prisma as never);
    await repo.grant({
      organizationId: 'org-new',
      userId: 'user-new',
      sub: 'member-new',
      email: 'crea8.one+g6qa1@mail.grokbot.com',
    });
    const entitlements = new EntitlementService(db.prisma as never);
    const tier = await entitlements.tier('org-new');
    expect(tier).toBe(GTA6CLIPS_PLAN_ID);
    expect(billingPaywallForTier(tier)).toBe(false);
    expect(db.orgs.get('org-new')?.subscription).toBeNull();
    expect((await entitlements.account('org-new')).subscription).toMatchObject({
      subscriptionTier: GTA6CLIPS_PLAN_ID,
      status: 'active',
      provider: 'gta6clips',
    });
    addChannels(db, 'org-new', 1);
    await expect(entitlements.assertCanPost('org-new', 'org-new-ch-1')).resolves.toBeUndefined();
    await expect(entitlements.assertCanConnect('org-new', 'org-new-social-1', 'tiktok')).resolves.toBeUndefined();
    expect(partnerRouteAllowed('GET', '/user/self')).toBe(true);
    expect(partnerRouteAllowed('GET', '/integrations')).toBe(true);
    expect(partnerRouteAllowed('GET', '/integrations/list')).toBe(true);
    expect(sidebarAppLocked(tier, GTA6CLIPS_PLAN_ID, '/schedule', 'schedule', true)).toBe(false);
    expect(sidebarAppLocked(tier, GTA6CLIPS_PLAN_ID, '/linkinbio', 'link', true)).toBe(false);
    expect(sidebarAppLocked(tier, GTA6CLIPS_PLAN_ID, '/stalker/mentions', 'stalker', true)).toBe(true);
    await expect(entitlements.assertCanUseStalker('org-new')).rejects.toBeInstanceOf(HttpException);
  });

  it('linking an existing free org grants the plan', async () => {
    const db = harness();
    db.orgs.set('org-free', {
      id: 'org-free',
      isTrailing: false,
      allowTrial: true,
      paymentId: null,
      subscription: null,
    });
    const repo = new Gta6clipsRepository(db.prisma as never);
    expect(
      await repo.grant({
        organizationId: 'org-free',
        userId: 'user-free',
        sub: 'member-free',
        email: 'ada@example.com',
      })
    ).toBe('granted');
    const entitlements = new EntitlementService(db.prisma as never);
    expect(await entitlements.tier('org-free')).toBe(GTA6CLIPS_PLAN_ID);
    expect(db.partners.get('org-free')?.plan).toBe(GTA6CLIPS_PLAN_ID);
    expect(billingPaywallForTier(await entitlements.tier('org-free'))).toBe(false);
    expect(db.orgs.get('org-free')?.subscription).toBeNull();
  });

  it('a paid Dodo org is untouched', async () => {
    const db = harness();
    const subscription = dodoSubscription('org-paid');
    const before = JSON.stringify(subscription);
    db.orgs.set('org-paid', {
      id: 'org-paid',
      isTrailing: false,
      allowTrial: false,
      paymentId: 'cus_dodo',
      subscription,
    });
    addChannels(db, 'org-paid', 3);
    const repo = new Gta6clipsRepository(db.prisma as never);
    await repo.grant({
      organizationId: 'org-paid',
      userId: 'user-paid',
      sub: 'member-paid',
      email: 'paid@example.com',
    });
    const entitlements = new EntitlementService(db.prisma as never);
    expect(await entitlements.tier('org-paid')).toBe('STANDARD');
    expect(await entitlements.partnerPlanId('org-paid')).toBeNull();
    expect(JSON.stringify(db.orgs.get('org-paid')?.subscription)).toBe(before);
    expect((await entitlements.account('org-paid')).subscription).toMatchObject({
      subscriptionTier: 'STANDARD',
      provider: 'dodo',
      identifier: 'sub_dodo_1',
    });
    await expect(
      entitlements.assertCanConnect('org-paid', 'org-paid-social-4', 'tiktok')
    ).resolves.toBeUndefined();
    expect(sidebarAppLocked('STANDARD', null, '/stalker/mentions', 'stalker', true)).toBe(false);
  });

  it('a 4th channel is blocked', async () => {
    const db = harness();
    db.orgs.set('org-cap', {
      id: 'org-cap',
      isTrailing: false,
      allowTrial: false,
      paymentId: null,
      subscription: null,
    });
    db.partners.set('org-cap', {
      partner: 'gta6clips',
      sub: 'member-cap',
      email: 'cap@example.com',
      plan: GTA6CLIPS_PLAN_ID,
      userId: 'user-cap',
      organizationId: 'org-cap',
    });
    addChannels(db, 'org-cap', 3);
    const entitlements = new EntitlementService(db.prisma as never);
    expect(PLANS.gta6clips_free.channels).toBe(GTA6CLIPS_FREE.channels);
    await expect(entitlements.assertCanConnect('org-cap', 'org-cap-social-2', 'tiktok')).resolves.toBeUndefined();
    try {
      await entitlements.assertCanConnect('org-cap', 'org-cap-social-4', 'tiktok');
      throw new Error('expected the 4th channel to be blocked');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(402);
      expect((err as HttpException).getResponse()).toEqual({
        message: channelUpgradeMessage('gta6clips_free'),
        upgrade: true,
      });
    }
  });

  it('a normal sign-up still hits the paywall', async () => {
    const db = harness();
    db.orgs.set('org-signup', {
      id: 'org-signup',
      isTrailing: false,
      allowTrial: true,
      paymentId: null,
      subscription: null,
    });
    const entitlements = new EntitlementService(db.prisma as never);
    const tier = await entitlements.tier('org-signup');
    expect(tier).toBe('FREE');
    expect(billingPaywallForTier(tier)).toBe(true);
    expect(await entitlements.partnerPlanId('org-signup')).toBeNull();
    expect((await entitlements.account('org-signup')).subscription).toBeNull();
    expect(db.writes).toEqual([]);
    expect(db.partners.size).toBe(0);
    expect(sidebarAppLocked(tier, null, '/schedule', 'schedule', true)).toBe(true);
    expect(sidebarAppLocked(tier, null, '/stalker/mentions', 'stalker', true)).toBe(true);
    expect(sidebarAppLocked(tier, null, '/linkinbio', 'link', true)).toBe(false);
    await expect(entitlements.assertCanPost('org-signup', 'missing')).rejects.toBeInstanceOf(BillingBlocked);
    await expect(entitlements.assertCanConnect('org-signup', 'social-1', 'tiktok')).rejects.toBeInstanceOf(
      HttpException
    );
  });

  it('fills an empty gta6clips plan on read and ignores every other org', async () => {
    const db = harness();
    db.orgs.set('org-old', {
      id: 'org-old',
      isTrailing: false,
      allowTrial: false,
      paymentId: null,
      subscription: null,
    });
    db.orgs.set('org-other', {
      id: 'org-other',
      isTrailing: false,
      allowTrial: false,
      paymentId: null,
      subscription: null,
    });
    db.partners.set('org-old', {
      partner: 'gta6clips',
      sub: 'member-old',
      email: 'old@example.com',
      plan: '',
      userId: 'user-old',
      organizationId: 'org-old',
    });
    db.partners.set('org-other', {
      partner: 'elsewhere',
      sub: 'member-other',
      email: 'other@example.com',
      plan: '',
      userId: 'user-other',
      organizationId: 'org-other',
    });
    const entitlements = new EntitlementService(db.prisma as never);
    expect(await entitlements.tier('org-old')).toBe(GTA6CLIPS_PLAN_ID);
    expect(db.partners.get('org-old')?.plan).toBe(GTA6CLIPS_PLAN_ID);
    expect(await entitlements.tier('org-other')).toBe('FREE');
    expect(billingPaywallForTier(await entitlements.tier('org-other'))).toBe(true);
    expect(db.partners.get('org-other')?.plan).toBe('');
    expect(db.writes).toEqual(['update:org-old']);
  });
});
