-- Additive Stalker Lite tables. No existing tables, columns, or enums are changed.

CREATE TYPE "StalkerCategory" AS ENUM ('IDEA', 'QUESTION', 'COMPLAINT', 'BUG', 'TESTIMONIAL', 'PRAISE', 'SPAM', 'OTHER');

CREATE TYPE "StalkerSource" AS ENUM ('YOUTUBE_COMMENT', 'YOUTUBE_SEARCH', 'INSTAGRAM_COMMENT', 'FACEBOOK_COMMENT');

CREATE TYPE "StalkerSentiment" AS ENUM ('POSITIVE', 'NEGATIVE', 'NEUTRAL');

CREATE TABLE "StalkerKeyword" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phrase" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StalkerKeyword_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StalkerTheme" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StalkerTheme_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StalkerMention" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT,
    "keywordId" TEXT,
    "themeId" TEXT,
    "externalId" TEXT NOT NULL,
    "source" "StalkerSource" NOT NULL,
    "category" "StalkerCategory" NOT NULL DEFAULT 'OTHER',
    "sentiment" "StalkerSentiment" NOT NULL DEFAULT 'NEUTRAL',
    "urgency" INTEGER NOT NULL DEFAULT 0,
    "authorName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "url" TEXT,
    "postExternalId" TEXT,
    "classifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StalkerMention_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StalkerKeyword_organizationId_phrase_key" ON "StalkerKeyword"("organizationId", "phrase");
CREATE INDEX "StalkerKeyword_organizationId_idx" ON "StalkerKeyword"("organizationId");
CREATE INDEX "StalkerTheme_organizationId_idx" ON "StalkerTheme"("organizationId");
CREATE UNIQUE INDEX "StalkerMention_organizationId_externalId_key" ON "StalkerMention"("organizationId", "externalId");
CREATE INDEX "StalkerMention_organizationId_idx" ON "StalkerMention"("organizationId");
CREATE INDEX "StalkerMention_organizationId_category_idx" ON "StalkerMention"("organizationId", "category");
CREATE INDEX "StalkerMention_organizationId_source_idx" ON "StalkerMention"("organizationId", "source");
CREATE INDEX "StalkerMention_organizationId_urgency_idx" ON "StalkerMention"("organizationId", "urgency");
CREATE INDEX "StalkerMention_classifiedAt_idx" ON "StalkerMention"("classifiedAt");
CREATE INDEX "StalkerMention_themeId_idx" ON "StalkerMention"("themeId");
CREATE INDEX "StalkerMention_keywordId_idx" ON "StalkerMention"("keywordId");
CREATE INDEX "StalkerMention_integrationId_idx" ON "StalkerMention"("integrationId");

ALTER TABLE "StalkerKeyword" ADD CONSTRAINT "StalkerKeyword_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StalkerTheme" ADD CONSTRAINT "StalkerTheme_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StalkerMention" ADD CONSTRAINT "StalkerMention_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StalkerMention" ADD CONSTRAINT "StalkerMention_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StalkerMention" ADD CONSTRAINT "StalkerMention_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "StalkerKeyword"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StalkerMention" ADD CONSTRAINT "StalkerMention_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "StalkerTheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;
