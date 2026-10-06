-- Stalker scan runs and the project last-scan watermark.
-- Additive and idempotent. prisma db push does not apply this file;
-- run it once against production (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- MIGRATION REQUIRED.

ALTER TABLE "StalkerProject" ADD COLUMN IF NOT EXISTS "lastScanAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "StalkerProject_lastScanAt_idx" ON "StalkerProject"("lastScanAt");

CREATE TABLE IF NOT EXISTS "StalkerScanRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "result" JSONB,
    "error" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StalkerScanRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StalkerScanRun_projectId_startedAt_idx"
ON "StalkerScanRun"("projectId", "startedAt" DESC);
CREATE INDEX IF NOT EXISTS "StalkerScanRun_organizationId_idx" ON "StalkerScanRun"("organizationId");
CREATE INDEX IF NOT EXISTS "StalkerScanRun_status_idx" ON "StalkerScanRun"("status");

DO $$ BEGIN
  ALTER TABLE "StalkerScanRun"
    ADD CONSTRAINT "StalkerScanRun_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StalkerScanRun"
    ADD CONSTRAINT "StalkerScanRun_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "StalkerProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
