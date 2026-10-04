-- Brand identity, negative keywords, and what each mention matched.
-- Earlier Stalker migrations are unchanged. New columns are defaulted.

ALTER TABLE "StalkerProject" ADD COLUMN "brandName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StalkerProject" ADD COLUMN "aliases" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StalkerProject" ADD COLUMN "exclusions" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StalkerProject" ADD COLUMN "handleX" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StalkerProject" ADD COLUMN "handleRedditUser" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StalkerProject" ADD COLUMN "handleRedditSubreddit" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StalkerProject" ADD COLUMN "handleYoutube" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StalkerProject" ADD COLUMN "handleLinkedin" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StalkerProject" ADD COLUMN "handleInstagram" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StalkerProject" ADD COLUMN "handleFacebook" TEXT NOT NULL DEFAULT '';

CREATE TYPE "StalkerMatchKind" AS ENUM ('BRAND', 'ALIAS', 'HANDLE', 'KEYWORD');

ALTER TABLE "StalkerMention" ADD COLUMN "matchKind" "StalkerMatchKind";
ALTER TABLE "StalkerMention" ADD COLUMN "matchLabel" TEXT NOT NULL DEFAULT '';

CREATE INDEX "StalkerMention_matchKind_idx" ON "StalkerMention"("matchKind");

-- Speeds up the Mentions search box (ILIKE on text and author).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "StalkerMention_text_trgm_idx" ON "StalkerMention" USING GIN ("text" gin_trgm_ops);
CREATE INDEX "StalkerMention_authorName_trgm_idx" ON "StalkerMention" USING GIN ("authorName" gin_trgm_ops);

ALTER TABLE "StalkerMention" ADD COLUMN "authorHandle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StalkerMention" ADD COLUMN "likeCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StalkerMention" ADD COLUMN "replyCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StalkerMention" ADD COLUMN "saved" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "StalkerProject" ADD COLUMN "alertEmail" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StalkerProject" ADD COLUMN "alertsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StalkerProject" ADD COLUMN "webhookUrl" TEXT NOT NULL DEFAULT '';

CREATE TABLE "StalkerSavedView" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StalkerSavedView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StalkerSavedView_projectId_name_key" ON "StalkerSavedView"("projectId", "name");
CREATE INDEX "StalkerSavedView_projectId_idx" ON "StalkerSavedView"("projectId");
CREATE INDEX "StalkerSavedView_organizationId_idx" ON "StalkerSavedView"("organizationId");

ALTER TABLE "StalkerSavedView" ADD CONSTRAINT "StalkerSavedView_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StalkerSavedView" ADD CONSTRAINT "StalkerSavedView_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "StalkerProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
