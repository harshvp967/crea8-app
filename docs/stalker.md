# Stalker Lite

Stalker Lite is an audience-listening dashboard for Crea8one. It is off unless `STALKER_ENABLED` is the string `true`. Scheduling and publishing are unchanged when it is off, and the Schedule navigation items are unchanged when it is on. The only shared control is a Schedule | Stalker switcher in the top bar, which is hidden while the flag is off. The switcher list lives in `apps/frontend/src/components/dashboard/dashboard.switcher.tsx` so a later Automation dashboard can be added there.

## What it collects

For each organization, about every 6 hours:

1. Comments on the organization's own connected channels.
   - YouTube: one `commentThreads.list` for the channel (`allThreadsRelatedToChannelId`), up to 20 threads.
   - Instagram (Facebook Login and standalone): the 5 most recent media items, up to 20 comments each.
   - Facebook Pages: the 5 most recent posts, up to 20 comments each.
2. YouTube keyword search, using one connected YouTube account per organization (the first one that implements public search). Up to 5 saved keywords per run. Each keyword is one `search.list` (5 videos from the last 7 days) plus a `commentThreads.list` with `searchTerms` on each video (5 comments).

Mentions are stored once per organization and external id (`yt-comment:`, `yt-video:`, `ig-comment:`, `fb-comment:`). A later poll does not insert the same id again.

Tokens are the ones already stored for posting. Stalker does not refresh or disconnect a channel. A failed provider call is logged and skipped.

## Classification and themes

When `OPENAI_API_KEY` is set, new mentions are sent to `gpt-4.1` in batches of 20. Each mention gets a category (`IDEA`, `QUESTION`, `COMPLAINT`, `BUG`, `TESTIMONIAL`, `PRAISE`, `SPAM`, `OTHER`), a sentiment, and an urgency score from 0 to 100.

Themes are rebuilt from classified, non-spam mentions from the last 14 days. The model returns up to 8 titles, summaries, and the mention ids in each cluster. Counts are the number of linked mentions.

If there is no API key, mentions are still saved as unclassified (`OTHER`, `NEUTRAL`, urgency 0). Theme clustering is skipped. Create post still opens the composer, using the mention or theme text itself instead of a generated draft.

## Create post

On a mention, Create post asks `/stalker/draft` and opens the existing post composer with that text. A testimonial also has Make quote post. A theme has Create post. Nothing else in Stalker writes to the calendar.

## Data model

Additive Prisma models, scoped by `organizationId`:

- `StalkerKeyword` — saved phrases (maximum 10).
- `StalkerMention` — one row per external id.
- `StalkerTheme` — cluster title and summary. Mentions point at a theme.

Migration: `libraries/nestjs-libraries/src/database/prisma/migrations/20261001150000_stalker_lite/migration.sql`

It only creates types, tables, indexes, and foreign keys. This repo normally applies schema changes with `pnpm run prisma-db-push`. That command is additive for this change because no existing column is dropped or renamed. Do not pass a schema that removes columns.

## API

All routes require a signed-in organization and return 404 when the flag is off.

- `GET /stalker/status`
- `GET /stalker/mentions?category=&source=&minUrgency=`
- `GET /stalker/keywords`
- `POST /stalker/keywords` `{ "phrase": "..." }`
- `DELETE /stalker/keywords/:id`
- `GET /stalker/themes`
- `POST /stalker/draft` `{ "mentionId"?: "...", "themeId"?: "...", "mode": "post" | "quote" }`
- `POST /stalker/poll` — runs one check for the current organization (the Settings "Check now" button).

The 6-hour loop is the new Temporal workflow `stalkerPollWorkflow`. It starts from the backend only when `RUN_CRON=1` and `STALKER_ENABLED=true`. It does not change any existing workflow.

## Environment variables

Set the same flag on the frontend (Vercel) and the backend (Railway):

- `STALKER_ENABLED=true` — turns the API, the poll workflow, and the dashboard switcher on. Any other value, including unset, leaves Stalker off.
- `OPENAI_API_KEY` — already used by the app. Required for categories, themes, and generated drafts. Mentions still collect without it.
- `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET` — already used for YouTube connect. Keyword search and comment reads use the connected channel token. No new YouTube scope is requested. `youtubepartner` is not used.
- `RUN_CRON=1` on the backend process that registers long-running workflows, or the 6-hour loop never starts. "Check now" still works without it.

## YouTube quota

Costs are in YouTube Data API units, per organization, per 6-hour run, assuming the caps above:

| Call | Units | Cap per run |
| --- | --- | --- |
| Channel `commentThreads.list` | 1 | 1 per connected YouTube channel |
| Keyword `search.list` | 100 | 5 |
| Keyword `commentThreads.list` | 1 | 5 videos x 5 keywords = 25 |

A full keyword run is about 525 units plus 1 unit per extra YouTube channel, four times a day, about 2,100 units per day per organization. The default project quota is 10,000 units per day, so a few organizations fit. More organizations, or raising the keyword cap, will exhaust the quota and those searches will fail until the next day. Instagram and Facebook use the Graph API and do not spend YouTube units.

## UI

`/stalker` redirects to `/stalker/mentions`. The Stalker layout has its own sidebar: Mentions, Themes, Keywords, Settings. It does not render the Schedule menu. Schedule pages keep their existing menu. The switcher is the way between `/launches` and `/stalker/mentions`.
