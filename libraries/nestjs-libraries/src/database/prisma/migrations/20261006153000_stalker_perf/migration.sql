-- Stalker scan feedback and mention/alert read indexes.
-- Additive and idempotent. prisma db push does not apply this file;
-- run it once against production (CREATE INDEX IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

ALTER TABLE "StalkerScanCursor" ADD COLUMN IF NOT EXISTS "lastError" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StalkerScanCursor" ADD COLUMN IF NOT EXISTS "backfillDone" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "StalkerMention_projectId_createdAt_idx"
ON "StalkerMention" ("projectId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "StalkerMention_projectId_relevant_createdAt_idx"
ON "StalkerMention" ("projectId", "relevant", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "StalkerAlert_projectId_readAt_idx"
ON "StalkerAlert" ("projectId", "readAt");
