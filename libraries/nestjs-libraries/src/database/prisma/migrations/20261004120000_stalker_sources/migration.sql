-- Additive Stalker sources. The 20261001150000_stalker_lite migration is unchanged.

ALTER TYPE "StalkerSource" ADD VALUE IF NOT EXISTS 'REDDIT_POST';
ALTER TYPE "StalkerSource" ADD VALUE IF NOT EXISTS 'REDDIT_COMMENT';
ALTER TYPE "StalkerSource" ADD VALUE IF NOT EXISTS 'X_POST';
ALTER TYPE "StalkerSource" ADD VALUE IF NOT EXISTS 'LINKEDIN_POST';

CREATE TABLE "StalkerSearchCache" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "phrase" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StalkerSearchCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StalkerSearchCache_platform_phrase_key" ON "StalkerSearchCache"("platform", "phrase");
CREATE INDEX "StalkerSearchCache_fetchedAt_idx" ON "StalkerSearchCache"("fetchedAt");
