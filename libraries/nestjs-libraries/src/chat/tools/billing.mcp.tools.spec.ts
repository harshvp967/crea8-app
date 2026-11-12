import { readFileSync } from 'fs';
import { join } from 'path';
import { HttpException } from '@nestjs/common';

jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service',
  () => ({
    OrganizationService: class OrganizationService {},
  })
);
jest.mock('@gitroom/nestjs-libraries/database/prisma/users/users.service', () => ({
  UsersService: class UsersService {},
}));
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.read.service',
  () => ({
    BillingReadService: class BillingReadService {},
  })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/subscriptions/entitlement.service',
  () => ({
    EntitlementService: class EntitlementService {},
  })
);
jest.mock('@gitroom/nestjs-libraries/services/payment/payment.service', () => ({
  PaymentService: class PaymentService {},
}));

import { BillingTool } from '@gitroom/nestjs-libraries/chat/tools/billing.tool';
import {
  CREDIT_PACK_PAID_ERROR,
  CREDIT_PACK_TRIAL_ERROR,
  creditPackCheckoutError,
  creditPackCheckoutInput,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.rules';

const run = async (
  tool: { run: () => any },
  input: unknown,
  org: Record<string, unknown> = { id: 'org-1', userId: 'user-1' }
) => {
  const built = tool.run();
  const store = new Map<string, string>([['organization', JSON.stringify(org)]]);
  return built.execute(input, {
    requestContext: {
      get: (key: string) => store.get(key),
      set: (key: string, value: string) => store.set(key, value),
    },
  });
};

const membership = (role: string) => ({
  id: 'org-1',
  name: 'Workspace',
  users: [{ role, disabled: false }],
});

const userRecord = (id: string) => ({
  id,
  email: `${id}@example.com`,
  name: id,
});

type PackRow = {
  status?: string | null;
  deletedAt?: Date | null;
  cancelAt?: Date | null;
};

// The same account shape buyPack reads. The stub below applies
// creditPackCheckoutError, which is the check DodoProvider.buyPack runs.
let packAccount: {
  subscription: PackRow | null;
  latest: PackRow | null;
  isTrailing: boolean;
  grandfathered: boolean;
  charges?: { amount: number; status?: string | null; kind?: string | null }[];
  billingOrganizationId: string;
  allowTrial: boolean;
} = {
  subscription: null,
  latest: null,
  isTrailing: false,
  grandfathered: false,
  billingOrganizationId: 'org-1',
  allowTrial: true,
};

const row = (status: string, patch: Partial<PackRow> = {}): PackRow => ({
  status,
  deletedAt: null,
  cancelAt: null,
  ...patch,
});

describe('billing MCP tool', () => {
  const organizations = {
    getOrgById: jest.fn(),
    getOrgsByUserId: jest.fn(async () => [membership('SUPERADMIN')]),
    getAccountOverview: jest.fn(async () => ({
      organization: { id: 'org-1', name: 'Workspace' },
      owner: { id: 'owner-1' },
    })),
  };
  const users = {
    getUserById: jest.fn(async (id: string) => userRecord(id)),
    getUserWithActiveSubscriptionByEmail: jest.fn(async () => null),
  };
  const billingRead = { overview: jest.fn() };
  const entitlements = {
    account: jest.fn(async () => packAccount),
  };
  const provider = {
    subscribe: jest.fn(),
    buyPack: jest.fn(async (_organizationId: string, _userId: string, pack: string) => {
      if (!packAccount.grandfathered) {
        const packError = creditPackCheckoutError(
          creditPackCheckoutInput({
            subscription: packAccount.subscription,
            latest: packAccount.latest,
            isTrailing: packAccount.isTrailing,
            charges: packAccount.charges,
          })
        );
        if (packError) {
          throw new HttpException(packError, 400);
        }
      }
      return { url: `https://test.dodopayments.com/checkout/${pack}` };
    }),
    portalLink: jest.fn(),
    changePlan: jest.fn(),
  };
  const payment = {
    getProviderForOrganization: jest.fn(async () => provider),
  };
  const tool = new BillingTool(
    billingRead as any,
    payment as any,
    entitlements as any,
    organizations as any,
    users as any
  );

  beforeEach(() => {
    packAccount = {
      subscription: null,
      latest: null,
      isTrailing: false,
      grandfathered: false,
      billingOrganizationId: 'org-1',
      allowTrial: true,
    };
    organizations.getOrgById.mockReset();
    users.getUserById.mockClear();
    users.getUserWithActiveSubscriptionByEmail.mockReset();
    users.getUserWithActiveSubscriptionByEmail.mockResolvedValue(null);
    billingRead.overview.mockReset();
    provider.subscribe.mockReset();
    provider.buyPack.mockClear();
    provider.portalLink.mockReset();
    provider.changePlan.mockReset();
    payment.getProviderForOrganization.mockClear();
    organizations.getOrgById.mockResolvedValue({
      id: 'org-1',
      name: 'Workspace',
      paymentId: null,
      isTrailing: false,
      allowTrial: true,
    });
  });

  it('registers the billing tool by class with no name prefix', () => {
    const list = readFileSync(join(__dirname, 'tool.list.ts'), 'utf8');
    const source = readFileSync(join(__dirname, 'billing.tool.ts'), 'utf8');
    expect(list).toContain('BillingTool');
    expect(new BillingTool({} as any, {} as any, {} as any, {} as any, {} as any).name).toBe(
      'billingTool'
    );
    expect(source.includes('changePlan')).toBe(false);
    expect(source.includes('setToCancel')).toBe(false);
    expect(source.includes('finishTrial')).toBe(false);
    expect(source.includes('applyCoupon')).toBe(false);
  });

  it('returns plan, status, renewal, credits, and usage from BillingRead.overview', async () => {
    const overview = {
      billingEnabled: true,
      grandfathered: false,
      supportEmail: 'support@crea8.one',
      subscription: {
        tier: 'STANDARD',
        displayName: 'Standard',
        period: 'MONTHLY',
        status: 'cancel_scheduled',
        cancelAt: '2026-12-01T00:00:00.000Z',
        currentPeriodEnd: '2026-12-01T00:00:00.000Z',
        renewsAt: null as string | null,
        expiresAt: '2026-12-01T00:00:00.000Z',
        pendingTier: 'PRO',
        pendingDisplayName: 'Pro',
        pendingPeriod: 'YEARLY',
        identifier: 'sub_live_secret',
        provider: 'dodo',
      },
      credits: {
        monthlyRemaining: 40,
        monthlyAllowance: 50,
        packRemaining: 150,
        total: 190,
        cycleKey: '2026-11',
      },
      usage: {
        channels: { used: 2, limit: 5 },
        teamMembers: { used: 1, limit: 3 },
        keywords: { used: 4, limit: 10 },
        webhooks: { used: 0, limit: 2 },
        posts: { used: 12, limit: 100 },
        stalkerChecks: { used: 1, limit: 5 },
      },
      invoices: [{ id: 'in_1', url: 'https://pay.example/secret' }],
      apiKey: 'sk_live_secret',
    };
    billingRead.overview.mockResolvedValue(overview);

    const result = await run(tool, { action: 'overview' });

    expect(organizations.getOrgById).toHaveBeenCalledWith('org-1');
    expect(billingRead.overview).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'org-1' })
    );
    expect(result.output).toEqual({
      billingEnabled: true,
      plan: { tier: 'STANDARD', displayName: 'Standard', period: 'MONTHLY' },
      status: 'cancel_scheduled',
      renewal: {
        renewsAt: null,
        expiresAt: '2026-12-01T00:00:00.000Z',
        cancelAt: '2026-12-01T00:00:00.000Z',
        currentPeriodEnd: '2026-12-01T00:00:00.000Z',
      },
      pending: { tier: 'PRO', displayName: 'Pro', period: 'YEARLY' },
      credits: {
        monthlyRemaining: 40,
        monthlyAllowance: 50,
        packRemaining: 150,
        total: 190,
      },
      usage: overview.usage,
    });
    expect(JSON.stringify(result.output)).not.toContain('sk_live_secret');
    expect(JSON.stringify(result.output)).not.toContain('sub_live_secret');
    expect(result.output.invoices).toBeUndefined();
    expect(provider.subscribe).not.toHaveBeenCalled();
    expect(provider.changePlan).not.toHaveBeenCalled();
  });

  it('returns the customer portal URL from portalLink', async () => {
    packAccount = {
      ...packAccount,
      billingOrganizationId: 'org-bill',
    };
    provider.portalLink.mockResolvedValue({
      url: 'https://test.dodopayments.com/portal/session',
      apiKey: 'sk_test_secret',
    });

    const result = await run(tool, { action: 'portal' });

    expect(payment.getProviderForOrganization).toHaveBeenCalledWith('org-bill', 'web');
    expect(provider.portalLink).toHaveBeenCalledWith('org-bill');
    expect(result.output).toEqual({
      portal: 'https://test.dodopayments.com/portal/session',
    });
    expect(JSON.stringify(result.output)).not.toContain('sk_test_secret');
    expect(provider.changePlan).not.toHaveBeenCalled();
    expect(provider.subscribe).not.toHaveBeenCalled();
  });

  it('returns a plan checkout URL only, and does not change a subscription', async () => {
    packAccount = {
      ...packAccount,
      billingOrganizationId: 'org-bill',
      allowTrial: true,
      subscription: null,
    };
    provider.subscribe.mockResolvedValue({
      url: 'https://test.dodopayments.com/checkout/session',
      changed: true,
      apiKey: 'sk_test_secret',
    });

    const result = await run(tool, {
      action: 'checkout',
      billing: 'PRO',
      period: 'YEARLY',
      country: 'IN',
    });

    expect(provider.subscribe).toHaveBeenCalledWith(
      '',
      'org-bill',
      'user-1',
      {
        billing: 'PRO',
        period: 'YEARLY',
        utm: '',
        dub: '',
        datafast_session_id: '',
        datafast_visitor_id: '',
        country: 'IN',
      },
      true
    );
    expect(result.output).toEqual({
      url: 'https://test.dodopayments.com/checkout/session',
    });
    expect(provider.changePlan).not.toHaveBeenCalled();
  });

  it('does not call subscribe when the workspace already has a subscription', async () => {
    packAccount = {
      ...packAccount,
      subscription: row('active', { cancelAt: null }),
    };

    const result = await run(tool, {
      action: 'checkout',
      billing: 'PRO',
      period: 'MONTHLY',
    });

    expect(provider.subscribe).not.toHaveBeenCalled();
    expect(provider.changePlan).not.toHaveBeenCalled();
    expect(payment.getProviderForOrganization).not.toHaveBeenCalled();
    expect(result.output.url).toBeUndefined();
    expect(result.output.changed).toBeUndefined();
    expect(result.output.error).toBe(
      'This workspace already has a subscription, so there is no checkout URL. The plan was not changed.'
    );
  });

  it('drops an in-place plan change when checkout does not return a url', async () => {
    provider.subscribe.mockResolvedValue({
      changed: true,
      upgrade: true,
      trial: true,
    });

    const result = await run(tool, {
      action: 'checkout',
      billing: 'TEAM',
      period: 'MONTHLY',
    });

    expect(provider.changePlan).not.toHaveBeenCalled();
    expect(result.output).toEqual({
      error: 'Checkout did not return a URL. The plan was not changed.',
    });
  });

  it('uses the workspace owner when the caller is an API key', async () => {
    provider.subscribe.mockResolvedValue({
      url: 'https://test.dodopayments.com/checkout/owner',
    });

    const result = await run(
      tool,
      { action: 'checkout', billing: 'STANDARD', period: 'MONTHLY' },
      { id: 'org-1' }
    );

    expect(users.getUserById).toHaveBeenCalledWith('owner-1');
    expect(provider.subscribe).toHaveBeenCalledWith(
      '',
      'org-1',
      'owner-1',
      expect.objectContaining({ billing: 'STANDARD', period: 'MONTHLY' }),
      true
    );
    expect(result.output).toEqual({
      url: 'https://test.dodopayments.com/checkout/owner',
    });
    expect(provider.changePlan).not.toHaveBeenCalled();
  });

  it('returns blocked when another account with this email already has a subscription', async () => {
    users.getUserWithActiveSubscriptionByEmail.mockResolvedValue({ id: 'other' });

    const result = await run(tool, {
      action: 'checkout',
      billing: 'STANDARD',
      period: 'MONTHLY',
    });

    expect(result.output).toEqual({ blocked: true });
    expect(provider.subscribe).not.toHaveBeenCalled();
    expect(provider.changePlan).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a trial',
      {
        subscription: row('trialing'),
        latest: row('trialing'),
        isTrailing: true,
      },
      CREDIT_PACK_TRIAL_ERROR,
    ],
    [
      'an expired subscription',
      {
        subscription: null,
        latest: row('expired'),
        isTrailing: false,
      },
      CREDIT_PACK_PAID_ERROR,
    ],
    [
      'a cancelled subscription',
      {
        subscription: null,
        latest: row('cancelled', {
          deletedAt: new Date('2020-01-01T00:00:00.000Z'),
          cancelAt: new Date('2020-01-02T00:00:00.000Z'),
        }),
        isTrailing: false,
      },
      CREDIT_PACK_PAID_ERROR,
    ],
    [
      'no subscription',
      { subscription: null, latest: null, isTrailing: false },
      CREDIT_PACK_PAID_ERROR,
    ],
  ] as const)(
    'rejects a credit pack for %s',
    async (_label, state, message) => {
      packAccount = { ...packAccount, ...state };

      const result = await run(tool, { action: 'pack', pack: 'PACK_500' });

      expect(provider.buyPack).toHaveBeenCalledWith('org-1', 'user-1', 'PACK_500', '');
      expect(result.output).toEqual({ error: message });
      expect(result.output.url).toBeUndefined();
      expect(provider.subscribe).not.toHaveBeenCalled();
      expect(provider.changePlan).not.toHaveBeenCalled();
    }
  );

  it('returns a credit pack URL for a paid subscription and not for a copied allow list', async () => {
    packAccount = {
      ...packAccount,
      billingOrganizationId: 'org-bill',
      subscription: row('active'),
      latest: row('active'),
      isTrailing: false,
    };

    const result = await run(tool, { action: 'pack', pack: 'PACK_150', country: 'US' });

    expect(provider.buyPack).toHaveBeenCalledWith('org-bill', 'user-1', 'PACK_150', 'US');
    expect(result.output).toEqual({
      url: 'https://test.dodopayments.com/checkout/PACK_150',
    });
    expect(provider.subscribe).not.toHaveBeenCalled();
    expect(provider.changePlan).not.toHaveBeenCalled();
  });

  it('still returns a pack URL while a paid cancel day is open', async () => {
    const cancelAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    packAccount = {
      ...packAccount,
      subscription: row('cancel_scheduled', { cancelAt }),
      latest: row('cancel_scheduled', { cancelAt }),
      isTrailing: false,
    };

    const result = await run(tool, { action: 'pack', pack: 'PACK_150' });

    expect(result.output).toEqual({
      url: 'https://test.dodopayments.com/checkout/PACK_150',
    });
    expect(provider.changePlan).not.toHaveBeenCalled();
  });
});
