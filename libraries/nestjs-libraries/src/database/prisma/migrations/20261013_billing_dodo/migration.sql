-- Billing ledger, webhook idempotency, and subscription status.
-- Do not apply this file until the owner approves it.
-- It is not run by CI and must not be applied to production from this PR.

ALTER TABLE "Subscription" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Subscription" ADD COLUMN "currentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "pendingTier" "SubscriptionTier";
ALTER TABLE "Subscription" ADD COLUMN "pendingPeriod" "Period";

CREATE TYPE "CreditBucket" AS ENUM ('MONTHLY', 'PACK');
CREATE TYPE "CreditEntryType" AS ENUM ('GRANT', 'SPEND', 'EXPIRE');

CREATE TABLE "CreditLedger" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "bucket" "CreditBucket" NOT NULL,
    "type" "CreditEntryType" NOT NULL,
    "reason" TEXT NOT NULL,
    "cycleKey" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreditLedger_idempotencyKey_key" ON "CreditLedger"("idempotencyKey");
CREATE INDEX "CreditLedger_organizationId_createdAt_idx" ON "CreditLedger"("organizationId", "createdAt");
CREATE INDEX "CreditLedger_organizationId_bucket_cycleKey_idx" ON "CreditLedger"("organizationId", "bucket", "cycleKey");

ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CreditBalance" (
    "organizationId" TEXT NOT NULL,
    "monthlyRemaining" INTEGER NOT NULL DEFAULT 0,
    "packRemaining" INTEGER NOT NULL DEFAULT 0,
    "cycleKey" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreditBalance_pkey" PRIMARY KEY ("organizationId")
);

ALTER TABLE "CreditBalance" ADD CONSTRAINT "CreditBalance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ProcessedWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProcessedWebhookEvent_provider_createdAt_idx" ON "ProcessedWebhookEvent"("provider", "createdAt");
