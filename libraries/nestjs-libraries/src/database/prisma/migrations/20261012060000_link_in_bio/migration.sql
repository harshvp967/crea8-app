-- Additive Link-in-Bio tables. No existing tables, columns, or enums are changed.

CREATE TYPE "LinkBlockType" AS ENUM ('LINK', 'FEATURED_POST', 'EMAIL_CAPTURE', 'HEADING');

CREATE TYPE "LinkDomainStatus" AS ENUM ('NONE', 'WAITING', 'VERIFYING', 'LIVE', 'ERROR');

CREATE TYPE "LinkLeadStatus" AS ENUM ('PENDING', 'CONFIRMED');

CREATE TYPE "LinkEventType" AS ENUM ('VIEW', 'CLICK');

CREATE TABLE "LinkPage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "avatarPath" TEXT NOT NULL DEFAULT '',
    "theme" TEXT NOT NULL DEFAULT 'midnight',
    "buttonStyle" TEXT NOT NULL DEFAULT 'pill',
    "font" TEXT NOT NULL DEFAULT 'Plus Jakarta Sans',
    "backgroundMode" TEXT NOT NULL DEFAULT 'colour',
    "backgroundColor" TEXT NOT NULL DEFAULT '',
    "backgroundImage" TEXT NOT NULL DEFAULT '',
    "seoTitle" TEXT NOT NULL DEFAULT '',
    "seoDescription" TEXT NOT NULL DEFAULT '',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "hideBadge" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "customDomain" TEXT,
    "domainStatus" "LinkDomainStatus" NOT NULL DEFAULT 'NONE',
    "domainHostnameId" TEXT NOT NULL DEFAULT '',
    "domainError" TEXT NOT NULL DEFAULT '',
    "domainTxtName" TEXT NOT NULL DEFAULT '',
    "domainTxtValue" TEXT NOT NULL DEFAULT '',
    "domainCheckedAt" TIMESTAMP(3),
    "captureHeading" TEXT NOT NULL DEFAULT 'Get one creator tip a week',
    "captureButton" TEXT NOT NULL DEFAULT 'Subscribe',
    "captureConsent" TEXT NOT NULL DEFAULT 'I agree to get emails from crea8.one. Unsubscribe anytime.',
    "captureAskName" BOOLEAN NOT NULL DEFAULT false,
    "captureDoubleOptIn" BOOLEAN NOT NULL DEFAULT true,
    "captureNotify" BOOLEAN NOT NULL DEFAULT false,
    "socials" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LinkBlock" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "type" "LinkBlockType" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL DEFAULT '',
    "priority" BOOLEAN NOT NULL DEFAULT false,
    "scheduleOn" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "postId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LinkBlock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LinkEvent" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "blockId" TEXT,
    "type" "LinkEventType" NOT NULL,
    "country" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "referrer" TEXT NOT NULL DEFAULT '',
    "day" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LinkLead" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "blockId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "referrer" TEXT NOT NULL DEFAULT '',
    "sourceBlock" TEXT NOT NULL DEFAULT 'Email capture',
    "status" "LinkLeadStatus" NOT NULL DEFAULT 'PENDING',
    "confirmToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkLead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LinkPage_organizationId_key" ON "LinkPage"("organizationId");
CREATE UNIQUE INDEX "LinkPage_slug_key" ON "LinkPage"("slug");
CREATE UNIQUE INDEX "LinkPage_customDomain_key" ON "LinkPage"("customDomain");
CREATE INDEX "LinkPage_domainStatus_idx" ON "LinkPage"("domainStatus");

CREATE INDEX "LinkBlock_pageId_position_idx" ON "LinkBlock"("pageId", "position");
CREATE INDEX "LinkBlock_pageId_deletedAt_idx" ON "LinkBlock"("pageId", "deletedAt");
CREATE INDEX "LinkBlock_postId_idx" ON "LinkBlock"("postId");
CREATE INDEX "LinkBlock_deletedAt_idx" ON "LinkBlock"("deletedAt");

CREATE INDEX "LinkEvent_pageId_day_type_idx" ON "LinkEvent"("pageId", "day", "type");
CREATE INDEX "LinkEvent_pageId_type_createdAt_idx" ON "LinkEvent"("pageId", "type", "createdAt");
CREATE INDEX "LinkEvent_blockId_type_idx" ON "LinkEvent"("blockId", "type");
CREATE INDEX "LinkEvent_createdAt_idx" ON "LinkEvent"("createdAt");

CREATE UNIQUE INDEX "LinkLead_pageId_email_key" ON "LinkLead"("pageId", "email");
CREATE UNIQUE INDEX "LinkLead_confirmToken_key" ON "LinkLead"("confirmToken");
CREATE INDEX "LinkLead_pageId_createdAt_idx" ON "LinkLead"("pageId", "createdAt");
CREATE INDEX "LinkLead_pageId_status_idx" ON "LinkLead"("pageId", "status");
CREATE INDEX "LinkLead_blockId_idx" ON "LinkLead"("blockId");

ALTER TABLE "LinkPage" ADD CONSTRAINT "LinkPage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LinkBlock" ADD CONSTRAINT "LinkBlock_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "LinkPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LinkBlock" ADD CONSTRAINT "LinkBlock_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LinkEvent" ADD CONSTRAINT "LinkEvent_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "LinkPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LinkEvent" ADD CONSTRAINT "LinkEvent_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "LinkBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LinkLead" ADD CONSTRAINT "LinkLead_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "LinkPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LinkLead" ADD CONSTRAINT "LinkLead_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "LinkBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
