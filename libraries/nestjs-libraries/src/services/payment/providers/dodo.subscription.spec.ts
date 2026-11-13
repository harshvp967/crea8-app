const mockApi = {
  subscriptions: {
    retrieve: jest.fn(),
    update: jest.fn(),
    changePlan: jest.fn(),
    list: jest.fn(),
  },
  checkoutSessions: {
    create: jest.fn(),
  },
  payments: {
    list: jest.fn(),
    retrieve: jest.fn(),
  },
  customers: {
    customerPortal: { create: jest.fn() },
  },
};

jest.mock('dodopayments', () => {
  return jest.fn().mockImplementation(() => mockApi);
});

jest.mock('@gitroom/nestjs-libraries/database/prisma/users/users.service', () => ({
  UsersService: class UsersService {},
}));

jest.mock('@gitroom/nestjs-libraries/database/prisma/organizations/organization.service', () => ({
  OrganizationService: class OrganizationService {},
}));

import { DodoProvider } from '@gitroom/nestjs-libraries/services/payment/providers/dodo.provider';
import { BillingReadService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.read.service';

const MONTHLY_PRODUCT = 'prod_ultimate_monthly';
const YEARLY_PRODUCT = 'prod_ultimate_yearly';

function listedPage(
  rows: Array<{
    subscription_id: string;
    status: string;
    created_at: string;
    product_id: string;
    next_billing_date?: string;
    customer?: { customer_id: string };
  }>
) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const row of rows) {
        yield row;
      }
    },
  };
}

function monthlyRow() {
  return {
    subscription_id: 'sub_monthly',
    status: 'active',
    created_at: '2026-11-07T00:00:00.000Z',
    product_id: MONTHLY_PRODUCT,
    next_billing_date: '2026-12-07T00:00:00.000Z',
    customer: { customer_id: 'cus_1' },
  };
}

function yearlyRow() {
  return {
    subscription_id: 'sub_yearly',
    status: 'active',
    created_at: '2026-11-13T00:00:00.000Z',
    product_id: YEARLY_PRODUCT,
    next_billing_date: '2027-10-27T00:00:00.000Z',
    customer: { customer_id: 'cus_1' },
  };
}

function storedMonthly() {
  return {
    organizationId: 'org-1',
    subscriptionTier: 'ULTIMATE',
    status: 'active',
    period: 'MONTHLY',
    provider: 'dodo',
    identifier: 'sub_monthly',
    deletedAt: null as Date | null,
    cancelAt: null as Date | null,
    currentPeriodEnd: new Date('2026-12-07T00:00:00.000Z'),
    pendingTier: null as string | null,
    pendingPeriod: null as string | null,
    isLifetime: false,
    createdAt: new Date('2026-11-07T00:00:00.000Z'),
    updatedAt: new Date('2026-11-07T00:00:00.000Z'),
  };
}

describe('Dodo keeps one live subscription', () => {
  const previousKey = process.env.DODO_PAYMENTS_API_KEY;
  const previousMonthly = process.env.DODO_PRODUCT_ULTIMATE_MONTHLY;
  const previousYearly = process.env.DODO_PRODUCT_ULTIMATE_YEARLY;
  const previousProducts = process.env.DODO_PRODUCTS;

  let prisma: any;
  let orgs: { getOrgById: jest.Mock };
  let users: { getUserById: jest.Mock };
  let credits: { balance: jest.Mock; grantMonthly: jest.Mock };
  let tx: any;
  let provider: DodoProvider;

  beforeEach(() => {
    process.env.DODO_PAYMENTS_API_KEY = 'test_key';
    process.env.DODO_PRODUCT_ULTIMATE_MONTHLY = MONTHLY_PRODUCT;
    process.env.DODO_PRODUCT_ULTIMATE_YEARLY = YEARLY_PRODUCT;
    delete process.env.DODO_PRODUCTS;

    tx = {
      processedWebhookEvent: { create: jest.fn() },
      subscription: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      organization: { findFirst: jest.fn(), update: jest.fn() },
      creditBalance: { findUnique: jest.fn() },
    };
    prisma = {
      userOrganization: { findFirst: jest.fn().mockResolvedValue(null) },
      organization: { findUnique: jest.fn() },
      subscription: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      processedWebhookEvent: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (run: any) => run(tx)),
    };
    orgs = { getOrgById: jest.fn() };
    users = { getUserById: jest.fn() };
    credits = {
      balance: jest.fn().mockResolvedValue({ cycleKey: '2026-12-07T00:00:00.000Z' }),
      grantMonthly: jest.fn(),
    };
    mockApi.subscriptions.retrieve.mockReset();
    mockApi.subscriptions.update.mockReset();
    mockApi.subscriptions.changePlan.mockReset();
    mockApi.subscriptions.list.mockReset();
    mockApi.checkoutSessions.create.mockReset();
    mockApi.subscriptions.update.mockResolvedValue({});
    mockApi.subscriptions.changePlan.mockResolvedValue({});
    mockApi.subscriptions.list.mockImplementation(async () =>
      listedPage([monthlyRow(), yearlyRow()])
    );
    provider = new DodoProvider(prisma, orgs as any, users as any, credits as any);
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.DODO_PAYMENTS_API_KEY;
    else process.env.DODO_PAYMENTS_API_KEY = previousKey;
    if (previousMonthly === undefined) delete process.env.DODO_PRODUCT_ULTIMATE_MONTHLY;
    else process.env.DODO_PRODUCT_ULTIMATE_MONTHLY = previousMonthly;
    if (previousYearly === undefined) delete process.env.DODO_PRODUCT_ULTIMATE_YEARLY;
    else process.env.DODO_PRODUCT_ULTIMATE_YEARLY = previousYearly;
    if (previousProducts === undefined) delete process.env.DODO_PRODUCTS;
    else process.env.DODO_PRODUCTS = previousProducts;
  });

  function orgWithMonthly() {
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      isTrailing: false,
      allowTrial: false,
      paymentId: 'cus_1',
      subscription: storedMonthly(),
    });
    orgs.getOrgById.mockResolvedValue({
      id: 'org-1',
      paymentId: 'cus_1',
      isTrailing: false,
    });
    prisma.subscription.findFirst.mockResolvedValue(storedMonthly());
  }

  function body(period: 'MONTHLY' | 'YEARLY') {
    return {
      billing: 'ULTIMATE' as const,
      period,
      utm: '',
      dub: '',
      datafast_session_id: '',
      datafast_visitor_id: '',
      country: 'US',
    };
  }

  it('changes monthly to yearly on the existing subscription', async () => {
    orgWithMonthly();

    const result = await provider.subscribe('track', 'org-1', 'user-1', body('YEARLY'), false);

    expect(result).toMatchObject({ changed: true, upgrade: true });
    expect(mockApi.subscriptions.update).toHaveBeenCalledWith('sub_yearly', {
      status: 'cancelled',
    });
    expect(mockApi.subscriptions.changePlan).toHaveBeenCalledWith(
      'sub_monthly',
      expect.objectContaining({
        product_id: YEARLY_PRODUCT,
        quantity: 1,
        proration_billing_mode: 'prorated_immediately',
        effective_at: 'immediately',
        on_payment_failure: 'prevent_change',
      })
    );
    expect(mockApi.checkoutSessions.create).not.toHaveBeenCalled();
    expect(mockApi.subscriptions.update).not.toHaveBeenCalledWith(
      'sub_monthly',
      expect.anything()
    );
  });

  it('does not open a second checkout for the plan the workspace already has', async () => {
    orgWithMonthly();

    const result = await provider.subscribe('track', 'org-1', 'user-1', body('MONTHLY'), false);

    expect(result).toEqual({ changed: false, current: true });
    expect(mockApi.checkoutSessions.create).not.toHaveBeenCalled();
    expect(mockApi.subscriptions.changePlan).not.toHaveBeenCalled();
    expect(mockApi.subscriptions.update).toHaveBeenCalledWith('sub_yearly', {
      status: 'cancelled',
    });
  });

  it('uses plan change when Dodo already has a subscription and the local row does not', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      isTrailing: false,
      allowTrial: false,
      paymentId: 'cus_1',
      subscription: null,
    });
    orgs.getOrgById.mockResolvedValue({
      id: 'org-1',
      paymentId: 'cus_1',
      isTrailing: false,
    });
    prisma.subscription.findFirst.mockResolvedValue(null);
    mockApi.subscriptions.list.mockImplementation(async () => listedPage([monthlyRow()]));

    const result = await provider.subscribe('track', 'org-1', 'user-1', body('YEARLY'), false);

    expect(result).toMatchObject({ changed: true });
    expect(mockApi.subscriptions.changePlan).toHaveBeenCalledWith(
      'sub_monthly',
      expect.objectContaining({ product_id: YEARLY_PRODUCT })
    );
    expect(mockApi.checkoutSessions.create).not.toHaveBeenCalled();
  });

  it('cancels a second active subscription from its webhook and keeps the stored plan', async () => {
    tx.subscription.findUnique.mockResolvedValue(storedMonthly());
    mockApi.subscriptions.retrieve.mockResolvedValue({
      ...yearlyRow(),
      metadata: { organizationId: 'org-1', billing: 'ULTIMATE', period: 'YEARLY' },
    });

    const result = await provider.processWebhook({
      id: 'evt_yearly',
      payload: {
        type: 'subscription.active',
        data: {
          subscription_id: 'sub_yearly',
          metadata: { organizationId: 'org-1' },
        },
      },
    });

    expect(result).toEqual({ ok: true });
    expect(mockApi.subscriptions.update).toHaveBeenCalledWith('sub_yearly', {
      status: 'cancelled',
    });
    expect(mockApi.subscriptions.update).not.toHaveBeenCalledWith(
      'sub_monthly',
      expect.anything()
    );
    expect(tx.subscription.upsert).not.toHaveBeenCalled();
    expect(tx.organization.update).not.toHaveBeenCalled();
  });

  it('cancels the other active subscription when the stored subscription webhook arrives', async () => {
    tx.subscription.findUnique.mockResolvedValue(storedMonthly());
    tx.creditBalance.findUnique.mockResolvedValue({ cycleKey: '2026-12-07' });
    tx.organization.update.mockResolvedValue({});
    tx.subscription.upsert.mockResolvedValue({});
    mockApi.subscriptions.retrieve.mockResolvedValue({
      ...monthlyRow(),
      metadata: { organizationId: 'org-1', billing: 'ULTIMATE', period: 'MONTHLY' },
    });

    await provider.processWebhook({
      id: 'evt_monthly',
      payload: {
        type: 'subscription.renewed',
        data: { subscription_id: 'sub_monthly' },
      },
    });

    expect(tx.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
        update: expect.objectContaining({
          identifier: 'sub_monthly',
          subscriptionTier: 'ULTIMATE',
          period: 'MONTHLY',
        }),
      })
    );
    expect(mockApi.subscriptions.update).toHaveBeenCalledWith('sub_yearly', {
      status: 'cancelled',
    });
  });

  it('cancels the stray subscription on the next billing read and leaves the shown plan', async () => {
    orgs.getOrgById.mockResolvedValue({ id: 'org-1', paymentId: 'cus_1' });
    prisma.subscription.findUnique.mockResolvedValue(storedMonthly());

    await provider.reconcileLiveSubscriptions('org-1');

    expect(mockApi.subscriptions.update).toHaveBeenCalledWith('sub_yearly', {
      status: 'cancelled',
    });
    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it('rewrites the stored plan when the only live subscription is a different one', async () => {
    orgs.getOrgById.mockResolvedValue({ id: 'org-1', paymentId: 'cus_1' });
    prisma.subscription.findUnique.mockResolvedValue({
      ...storedMonthly(),
      status: 'cancelled',
      deletedAt: new Date('2026-11-12T00:00:00.000Z'),
    });
    mockApi.subscriptions.list.mockImplementation(async () =>
      listedPage([
        { ...monthlyRow(), status: 'cancelled' },
        yearlyRow(),
      ])
    );

    await provider.reconcileLiveSubscriptions('org-1');

    expect(mockApi.subscriptions.update).not.toHaveBeenCalled();
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
      data: expect.objectContaining({
        identifier: 'sub_yearly',
        subscriptionTier: 'ULTIMATE',
        period: 'YEARLY',
        status: 'active',
        deletedAt: null,
        pendingTier: null,
        pendingPeriod: null,
      }),
    });
  });

  it('cancels every live subscription when the account is deleted', async () => {
    orgs.getOrgById.mockResolvedValue({ id: 'org-1', paymentId: 'cus_1' });
    prisma.subscription.findFirst.mockResolvedValue(storedMonthly());

    await provider.cancelAllSubscriptions('org-1');

    expect(mockApi.subscriptions.update).toHaveBeenCalledWith('sub_monthly', {
      status: 'cancelled',
    });
    expect(mockApi.subscriptions.update).toHaveBeenCalledWith('sub_yearly', {
      status: 'cancelled',
    });
    expect(mockApi.checkoutSessions.create).not.toHaveBeenCalled();
  });
});

describe('billing read reconciles the live subscription', () => {
  const previous = process.env.BILLING_ENABLED;

  afterEach(() => {
    if (previous === undefined) delete process.env.BILLING_ENABLED;
    else process.env.BILLING_ENABLED = previous;
  });

  it('asks Dodo to reconcile on the billing overview read', async () => {
    process.env.BILLING_ENABLED = 'true';
    const dodo = {
      reconcileSucceededPacks: jest.fn(),
      reconcileLiveSubscriptions: jest.fn(),
      invoices: jest.fn().mockResolvedValue([]),
    };
    const entitlements = {
      account: jest.fn().mockResolvedValue({
        billingOrganizationId: 'org-1',
        paymentId: 'cus_1',
        subscription: storedMonthly(),
        latest: storedMonthly(),
        isTrailing: false,
        allowTrial: false,
        grandfathered: false,
      }),
      tier: jest.fn().mockResolvedValue('ULTIMATE'),
      usage: jest.fn().mockResolvedValue({
        channels: { used: 0, limit: 100 },
        teamMembers: { used: 1, limit: null },
        keywords: { used: 0, limit: 75 },
        webhooks: { used: 0, limit: 10000 },
        posts: { used: 0, limit: 1000000 },
        stalkerChecks: { used: 0, limit: null },
      }),
    };
    const credits = {
      balance: jest.fn().mockResolvedValue({
        monthlyRemaining: 10,
        packRemaining: 0,
        total: 10,
        cycleKey: '2026-12',
      }),
      history: jest.fn().mockResolvedValue([]),
    };
    const service = new BillingReadService(
      entitlements as any,
      credits as any,
      dodo as any
    );

    await service.overview({ id: 'org-1', paymentId: 'cus_1', isTrailing: false } as any);

    expect(dodo.reconcileLiveSubscriptions).toHaveBeenCalledWith('org-1');
  });
});
