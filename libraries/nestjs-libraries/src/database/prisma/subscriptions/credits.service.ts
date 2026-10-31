import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import {
  isBillingEnforced,
  isGrandfatheredOrg,
} from '@gitroom/helpers/utils/billing.enabled';
import { loadBillingAccount } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.account';
import { PLANS } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';
import {
  AI_POST_CALL_REASON,
  AI_POST_REASON,
  BillingBlocked,
  CreditBalance,
  CreditLedgerRow,
  aiPostCharge,
  creditUpgradeMessage,
  creditUsage,
  ledgerRowsForHistory,
  packGrantFromPayment,
  planSpend,
  workspaceOnTrial,
  postsCovered,
  stalkerReadCost,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.rules';

type Tx = Prisma.TransactionClient;

@Injectable()
export class CreditsService {
  constructor(private _prisma: PrismaService) {}

  private async poolId(organizationId: string, db: any = this._prisma) {
    if (
      !isBillingEnforced(organizationId) ||
      typeof db?.userOrganization?.findFirst !== 'function'
    ) {
      return organizationId;
    }
    const account = await loadBillingAccount(db, organizationId);
    return account.billingOrganizationId;
  }

  async balance(organizationId: string) {
    organizationId = await this.poolId(organizationId);
    await this.ensureGrandfather(organizationId);
    if (!isBillingEnforced(organizationId)) {
      return {
        enforced: false,
        monthlyRemaining: 0,
        packRemaining: 0,
        total: 0,
        cycleKey: null as string | null,
      };
    }
    const row = await this._prisma.creditBalance.findUnique({
      where: { organizationId },
    });
    const monthlyRemaining = row?.monthlyRemaining || 0;
    const packRemaining = row?.packRemaining || 0;
    return {
      enforced: true,
      monthlyRemaining,
      packRemaining,
      total: monthlyRemaining + packRemaining,
      cycleKey: row?.cycleKey || null,
    };
  }

  async history(organizationId: string, take = 40) {
    organizationId = await this.poolId(organizationId);
    const rows = await this._prisma.creditLedger.findMany({
      where: { organizationId, reason: { not: AI_POST_CALL_REASON } },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return ledgerRowsForHistory(rows);
  }

  async usage(organizationId: string, allowance: number) {
    organizationId = await this.poolId(organizationId);
    const balance = await this.balance(organizationId);
    if (!balance.enforced) {
      return null;
    }
    const entries = await this._prisma.creditLedger.findMany({
      where: { organizationId, cycleKey: balance.cycleKey },
    });
    return creditUsage({
      allowance,
      monthlyRemaining: balance.monthlyRemaining,
      packRemaining: balance.packRemaining,
      entries: entries.map(
        (entry): CreditLedgerRow => ({
          amount: entry.amount,
          type: entry.type,
          reason: entry.reason,
          idempotencyKey: entry.idempotencyKey,
        })
      ),
    });
  }

  async aiPostBlocked(organizationId: string) {
    organizationId = await this.poolId(organizationId);
    if (!(await this.billingActive(organizationId))) {
      return false;
    }
    const cost = await this.upcomingAiPostCost(organizationId);
    if (cost <= 0) {
      return false;
    }
    const row = await this._prisma.creditBalance.findUnique({
      where: { organizationId },
    });
    return (row?.monthlyRemaining || 0) + (row?.packRemaining || 0) < cost;
  }

  async recordAiPostCall(organizationId: string, idempotencyKey: string) {
    organizationId = await this.poolId(organizationId);
    if (!(await this.billingActive(organizationId))) {
      return { skipped: true as const, spent: 0, callNumber: 0 };
    }
    await this.ensureGrandfather(organizationId);
    return this._prisma.$transaction(async (tx) => {
      const existing = await tx.creditLedger.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return { skipped: false as const, duplicate: true, spent: 0, callNumber: 0 };
      }
      const row = await tx.creditBalance.upsert({
        where: { organizationId },
        create: { organizationId, monthlyRemaining: 0, packRemaining: 0 },
        update: {},
      });
      await tx.creditBalance.update({
        where: { organizationId },
        data: { monthlyRemaining: row.monthlyRemaining },
      });
      const prior = await tx.creditLedger.count({
        where: {
          organizationId,
          reason: AI_POST_CALL_REASON,
          cycleKey: row.cycleKey,
        },
      });
      const callNumber = prior + 1;
      const cost = aiPostCharge(callNumber);
      await tx.creditLedger.create({
        data: {
          organizationId,
          amount: 0,
          bucket: 'MONTHLY',
          type: 'SPEND',
          reason: AI_POST_CALL_REASON,
          cycleKey: row.cycleKey,
          idempotencyKey,
        },
      });
      if (cost > 0) {
        await this.spendIn(
          tx,
          organizationId,
          cost,
          AI_POST_REASON,
          `${idempotencyKey}:charge`,
          false
        );
      }
      return { skipped: false as const, duplicate: false, spent: cost, callNumber };
    });
  }

  async spendParts(
    organizationId: string,
    parts: { cost: number; reason: string; idempotencyKey: string }[]
  ) {
    organizationId = await this.poolId(organizationId);
    const billable = parts.filter((part) => part.cost > 0);
    if (billable.length === 0 || !(await this.billingActive(organizationId))) {
      return { skipped: true as const, spent: 0 };
    }
    await this.ensureGrandfather(organizationId);
    return this._prisma.$transaction(async (tx) => {
      let spent = 0;
      for (const part of billable) {
        const result = await this.spendIn(
          tx,
          organizationId,
          part.cost,
          part.reason,
          part.idempotencyKey,
          false
        );
        spent += result.spent;
      }
      return { skipped: false as const, spent };
    });
  }

  async spend(
    organizationId: string,
    cost: number,
    reason: string,
    idempotencyKey: string
  ) {
    organizationId = await this.poolId(organizationId);
    if (cost <= 0 || !(await this.billingActive(organizationId))) {
      return { skipped: true as const, spent: 0 };
    }
    await this.ensureGrandfather(organizationId);
    return this._prisma.$transaction((tx) =>
      this.spendIn(tx, organizationId, cost, reason, idempotencyKey, false)
    );
  }

  async spendStalkerReads(
    organizationId: string,
    postCount: number,
    idempotencyKey: string
  ) {
    organizationId = await this.poolId(organizationId);
    if (postCount <= 0 || !(await this.billingActive(organizationId))) {
      return { kept: postCount, spent: 0 };
    }
    const cost = stalkerReadCost(postCount);
    await this.ensureGrandfather(organizationId);
    const result = await this._prisma.$transaction((tx) =>
      this.spendIn(tx, organizationId, cost, 'stalker_read', idempotencyKey, true)
    );
    return {
      kept: postsCovered(result.spent, postCount),
      spent: result.spent,
    };
  }

  async refund(organizationId: string, idempotencyKey: string, reason: string) {
    organizationId = await this.poolId(organizationId);
    if (!(await this.billingActive(organizationId))) {
      return;
    }
    await this._prisma.$transaction(async (tx) => {
      const marker = `${idempotencyKey}:refund`;
      const already = await tx.creditLedger.findFirst({
        where: { organizationId, idempotencyKey: { startsWith: marker } },
      });
      if (already) {
        return;
      }
      const spends = await tx.creditLedger.findMany({
        where: {
          organizationId,
          amount: { lt: 0 },
          idempotencyKey: {
            in: [idempotencyKey, `${idempotencyKey}:monthly`, `${idempotencyKey}:pack`],
          },
        },
      });
      for (const spend of spends) {
        const amount = -spend.amount;
        await tx.creditBalance.update({
          where: { organizationId },
          data:
            spend.bucket === 'MONTHLY'
              ? { monthlyRemaining: { increment: amount } }
              : { packRemaining: { increment: amount } },
        });
        await tx.creditLedger.create({
          data: {
            organizationId,
            amount,
            bucket: spend.bucket,
            type: 'GRANT',
            reason,
            cycleKey: spend.cycleKey,
            idempotencyKey: spends.length > 1 ? `${marker}:${spend.bucket}` : marker,
          },
        });
      }
    });
  }

  private async spendIn(
    tx: Tx,
    organizationId: string,
    cost: number,
    reason: string,
    idempotencyKey: string,
    atMost: boolean
  ) {
    const prior = await tx.creditLedger.findMany({
      where: {
        organizationId,
        idempotencyKey: {
          in: [idempotencyKey, `${idempotencyKey}:monthly`, `${idempotencyKey}:pack`],
        },
      },
    });
    const row = await tx.creditBalance.upsert({
      where: { organizationId },
      create: { organizationId, monthlyRemaining: 0, packRemaining: 0 },
      update: {},
    });
    if (prior.length) {
      const spent = prior
        .filter((entry) => entry.amount < 0)
        .reduce((sum, entry) => sum + -entry.amount, 0);
      return {
        skipped: false as const,
        duplicate: true,
        spent,
        monthlyRemaining: row.monthlyRemaining,
        packRemaining: row.packRemaining,
      };
    }
    const available = row.monthlyRemaining + row.packRemaining;
    const charge = atMost ? Math.min(cost, available) : cost;
    if (charge <= 0) {
      return {
        skipped: false as const,
        duplicate: false,
        spent: 0,
        monthlyRemaining: row.monthlyRemaining,
        packRemaining: row.packRemaining,
      };
    }
    const plan = planSpend(
      { monthly: row.monthlyRemaining, pack: row.packRemaining } satisfies CreditBalance,
      charge
    );
    if (!plan.ok) {
      throw new BillingBlocked(creditUpgradeMessage());
    }
    const updated = await tx.creditBalance.updateMany({
      where: {
        organizationId,
        monthlyRemaining: { gte: plan.monthlySpend },
        packRemaining: { gte: plan.packSpend },
      },
      data: {
        monthlyRemaining: { decrement: plan.monthlySpend },
        packRemaining: { decrement: plan.packSpend },
      },
    });
    if (updated.count !== 1) {
      throw new BillingBlocked(creditUpgradeMessage());
    }
    if (plan.monthlySpend > 0) {
      await tx.creditLedger.create({
        data: {
          organizationId,
          amount: -plan.monthlySpend,
          bucket: 'MONTHLY',
          type: 'SPEND',
          reason,
          cycleKey: row.cycleKey,
          idempotencyKey: plan.packSpend
            ? `${idempotencyKey}:monthly`
            : idempotencyKey,
        },
      });
    }
    if (plan.packSpend > 0) {
      await tx.creditLedger.create({
        data: {
          organizationId,
          amount: -plan.packSpend,
          bucket: 'PACK',
          type: 'SPEND',
          reason,
          cycleKey: row.cycleKey,
          idempotencyKey: plan.monthlySpend
            ? `${idempotencyKey}:pack`
            : idempotencyKey,
        },
      });
    }
    return {
      skipped: false as const,
      duplicate: false,
      spent: charge,
      monthlyRemaining: plan.monthlyAfter,
      packRemaining: plan.packAfter,
    };
  }

  async grantMonthly(
    tx: Tx,
    organizationId: string,
    cycleKey: string,
    amount: number
  ) {
    return this.grantMonthlyIn(
      tx,
      await this.poolId(organizationId, tx),
      cycleKey,
      amount
    );
  }

  async applyReportedPackPayment(
    tx: Tx,
    data: any,
    organizationId?: string | null
  ) {
    const grant = packGrantFromPayment(data);
    if (!grant || grant.credits <= 0 || !grant.paymentId) {
      return false;
    }
    const org = grant.organizationId || organizationId || '';
    if (!org) {
      return false;
    }
    if (await this.workspaceIsOnTrial(tx, org)) {
      return false;
    }
    await this.grantPack(tx, org, grant.credits, `pack:${grant.paymentId}`);
    return true;
  }

  private async workspaceIsOnTrial(tx: Tx, organizationId: string) {
    if (typeof (tx as any)?.userOrganization?.findFirst === 'function') {
      const account = await loadBillingAccount(tx, organizationId);
      const subscription = account.subscription || account.latest;
      if (!subscription) {
        return false;
      }
      return workspaceOnTrial({
        status: subscription.status,
        isTrailing: account.isTrailing,
        deletedAt: subscription.deletedAt,
      });
    }
    const org = await tx.organization.findUnique({
      where: { id: organizationId },
      select: { isTrailing: true },
    });
    const subscription = await tx.subscription.findFirst({
      where: { organizationId, deletedAt: null },
      select: { status: true, deletedAt: true },
    });
    if (!subscription) {
      return false;
    }
    return workspaceOnTrial({
      status: subscription.status,
      isTrailing: org?.isTrailing,
      deletedAt: subscription.deletedAt,
    });
  }

  async applyCheckoutReturn(
    tx: Tx,
    query: { payment_id?: string | null; status?: string | null },
    payment?: any,
    organizationId?: string | null
  ) {
    const status = String(query?.status || payment?.status || '')
      .trim()
      .toLowerCase();
    if (status && status !== 'succeeded' && status !== 'paid') {
      return false;
    }
    const source = {
      ...(payment && typeof payment === 'object' ? payment : {}),
      payment_id: payment?.payment_id || query?.payment_id || '',
      status: payment?.status || query?.status || 'succeeded',
    };
    return this.applyReportedPackPayment(tx, source, organizationId);
  }

  async grantPack(tx: Tx, organizationId: string, credits: number, idempotencyKey: string) {
    organizationId = await this.poolId(organizationId, tx);
    const existing = await tx.creditLedger.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return existing;
    }
    await tx.creditBalance.upsert({
      where: { organizationId },
      create: {
        organizationId,
        monthlyRemaining: 0,
        packRemaining: credits,
      },
      update: { packRemaining: { increment: credits } },
    });
    return tx.creditLedger.create({
      data: {
        organizationId,
        amount: credits,
        bucket: 'PACK',
        type: 'GRANT',
        reason: 'credit_pack',
        idempotencyKey,
      },
    });
  }

  private async billingActive(organizationId: string) {
    if (isBillingEnforced(organizationId)) {
      return true;
    }
    const row = await this._prisma.creditBalance.findUnique({
      where: { organizationId },
      select: { organizationId: true },
    });
    return !!row;
  }

  private async upcomingAiPostCost(organizationId: string) {
    const row = await this._prisma.creditBalance.findUnique({
      where: { organizationId },
    });
    const prior = await this._prisma.creditLedger.count({
      where: {
        organizationId,
        reason: AI_POST_CALL_REASON,
        cycleKey: row?.cycleKey ?? null,
      },
    });
    return aiPostCharge(prior + 1);
  }

  private async ensureGrandfather(organizationId: string) {
    const pool = await this.poolId(organizationId);
    if (
      (!isGrandfatheredOrg(organizationId) && !isGrandfatheredOrg(pool)) ||
      !isBillingEnforced(organizationId)
    ) {
      return;
    }
    const cycleKey = `gf:${new Date().toISOString().slice(0, 7)}`;
    await this._prisma.$transaction((tx) =>
      this.grantMonthlyIn(
        tx,
        pool,
        cycleKey,
        PLANS.ULTIMATE.monthlyCredits
      )
    );
  }

  private async grantMonthlyIn(
    tx: Tx,
    organizationId: string,
    cycleKey: string,
    amount: number
  ) {
    const idempotencyKey = `monthly:${organizationId}:${cycleKey}`;
    const existing = await tx.creditLedger.findUnique({
      where: { idempotencyKey },
    });
    const row = await tx.creditBalance.upsert({
      where: { organizationId },
      create: { organizationId, monthlyRemaining: 0, packRemaining: 0 },
      update: {},
    });
    if (existing) {
      return row;
    }
    if (row.cycleKey && row.cycleKey !== cycleKey && row.monthlyRemaining > 0) {
      await tx.creditLedger.create({
        data: {
          organizationId,
          amount: -row.monthlyRemaining,
          bucket: 'MONTHLY',
          type: 'EXPIRE',
          reason: 'cycle_expire',
          cycleKey: row.cycleKey,
          idempotencyKey: `expire:${organizationId}:${row.cycleKey}`,
        },
      });
    }
    await tx.creditLedger.create({
      data: {
        organizationId,
        amount,
        bucket: 'MONTHLY',
        type: 'GRANT',
        reason: 'cycle_grant',
        cycleKey,
        idempotencyKey,
      },
    });
    return tx.creditBalance.update({
      where: { organizationId },
      data: { monthlyRemaining: amount, cycleKey },
    });
  }
}
