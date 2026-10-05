-- Scan cursors, content-hash de-dupe, relevance, and alert delivery.
-- Earlier Stalker migrations are unchanged. New columns are defaulted.

CREATE TYPE "StalkerAlertScope" AS ENUM ('URGENT', 'NEGATIVE', 'ALL');
CREATE TYPE "StalkerAlertDelivery" AS ENUM ('INSTANT', 'DIGEST');
CREATE TYPE "StalkerAlertKind" AS ENUM ('MENTION', 'VOLUME_SPIKE', 'SENTIMENT_DROP');
CREATE TYPE "StalkerAlertChannel" AS ENUM ('EMAIL', 'IN_APP');
CREATE TYPE "StalkerAlertStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

ALTER TABLE "StalkerProject" ADD COLUMN "alertScope" "StalkerAlertScope" NOT NULL DEFAULT 'URGENT';
ALTER TABLE "StalkerProject" ADD COLUMN "alertDelivery" "StalkerAlertDelivery" NOT NULL DEFAULT 'INSTANT';
ALTER TABLE "StalkerProject" ADD COLUMN "spikeEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StalkerProject" ADD COLUMN "spikeMultiplier" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "StalkerProject" ADD COLUMN "sentimentDropEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StalkerProject" ADD COLUMN "sentimentDropPoints" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "StalkerProject" ADD COLUMN "alertCooldownHours" INTEGER NOT NULL DEFAULT 12;

ALTER TABLE "StalkerMention" ADD COLUMN "relevant" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StalkerMention" ADD COLUMN "contentHash" TEXT NOT NULL DEFAULT '';

CREATE INDEX "StalkerMention_projectId_contentHash_idx" ON "StalkerMention"("projectId", "contentHash");
CREATE INDEX "StalkerMention_projectId_relevant_idx" ON "StalkerMention"("projectId", "relevant");

CREATE UNIQUE INDEX "StalkerMention_org_project_contentHash_key"
ON "StalkerMention" ("organizationId", "projectId", "contentHash")
WHERE "contentHash" <> '';

CREATE TABLE "StalkerScanCursor" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "phraseKey" TEXT NOT NULL,
    "cursorAt" TIMESTAMP(3),
    "backfillUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StalkerScanCursor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StalkerScanCursor_projectId_source_phraseKey_key" ON "StalkerScanCursor"("projectId", "source", "phraseKey");
CREATE INDEX "StalkerScanCursor_projectId_idx" ON "StalkerScanCursor"("projectId");

ALTER TABLE "StalkerScanCursor" ADD CONSTRAINT "StalkerScanCursor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "StalkerProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StalkerAlert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "mentionId" TEXT,
    "kind" "StalkerAlertKind" NOT NULL,
    "channel" "StalkerAlertChannel" NOT NULL,
    "status" "StalkerAlertStatus" NOT NULL DEFAULT 'PENDING',
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "error" TEXT NOT NULL DEFAULT '',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "readAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StalkerAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StalkerAlert_projectId_dedupeKey_key" ON "StalkerAlert"("projectId", "dedupeKey");
CREATE INDEX "StalkerAlert_projectId_createdAt_idx" ON "StalkerAlert"("projectId", "createdAt");
CREATE INDEX "StalkerAlert_organizationId_idx" ON "StalkerAlert"("organizationId");
CREATE INDEX "StalkerAlert_status_idx" ON "StalkerAlert"("status");
CREATE INDEX "StalkerAlert_mentionId_idx" ON "StalkerAlert"("mentionId");

ALTER TABLE "StalkerAlert" ADD CONSTRAINT "StalkerAlert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StalkerAlert" ADD CONSTRAINT "StalkerAlert_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "StalkerProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StalkerAlert" ADD CONSTRAINT "StalkerAlert_mentionId_fkey" FOREIGN KEY ("mentionId") REFERENCES "StalkerMention"("id") ON DELETE SET NULL ON UPDATE CASCADE;
