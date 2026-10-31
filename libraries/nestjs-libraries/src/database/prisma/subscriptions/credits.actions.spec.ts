import { CreditsService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/credits.service';
import { CREDIT_COSTS, TRIAL_MONTHLY_CREDITS } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';
import {
  BillingBlocked,
  CREDIT_PACK_TRIAL_ERROR,
  creditPackCheckoutError,
  creditTracker,
  xPostSpendParts,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.rules';

type Balance = {
  organizationId: string;
  monthlyRemaining: number;
  packRemaining: number;
  cycleKey: string | null;
};

type LedgerRow = {
  id: string;
  organizationId: string;
  amount: number;
  bucket: string;
  type: string;
  reason: string;
  cycleKey: string | null;
  idempotencyKey: string;
  createdAt: Date;
};

function applyBalanceUpdate(row: Balance, data: Record<string, any>) {
  for (const [key, value] of Object.entries(data || {})) {
    if (value && typeof value === 'object' && 'increment' in value) {
      (row as any)[key] = ((row as any)[key] || 0) + value.increment;
    } else if (value && typeof value === 'object' && 'decrement' in value) {
      (row as any)[key] = ((row as any)[key] || 0) - value.decrement;
    } else {
      (row as any)[key] = value;
    }
  }
}

function ledgerMatches(row: LedgerRow, where: Record<string, any> | undefined) {
  if (!where) {
    return true;
  }
  if (where.organizationId && row.organizationId !== where.organizationId) {
    return false;
  }
  if ('cycleKey' in where && row.cycleKey !== where.cycleKey) {
    return false;
  }
  if (typeof where.reason === 'string' && row.reason !== where.reason) {
    return false;
  }
  if (where.reason?.not && row.reason === where.reason.not) {
    return false;
  }
  if (where.amount?.lt !== undefined && !(row.amount < where.amount.lt)) {
    return false;
  }
  if (typeof where.idempotencyKey === 'string' && row.idempotencyKey !== where.idempotencyKey) {
    return false;
  }
  if (where.idempotencyKey?.in && !where.idempotencyKey.in.includes(row.idempotencyKey)) {
    return false;
  }
  if (
    where.idempotencyKey?.startsWith &&
    !String(row.idempotencyKey).startsWith(where.idempotencyKey.startsWith)
  ) {
    return false;
  }
  return true;
}

function memoryPrisma() {
  const balances = new Map<string, Balance>();
  const ledger: LedgerRow[] = [];
  const webhooks = new Map<string, { id: string }>();
  const organizations = new Map<string, { id: string; isTrailing: boolean }>();
  const subscriptions = new Map<
    string,
    { organizationId: string; status: string; deletedAt: Date | null }
  >();
  let seq = 0;
  const api: any = {
    creditBalance: {
      findUnique: async ({ where }: { where: { organizationId: string } }) =>
        balances.get(where.organizationId) || null,
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { organizationId: string };
        create: Balance;
        update: Record<string, any>;
      }) => {
        const existing = balances.get(where.organizationId);
        if (!existing) {
          const row: Balance = {
            organizationId: create.organizationId,
            monthlyRemaining: create.monthlyRemaining || 0,
            packRemaining: create.packRemaining || 0,
            cycleKey: create.cycleKey ?? null,
          };
          balances.set(where.organizationId, row);
          return row;
        }
        applyBalanceUpdate(existing, update);
        return existing;
      },
      update: async ({
        where,
        data,
      }: {
        where: { organizationId: string };
        data: Record<string, any>;
      }) => {
        const row = balances.get(where.organizationId);
        if (!row) {
          throw new Error('missing balance');
        }
        applyBalanceUpdate(row, data);
        return row;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: {
          organizationId: string;
          monthlyRemaining?: { gte: number };
          packRemaining?: { gte: number };
        };
        data: Record<string, any>;
      }) => {
        const row = balances.get(where.organizationId);
        if (!row) {
          return { count: 0 };
        }
        if (
          row.monthlyRemaining < (where.monthlyRemaining?.gte ?? 0) ||
          row.packRemaining < (where.packRemaining?.gte ?? 0)
        ) {
          return { count: 0 };
        }
        applyBalanceUpdate(row, data);
        return { count: 1 };
      },
    },
    creditLedger: {
      findUnique: async ({ where }: { where: { idempotencyKey: string } }) =>
        ledger.find((row) => row.idempotencyKey === where.idempotencyKey) || null,
      findFirst: async ({ where }: { where: Record<string, any> }) =>
        ledger.find((row) => ledgerMatches(row, where)) || null,
      findMany: async ({ where }: { where?: Record<string, any> }) =>
        ledger.filter((row) => ledgerMatches(row, where)),
      count: async ({ where }: { where?: Record<string, any> }) =>
        ledger.filter((row) => ledgerMatches(row, where)).length,
      create: async ({ data }: { data: Omit<LedgerRow, 'id' | 'createdAt' | 'cycleKey'> & { cycleKey?: string | null } }) => {
        if (ledger.some((row) => row.idempotencyKey === data.idempotencyKey)) {
          const err = new Error('unique') as Error & { code?: string };
          err.code = 'P2002';
          throw err;
        }
        const row: LedgerRow = {
          ...data,
          id: `led_${++seq}`,
          createdAt: new Date(),
          cycleKey: data.cycleKey ?? null,
        };
        ledger.push(row);
        return row;
      },
    },
    organization: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        organizations.get(where.id) || null,
    },
    subscription: {
      findFirst: async ({
        where,
      }: {
        where: { organizationId: string; deletedAt: null };
      }) => {
        const row = subscriptions.get(where.organizationId);
        if (!row || row.deletedAt) {
          return null;
        }
        return row;
      },
    },
    setWorkspace(
      organizationId: string,
      input: { status?: string | null; isTrailing?: boolean }
    ) {
      organizations.set(organizationId, {
        id: organizationId,
        isTrailing: !!input.isTrailing,
      });
      if (!input.status) {
        subscriptions.delete(organizationId);
        return;
      }
      subscriptions.set(organizationId, {
        organizationId,
        status: input.status,
        deletedAt: null,
      });
    },
    processedWebhookEvent: {
      findUnique: async ({ where }: { where: { id: string } }) => webhooks.get(where.id) || null,
      create: async ({ data }: { data: { id: string; provider: string; eventType: string } }) => {
        if (webhooks.has(data.id)) {
          const err = new Error('unique') as Error & { code?: string };
          err.code = 'P2002';
          throw err;
        }
        webhooks.set(data.id, data);
        return data;
      },
    },
    $transaction: async (fn: (tx: any) => Promise<any>) => {
      const snapshot = {
        balances: new Map([...balances].map(([key, value]) => [key, { ...value }])),
        ledger: ledger.map((row) => ({ ...row })),
        webhooks: new Map(webhooks),
      };
      try {
        return await fn(api);
      } catch (err) {
        balances.clear();
        for (const [key, value] of snapshot.balances) {
          balances.set(key, value);
        }
        ledger.splice(0, ledger.length, ...snapshot.ledger);
        webhooks.clear();
        for (const [key, value] of snapshot.webhooks) {
          webhooks.set(key, value);
        }
        throw err;
      }
    },
  };
  return api;
}

describe('credit ledger action charges', () => {
  const previousBilling = process.env.BILLING_ENABLED;
  const previousProducts = process.env.DODO_PRODUCTS;
  const previousKey = process.env.DODO_PAYMENTS_API_KEY;

  beforeEach(() => {
    process.env.BILLING_ENABLED = 'true';
    delete process.env.DODO_PRODUCTS;
    delete process.env.DODO_PAYMENTS_API_KEY;
  });

  afterEach(() => {
    if (previousBilling === undefined) {
      delete process.env.BILLING_ENABLED;
    } else {
      process.env.BILLING_ENABLED = previousBilling;
    }
    if (previousProducts === undefined) {
      delete process.env.DODO_PRODUCTS;
    } else {
      process.env.DODO_PRODUCTS = previousProducts;
    }
    if (previousKey === undefined) {
      delete process.env.DODO_PAYMENTS_API_KEY;
    } else {
      process.env.DODO_PAYMENTS_API_KEY = previousKey;
    }
  });

  async function seeded(organizationId: string) {
    const db = memoryPrisma();
    const credits = new CreditsService(db as any);
    await db.$transaction((tx: any) =>
      credits.grantMonthly(tx, organizationId, 'trial:2026-10', TRIAL_MONTHLY_CREDITS)
    );
    return { db, credits };
  }

  it('deducts each billed action on the existing ledger and counts them in the breakdown', async () => {
    const org = 'org-actions';
    const { credits } = await seeded(org);
    expect(TRIAL_MONTHLY_CREDITS).toBe(50);
    expect(CREDIT_COSTS.aiImage).toBe(3);
    expect(CREDIT_COSTS.xPost).toBe(1);
    expect(CREDIT_COSTS.xPostWithUrl).toBe(13);
    expect(CREDIT_COSTS.aiPostsPerCredit).toBe(2);

    const image = await credits.spend(org, CREDIT_COSTS.aiImage, 'ai_image', 'img:1');
    expect(image.spent).toBe(3);

    const firstIdea = await credits.recordAiPostCall(org, 'idea:1');
    const secondIdea = await credits.recordAiPostCall(org, 'idea:2');
    expect(firstIdea.spent).toBe(0);
    expect(secondIdea.spent).toBe(1);

    const brandVoice = await credits.recordAiPostCall(org, 'brand-voice:1');
    expect(brandVoice.spent).toBe(0);

    const plainParts = xPostSpendParts(['hello from crea8']);
    const linkedParts = xPostSpendParts(['read https://crea8.one/pricing']);
    expect(plainParts).toEqual([
      { cost: 1, reason: 'x_post' },
      { cost: 0, reason: 'x_post_with_link' },
    ]);
    expect(linkedParts).toEqual([
      { cost: 0, reason: 'x_post' },
      { cost: 13, reason: 'x_post_with_link' },
    ]);
    await credits.spendParts(
      org,
      plainParts.map((part) => ({ ...part, idempotencyKey: `xpost:plain:${part.reason}` }))
    );
    await credits.spendParts(
      org,
      linkedParts.map((part) => ({ ...part, idempotencyKey: `xpost:link:${part.reason}` }))
    );

    const balance = await credits.balance(org);
    expect(balance.monthlyRemaining).toBe(50 - 3 - 1 - 1 - 13);
    expect(balance.packRemaining).toBe(0);
    const usage = await credits.usage(org, TRIAL_MONTHLY_CREDITS);
    expect(usage?.used).toBe(18);
    expect(usage?.left).toBe(32);
    expect(usage?.actions).toEqual([
      { key: 'ai_post', count: 3, credits: 1 },
      { key: 'x_post', count: 1, credits: 1 },
      { key: 'x_post_with_link', count: 1, credits: 13 },
      { key: 'ai_image', count: 1, credits: 3 },
      { key: 'stalker_search', count: 0, credits: 0 },
    ]);
  });

  it('charges the second AI post call, including a brand-voice learn, as one credit', async () => {
    const { credits } = await seeded('org-pair');
    const idea = await credits.recordAiPostCall('org-pair', 'idea:1');
    const voice = await credits.recordAiPostCall('org-pair', 'brand-voice:1');
    expect(idea.spent).toBe(0);
    expect(voice.spent).toBe(1);
    const usage = await credits.usage('org-pair', TRIAL_MONTHLY_CREDITS);
    expect(usage?.actions[0]).toEqual({ key: 'ai_post', count: 2, credits: 1 });
    expect(usage?.used).toBe(1);
  });

  it('still charges an X post when the process flag is off but the ledger balance exists', async () => {
    const { credits } = await seeded('org-worker');
    delete process.env.BILLING_ENABLED;
    const plain = await credits.spend('org-worker', CREDIT_COSTS.xPost, 'x_post', 'xpost:a:plain');
    const linked = await credits.spend(
      'org-worker',
      CREDIT_COSTS.xPostWithUrl,
      'x_post_with_link',
      'xpost:b:link'
    );
    expect(plain.spent).toBe(1);
    expect(linked.spent).toBe(13);
    process.env.BILLING_ENABLED = 'true';
    const balance = await credits.balance('org-worker');
    expect(balance.monthlyRemaining).toBe(50 - 1 - 13);
    const usage = await credits.usage('org-worker', TRIAL_MONTHLY_CREDITS);
    expect(usage?.actions.find((action) => action.key === 'x_post')).toEqual({
      key: 'x_post',
      count: 1,
      credits: 1,
    });
    expect(usage?.actions.find((action) => action.key === 'x_post_with_link')).toEqual({
      key: 'x_post_with_link',
      count: 1,
      credits: 13,
    });
  });

  it('does not charge an organization that has no credit balance while billing is off', async () => {
    const db = memoryPrisma();
    const credits = new CreditsService(db as any);
    delete process.env.BILLING_ENABLED;
    const spent = await credits.spend('org-free', 1, 'x_post', 'xpost:free');
    expect(spent).toEqual({ skipped: true, spent: 0 });
  });

  it('blocks the next paid AI post call when the balance is empty', async () => {
    const db = memoryPrisma();
    const credits = new CreditsService(db as any);
    const first = await credits.recordAiPostCall('org-empty', 'idea:1');
    expect(first.spent).toBe(0);
    await expect(credits.recordAiPostCall('org-empty', 'idea:2')).rejects.toBeInstanceOf(
      BillingBlocked
    );
    expect(await credits.aiPostBlocked('org-empty')).toBe(true);
  });

  async function paymentSucceeded(db: any, credits: CreditsService, id: string, data: any) {
    const existing = await db.processedWebhookEvent.findUnique({ where: { id } });
    if (existing) {
      return { duplicate: true };
    }
    await db.$transaction(async (tx: any) => {
      await tx.processedWebhookEvent.create({
        data: { id, provider: 'dodo', eventType: 'payment.succeeded' },
      });
      await credits.applyReportedPackPayment(tx, data);
    });
    return { duplicate: false };
  }

  it('grants a 150 credit pack from the payment webhook once', async () => {
    const db = memoryPrisma();
    const credits = new CreditsService(db as any);
    const paid = {
      payment_id: 'pay_150',
      status: 'succeeded',
      metadata: {
        organizationId: 'org-pack',
        userId: 'user-1',
        kind: 'credit_pack',
        pack: 'PACK_150',
        credits: 150,
      },
    };
    await paymentSucceeded(db, credits, 'msg_pack', paid);
    await paymentSucceeded(db, credits, 'msg_pack', paid);
    await paymentSucceeded(db, credits, 'msg_pack_replay', paid);
    await paymentSucceeded(db, credits, 'msg_sub', {
      payment_id: 'pay_sub',
      subscription_id: 'sub_1',
      status: 'succeeded',
      metadata: {
        organizationId: 'org-pack',
        kind: 'subscription',
        billing: 'STANDARD',
      },
    });
    const balance = await credits.balance('org-pack');
    expect(balance.packRemaining).toBe(150);
    expect(balance.monthlyRemaining).toBe(0);
    const usage = await credits.usage('org-pack', TRIAL_MONTHLY_CREDITS);
    expect(usage?.packCredits).toBe(150);
    expect(usage?.used).toBe(0);
  });

  it('grants the pack when the webhook only carries the pack key', async () => {
    const db = memoryPrisma();
    const credits = new CreditsService(db as any);
    await paymentSucceeded(db, credits, 'msg_key_only', {
      payment_id: 'pay_key',
      status: 'succeeded',
      metadata: {
        organizationId: 'org-key',
        pack: 'PACK_150',
      },
    });
    const balance = await credits.balance('org-key');
    expect(balance.packRemaining).toBe(150);
    expect(balance.monthlyRemaining).toBe(0);
  });

  it('rejects credit pack checkout while the workspace is on a trial', () => {
    expect(
      creditPackCheckoutError({ status: 'trialing', isTrailing: true, deletedAt: null })
    ).toBe(CREDIT_PACK_TRIAL_ERROR);
    expect(
      creditPackCheckoutError({ status: 'active', isTrailing: true, deletedAt: null })
    ).toBe(CREDIT_PACK_TRIAL_ERROR);
    expect(
      creditPackCheckoutError({ status: 'active', isTrailing: false, deletedAt: null })
    ).toBeNull();
    expect(creditPackCheckoutError(null)).toBeNull();
    expect(
      creditPackCheckoutError({ status: 'trial_ended', isTrailing: false, deletedAt: null })
    ).toBeNull();
  });

  it('grants a paid subscriber the 150 pack once from the payment webhook', async () => {
    const db = memoryPrisma();
    const credits = new CreditsService(db as any);
    db.setWorkspace('org-paid', { status: 'active', isTrailing: false });
    const paid = {
      payment_id: 'pay_paid_150',
      status: 'succeeded',
      total_amount: 590,
      currency: 'USD',
      subscription_id: 'sub_paid',
      product_cart: [{ product_id: 'pdt_pack_150', quantity: 1 }],
      metadata: {
        organizationId: 'org-paid',
        userId: 'user-1',
        kind: 'credit_pack',
        billing: 'STANDARD',
        period: 'MONTHLY',
        pack: 'PACK_150',
        credits: '150',
      },
    };
    process.env.DODO_PRODUCTS = JSON.stringify({ PACK_150: 'pdt_pack_150' });
    await paymentSucceeded(db, credits, 'evt_paid', paid);
    await paymentSucceeded(db, credits, 'evt_paid', paid);
    await paymentSucceeded(db, credits, 'evt_paid_replay', paid);
    await db.$transaction((tx: any) =>
      credits.applyCheckoutReturn(
        tx,
        { payment_id: paid.payment_id, status: 'succeeded' },
        paid,
        'org-paid'
      )
    );
    const balance = await credits.balance('org-paid');
    expect(balance.packRemaining).toBe(150);
    expect(balance.monthlyRemaining).toBe(0);
    const usage = await credits.usage('org-paid', 300);
    expect(usage?.packCredits).toBe(150);
    expect(usage?.allowance).toBe(300);
    const tracker = creditTracker(usage!);
    expect(tracker.allowance).toBe(450);
    expect(tracker.packCredits).toBe(150);

    const trial = memoryPrisma();
    const trialCredits = new CreditsService(trial as any);
    trial.setWorkspace('org-trial', { status: 'trialing', isTrailing: true });
    await paymentSucceeded(trial, trialCredits, 'evt_trial', {
      ...paid,
      payment_id: 'pay_trial_150',
      metadata: { ...paid.metadata, organizationId: 'org-trial' },
    });
    const trialBalance = await trialCredits.balance('org-trial');
    expect(trialBalance.packRemaining).toBe(0);
    expect(TRIAL_MONTHLY_CREDITS).toBe(50);
  });
});
