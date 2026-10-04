-- Projects, custom categories, per-keyword platforms, and mention status.
-- 20261001150000_stalker_lite is unchanged. New columns are nullable or defaulted.

CREATE TYPE "StalkerMentionStatus" AS ENUM ('NEW', 'REPLIED', 'IGNORED');

CREATE TABLE "StalkerProject" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#00D9FF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StalkerProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StalkerProjectCategory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StalkerProjectCategory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StalkerKeyword" ADD COLUMN "projectId" TEXT;
ALTER TABLE "StalkerKeyword" ADD COLUMN "listenYoutube" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StalkerKeyword" ADD COLUMN "listenReddit" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StalkerKeyword" ADD COLUMN "listenX" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StalkerKeyword" ADD COLUMN "listenLinkedin" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "StalkerTheme" ADD COLUMN "projectId" TEXT;

ALTER TABLE "StalkerMention" ADD COLUMN "projectId" TEXT;
ALTER TABLE "StalkerMention" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "StalkerMention" ADD COLUMN "status" "StalkerMentionStatus" NOT NULL DEFAULT 'NEW';

DROP INDEX "StalkerKeyword_organizationId_phrase_key";
CREATE UNIQUE INDEX "StalkerKeyword_projectId_phrase_key" ON "StalkerKeyword"("projectId", "phrase");
CREATE INDEX "StalkerKeyword_projectId_idx" ON "StalkerKeyword"("projectId");

DROP INDEX "StalkerMention_organizationId_externalId_key";
CREATE UNIQUE INDEX "StalkerMention_organizationId_projectId_externalId_key" ON "StalkerMention"("organizationId", "projectId", "externalId");
CREATE INDEX "StalkerMention_projectId_idx" ON "StalkerMention"("projectId");
CREATE INDEX "StalkerMention_projectId_status_idx" ON "StalkerMention"("projectId", "status");
CREATE INDEX "StalkerMention_categoryId_idx" ON "StalkerMention"("categoryId");
CREATE INDEX "StalkerTheme_projectId_idx" ON "StalkerTheme"("projectId");
CREATE INDEX "StalkerProject_organizationId_idx" ON "StalkerProject"("organizationId");
CREATE UNIQUE INDEX "StalkerProjectCategory_projectId_name_key" ON "StalkerProjectCategory"("projectId", "name");
CREATE INDEX "StalkerProjectCategory_projectId_idx" ON "StalkerProjectCategory"("projectId");

ALTER TABLE "StalkerProject" ADD CONSTRAINT "StalkerProject_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StalkerProjectCategory" ADD CONSTRAINT "StalkerProjectCategory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "StalkerProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StalkerKeyword" ADD CONSTRAINT "StalkerKeyword_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "StalkerProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StalkerTheme" ADD CONSTRAINT "StalkerTheme_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "StalkerProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StalkerMention" ADD CONSTRAINT "StalkerMention_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "StalkerProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StalkerMention" ADD CONSTRAINT "StalkerMention_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "StalkerProjectCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
