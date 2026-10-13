import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import {
  isBillingEnforced,
  isGrandfatheredOrg,
} from '@gitroom/helpers/utils/billing.enabled';
import { PLANS } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';
import {
  BillingBlocked,
  CreditBalance,
  creditUpgradeMessage,
  planSpend,
  postsCovered,
  stalkerReadCost,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.rules';

type Tx = Prisma.TransactionClient;

@Injectable()
export class CreditsService {
  constructor(private _prisma: PrismaService) {}

  async balance(organizationId: string) {
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

  history(organizationId: string, take = 40) {
    return this._prisma.creditLedger.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async spend(
    organizationId: string,
    cost: number,
    reason: string,
    idempotencyKey: string
  ) {
    if (!isBillingEnforced(organizationId) || cost <= 0) {
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
    if (!isBillingEnforced(organizationId) || postCount <= 0) {
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
    if (!isBillingEnforced(organizationId)) {
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

  grantMonthly(
    tx: Tx,
    organizationId: string,
    cycleKey: string,
    amount: number
  ) {
    return this.grantMonthlyIn(tx, organizationId, cycleKey, amount);
  }

  async grantPack(tx: Tx, organizationId: string, credits: number, idempotencyKey: string) {
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

  private async ensureGrandfather(organizationId: string) {
    if (!isGrandfatheredOrg(organizationId) || !isBillingEnforced(organizationId)) {
      return;
    }
    const cycleKey = `gf:${new Date().toISOString().slice(0, 7)}`;
    await this._prisma.$transaction((tx) =>
      this.grantMonthlyIn(
        tx,
        organizationId,
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
