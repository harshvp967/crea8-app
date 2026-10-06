-- Stalker relevance backfill (one-off, idempotent, NOT run on boot).
--
-- Before the relevance fix, the AI gate marked mentions of tracked keywords
-- (e.g. competitors like "canva") as off-topic, so they were hidden everywhere.
-- This marks a mention relevant when:
--   * it is linked to a keyword ("keywordId" set) or matched one (matchKind = KEYWORD), or
--   * its text contains, as a whole word, the phrase of a keyword that still exists
--     in the same project (case-insensitive).
-- Mentions that match neither the brand nor a keyword are left untouched (off-topic).
-- It only flips relevant=false -> true, so re-running it changes nothing.
-- Sentiment/urgency of these rows stay as stored (they are NOT re-classified, so no
-- alert or digest e-mails fire for old mentions).
--
-- Run: pre-check, then the UPDATE in one transaction, then post-check
-- (e.g. via the usual temporary Railway Function with ${{Postgres.DATABASE_URL}}).

-- ===== PRE / POST CHECK (read-only) =====
SELECT m."projectId",
       count(*) FILTER (WHERE m.relevant)      AS relevant,
       count(*) FILTER (WHERE NOT m.relevant)  AS off_topic,
       count(*) FILTER (WHERE NOT m.relevant AND (
         m."keywordId" IS NOT NULL OR m."matchKind" = 'KEYWORD' OR EXISTS (
           SELECT 1 FROM "StalkerKeyword" k
            WHERE k."projectId" = m."projectId" AND length(trim(k.phrase)) >= 2
              AND m.text ~* ('(^|[^[:alnum:]_])'
                  || regexp_replace(trim(k.phrase), '([!$()*+.:<=>?[\\\]^{|}-])', '\\\1', 'g')
                  || '($|[^[:alnum:]_])')
         ))) AS would_fix
  FROM "StalkerMention" m
 GROUP BY m."projectId"
 ORDER BY 1;

-- ===== APPLY (one transaction) =====
BEGIN;
UPDATE "StalkerMention" m
   SET relevant = true
 WHERE m.relevant = false
   AND (
     m."keywordId" IS NOT NULL
     OR m."matchKind" = 'KEYWORD'
     OR EXISTS (
       SELECT 1 FROM "StalkerKeyword" k
        WHERE k."projectId" = m."projectId" AND length(trim(k.phrase)) >= 2
          AND m.text ~* ('(^|[^[:alnum:]_])'
              || regexp_replace(trim(k.phrase), '([!$()*+.:<=>?[\\\]^{|}-])', '\\\1', 'g')
              || '($|[^[:alnum:]_])')
     )
   );
COMMIT;
