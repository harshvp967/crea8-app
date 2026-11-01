-- Workspace webhook event selection. Additive. Not applied to production from this change.
-- Existing Webhooks rows gain Schedule post published and post failed.
-- No columns, tables, or rows are dropped.

ALTER TABLE "Webhooks"
  ADD COLUMN IF NOT EXISTS "events" TEXT[] NOT NULL DEFAULT ARRAY['post.published', 'post.failed']::TEXT[];
