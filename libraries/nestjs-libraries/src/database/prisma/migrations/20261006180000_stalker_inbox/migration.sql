-- Stalker inbox: keyword groups, digest + custom alert rules, triage
-- statuses, and a public read-only dashboard token.
-- Additive and idempotent. prisma db push does not apply this file;
-- run it once against production.

ALTER TYPE "StalkerMentionStatus" ADD VALUE IF NOT EXISTS 'DONE';
ALTER TYPE "StalkerMentionStatus" ADD VALUE IF NOT EXISTS 'FOLLOW_UP';

ALTER TABLE "StalkerProject" ADD COLUMN IF NOT EXISTS "publicDashboard" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StalkerProject" ADD COLUMN IF NOT EXISTS "publicToken" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StalkerProject" ADD COLUMN IF NOT EXISTS "digestEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StalkerProject" ADD COLUMN IF NOT EXISTS "digestDismissed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StalkerProject" ADD COLUMN IF NOT EXISTS "digestHour" INTEGER NOT NULL DEFAULT 8;
ALTER TABLE "StalkerProject" ADD COLUMN IF NOT EXISTS "digestTimezone" TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE "StalkerProject" ADD COLUMN IF NOT EXISTS "digestGroupName" TEXT NOT NULL DEFAULT 'My brand';
ALTER TABLE "StalkerProject" ADD COLUMN IF NOT EXISTS "digestSentOn" TEXT NOT NULL DEFAULT '';

ALTER TABLE "StalkerKeyword" ADD COLUMN IF NOT EXISTS "groupId" TEXT;
ALTER TABLE "StalkerKeyword" ADD COLUMN IF NOT EXISTS "excludeAccounts" TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "StalkerKeyword_groupId_idx" ON "StalkerKeyword"("groupId");

CREATE TABLE IF NOT EXISTS "StalkerKeywordGroup" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StalkerKeywordGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StalkerKeywordGroup_projectId_name_key"
ON "StalkerKeywordGroup"("projectId", "name");
CREATE INDEX IF NOT EXISTS "StalkerKeywordGroup_projectId_idx"
ON "StalkerKeywordGroup"("projectId");

DO $$ BEGIN
  ALTER TABLE "StalkerKeywordGroup"
    ADD CONSTRAINT "StalkerKeywordGroup_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "StalkerProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StalkerKeyword"
    ADD CONSTRAINT "StalkerKeyword_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "StalkerKeywordGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "StalkerAlertRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StalkerAlertRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StalkerAlertRule_projectId_idx" ON "StalkerAlertRule"("projectId");
CREATE INDEX IF NOT EXISTS "StalkerAlertRule_organizationId_idx" ON "StalkerAlertRule"("organizationId");

DO $$ BEGIN
  ALTER TABLE "StalkerAlertRule"
    ADD CONSTRAINT "StalkerAlertRule_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StalkerAlertRule"
    ADD CONSTRAINT "StalkerAlertRule_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "StalkerProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
