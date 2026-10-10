# Stalker Lite

Stalker Lite is an audience-listening dashboard for Crea8one. It is off unless `STALKER_ENABLED` is the string `true`. Scheduling and publishing are unchanged when it is off, and the Schedule navigation items are unchanged when it is on. The only shared control is a Schedule | Stalker switcher in the top bar, which is hidden while the flag is off. The switcher list lives in `apps/frontend/src/components/dashboard/dashboard.switcher.tsx` so a later Automation dashboard can be added there.

## Projects

A workspace listens per project. A project has a name, description, and one of six colors. The first wizard step also stores a brand name, aliases, per-platform handles, and negative keywords. Settings edits the same fields, plus an alert email and an optional `mention.created` webhook URL. Handles are suggested from connected channels (`Integration.profile`, otherwise the channel name). Keywords, custom categories, and mentions belong to that project. The left nav has a project switcher (the choice is stored in `localStorage` as `crea8-stalker-project`). A workspace with no project sees a three-step wizard: project, keywords (with an extra-keyword row and per-keyword X / Reddit / YouTube / LinkedIn toggles), then categories. Unavailable sources are greyed and keep a tooltip. Create project is one `POST /stalker/projects`.

Organizations with no project are not polled.

## What it collects

For each project, when it has not been scanned in `STALKER_PROJECT_INTERVAL_HOURS` (default 6). The orchestrator checks every `STALKER_POLL_MINUTES` (default 60) and starts one workflow per due project:

1. One brand search per enabled source, built by that source from the brand name, aliases, and handle (`"crea8one" OR @crea8one -from:crea8one` on X, name plus `u/` and `r/` on Reddit, name plus `@handle` joined with `|` on YouTube). Own posts are dropped when the author matches that project's handle. Negative keywords drop a hit. A public hit is kept only when the text contains a brand, alias, handle, or keyword as a whole word. Each kept row records what matched (`BRAND`, `ALIAS`, `HANDLE`, or `KEYWORD`).
2. Keyword search through `StalkerSourceProvider.search(keyword, since)`. A source runs only when it is enabled and the keyword's platform flag is on. Every flagged keyword is scanned, oldest cursor first, up to the 10 keyword cap. The same word-boundary and negative-keyword rules apply. Brand search does not wait on those flags.
   - YouTube: a connected channel token, refreshed on use when `tokenExpiration` is past or inside 5 minutes. A Google 401 forces one refresh and one retry. The refresh failure path is still `RefreshIntegrationService` (that is the only place a channel is disconnected). If `YOUTUBE_STALKER_API_KEY` is set, `search.list` and public `commentThreads.list` use that API key instead of the channel token. Channel-comment collection (`allThreadsRelatedToChannelId`) still needs the connected channel. `search.list` asks for 5 videos from the scan window, plus comments on those videos.
   - Reddit: app-only OAuth (`REDDIT_STALKER_CLIENT_ID` and `REDDIT_STALKER_CLIENT_SECRET`), User-Agent `web:crea8one-stalker:1.0 (by /u/crea8one)`, posts then comments, at least 1.1s between requests. Unset credentials leave Reddit off.
   - X: official recent search. `X_STALKER_BEARER_TOKEN` is used when it is set. Otherwise `X_API_KEY` and `X_API_SECRET` (the same app keys used for posting) are exchanged for an app-only bearer via `POST https://api.x.com/oauth2/token` with `grant_type=client_credentials`. That bearer is cached in memory and Redis and refreshed once after a 401. The start time stays inside the last 6 days. Each search asks for up to 100 posts per page (`max_results`) and follows `next_token` until `X_STALKER_MAX_RESULTS` (default 100, hard cap 200) or 3 pages, whichever comes first. The same query inside a minute is reused from memory. A 401 or 403 whose body says `client-not-enrolled` or that the app needs a higher access level is stored as `X plan doesn't include search (needs X API Basic or pay-per-use credits)`. A 429 whose `x-rate-limit-reset` is within 15 seconds is retried once; otherwise it is stored as `rate limited, retrying next scan`. Tokens are not logged.
   - LinkedIn: placeholder. `enabled()` is always false. No environment variable turns it on.
3. Comments on the organization's own connected channels, collected once and copied onto every project. These stay in the feed even when they do not contain the brand (own posts and negative keywords are still dropped). Search rows are stored first, so a comment that was also a search hit keeps its match tag.
   - YouTube: one `commentThreads.list` for the channel (`allThreadsRelatedToChannelId`), up to 20 threads. A reviewed reply uses `comments.insert` on a comment or `commentThreads.insert` on a video. Nothing is posted until the person clicks Send.
   - Instagram (Facebook Login and standalone): the 5 most recent media items, up to 20 comments each.
   - Facebook Pages: the 5 most recent posts, up to 20 comments each.

Search results are cached in `StalkerSearchCache` by platform, lowercased phrase, and the hour of the scan window, so the same keyword is not fetched again for another organization during that hour. A failed call is not cached. An empty result is cached. Each project, source, and phrase also stores a `StalkerScanCursor`. The next live scan starts one hour before that cursor, and never earlier than the last 7 days. A keyword backfill (`POST /stalker/keywords/:id/backfill`) sets a one-shot 30-day `backfillUntil` on that phrase. It does not move the live cursor backwards. X recent search still cannot see past about 6 days, and Reddit's search window is day, week, month, or year based on how far back the scan asks. Mentions are unique per organization, project, and external id (`yt-comment:`, `yt-video:`, `ig-comment:`, `fb-comment:`, `rd-post:`, `rd-comment:`, `x-post:`). The same text from the same author on the same platform family is also dropped by a `contentHash`, including a partial unique index that ignores empty hashes on older rows.

Tokens are the ones already stored for posting. Stalker refreshes a connected account before search, channel-comment collection, and reply when the access token is expired or inside 5 minutes, and once more if Google returns 401. A failed phrase is not cached and does not clear that phrase's backfill flag. `POST /stalker/poll` returns `{ sources: [{ projectId, id, ok, searched, found, stored, error? }], totals: { found, stored, duplicates, offTopic } }`. The 6-hour activity ignores that payload.

YouTube does not set `refreshCron`, so `startRefreshWorkflow` never starts `refresh_<integrationId>` for a YouTube channel. Posting and analytics already refresh YouTube on use; Stalker now does the same. Providers that do set `refreshCron` are re-armed with `TERMINATE_EXISTING` after a Stalker refresh succeeds. Background refresh for every integration, including ones whose workflow is missing, is still a follow-up: nothing in this change starts a workflow for YouTube.

## Classification and themes

When the project has categories, new mentions are classified in batches of 20. If `OPENAI_API_KEY` is set, `STALKER_OPENAI_MODEL` (default `gpt-4o-mini`) first decides whether the mention is about the brand (`relevant`). Off-topic keyword hits are stored with `relevant=false` and stay out of the Mentions feed unless the feed's "Show off-topic" filter is on. They are not alerted and they are not used for themes or analytics. The model then returns `categoryName`. Ids the model skips are asked again once. Anything still missing, and every mention when there is no API key, uses a word-list fallback so the row is still classified. Stalker stores the matching `StalkerProjectCategory` id. The older `StalkerCategory` enum stays on the row and is derived from the name (bug, feature/idea, complaint, question, testimonial, praise, spam, otherwise `OTHER`) so existing filters keep working. Sentiment is `POSITIVE`, `NEGATIVE`, or `NEUTRAL`. Urgency is 0 to 100.

If the project has no categories, mentions stay unclassified (`OTHER`, `NEUTRAL`, urgency 0).

Themes are rebuilt per project from classified, non-spam mentions from the last 14 days. Themes is in the sidebar. Draft post on a theme asks `/stalker/draft` and opens the Schedule composer.

Mention status is `NEW`, `REPLIED`, or `IGNORED`. Save marks a row, and Save testimonial or Save idea also points it at a matching project category when one exists.

When alerts are on, each matching mention is written to `StalkerAlert`. The default scope is bug, complaint, or urgency 70 or higher. The project can switch that to negative mentions or every relevant mention. In-app rows are marked sent immediately and listed on Alerts. Email rows stay pending until `EmailService.sendEmailSync` returns. Instant sends one email per mention. Digest sends one email for the pending mention batch on that check. Volume-spike and sentiment-drop rules are optional, email immediately, and will not fire again during the cooldown. A sent `dedupeKey` is not created again. A failed email stays `FAILED` and is retried on the next check, or from Retry failed email, up to three attempts. Mail still uses the app's existing sender settings and does not start the email workflow. If `EMAIL_FROM_ADDRESS` or `EMAIL_FROM_NAME` is missing, the email row is failed and the in-app row remains.

If the project has a webhook URL, each newly stored mention is POSTed as `{ "event": "mention.created", "projectId", "mention" }`. The URL is checked with `isSafePublicHttpsUrl` on save and again before the request, which uses `getSsrfSafeDispatcher`. This is separate from the post-integration Webhooks table.

## Create post and reply

Reply on a mention loads an AI draft from `/stalker/draft` into a review box. Send calls `POST /stalker/mentions/:id/reply`, which uses the connected account's `stalkerReply`. YouTube, Facebook, Instagram, and X implement it. If the mention has no connected account, Send fails and Draft post is still available. Draft post opens the existing Schedule composer. Nothing is sent or scheduled automatically.

## Saved views

`POST /stalker/views` stores the current Mentions filters under a name, up to 20 per project. Applying a view restores date, source, author, keyword, category, sentiment, status, search text, and match kind.

## Data model

`20261001150000_stalker_lite` is unchanged.

Later migrations, also additive:

- `20261004120000_stalker_sources` — `REDDIT_POST`, `REDDIT_COMMENT`, `X_POST`, `LINKEDIN_POST`, and `StalkerSearchCache`.
- `20261004130000_stalker_projects` — `StalkerProject`, `StalkerProjectCategory`, `StalkerMentionStatus`, nullable `projectId` on keywords, mentions, and themes, per-keyword listen flags, mention `categoryId` and `status`. The old unique keys on `(organizationId, phrase)` and `(organizationId, externalId)` are replaced by `(projectId, phrase)` and `(organizationId, projectId, externalId)` so two projects can store the same public post.
- `20261004140000_stalker_brand` — brand name, aliases, negative keywords, handles, alert email, webhook URL, `StalkerMatchKind`, match label, author handle, like and reply counts, saved flag, `StalkerSavedView`, and trigram indexes on mention text and author. Apply this SQL migration. `prisma db push` does not create the `pg_trgm` indexes; search still works without them.
- `20261005180000_stalker_alerts_cursors` — alert scope, delivery, spike and sentiment thresholds, `relevant`, `contentHash`, `StalkerScanCursor`, and `StalkerAlert`. Apply this SQL migration. `prisma db push` does not create the partial unique index on `contentHash`; the application still skips hashes it has already stored.
- `20261006153000_stalker_perf` — **MIGRATION REQUIRED.** `StalkerScanCursor.lastError` and `backfillDone`, plus indexes on `StalkerMention (projectId, createdAt DESC)`, `StalkerMention (projectId, relevant, createdAt DESC)`, and `StalkerAlert (projectId, readAt)`. The SQL is additive (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`). `prisma db push` creates the columns and indexes; production without a `_prisma_migrations` table should run this file once.
- `20261006200000_stalker_scan_runs` — **MIGRATION REQUIRED.** `StalkerProject.lastScanAt` and `StalkerScanRun` (trigger, status, per-source result, error). Additive (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`). `prisma db push` creates them; production without a `_prisma_migrations` table should run this file once.

A project can store 10 keywords and 12 categories. YouTube listens by default. Reddit, X, and LinkedIn do not, unless the keyword form turns them on. Reddit stays disabled in the form with "Needs API access" when its app credentials are missing. X shows that badge only when `X_STALKER_BEARER_TOKEN` and the `X_API_KEY` / `X_API_SECRET` pair are all unset. LinkedIn stays "Coming soon".

## API

All routes require a signed-in organization and return 404 when the flag is off.

- `GET /stalker/status` — poll settings plus which keyword and comment sources are available for this organization
- `GET /stalker/projects` and `POST /stalker/projects`
- `POST /stalker/projects/:id` — brand, handles, negative keywords, alert email, webhook URL
- `GET /stalker/mentions?projectId=&date=&source=&from=&keywordId=&categoryId=&sentiment=&status=&q=&match=&offTopic=&cursor=&take=` — returns `{ mentions, nextCursor }`. `take` defaults to 50 and caps at 100. `offTopic=include` shows keyword hits the relevance gate marked off-topic. Otherwise those rows are hidden.
- `GET /stalker/alerts?projectId=&cursor=&take=` — returns `{ alerts, nextCursor }`. `take` defaults to 50.
- `POST /stalker/keywords/:id` — updates `listenYoutube`, `listenReddit`, `listenX`, and `listenLinkedin` for an existing keyword.
- `POST /stalker/mentions/:id/status` `{ "status": "NEW" | "REPLIED" | "IGNORED" }`
- `POST /stalker/mentions/:id/reply` `{ "text" }` — sends through the connected account after review
- `POST /stalker/mentions/:id/save` `{ "saved": true, "as"?: "testimonial" | "idea" }`
- `GET /stalker/keywords?projectId=`
- `POST /stalker/keywords` `{ "projectId", "phrase", "youtube"?, "reddit"?, "x"?, "linkedin"? }`
- `DELETE /stalker/keywords/:id`
- `POST /stalker/keywords/:id/backfill` — queues a 30-day lookback for that keyword's enabled sources
- `GET /stalker/analytics?projectId=&date=` — `date` is `24h`, `7d`, `30d` (default), or `all`. Includes totals, volume, sentiment mix, sources, categories, keywords, themes, and accounts. Off-topic rows are excluded.
- `GET /stalker/alerts?projectId=`
- `POST /stalker/alerts/:id/read`
- `POST /stalker/alerts/retry` `{ "projectId" }` — retries failed or pending email and rechecks spike and sentiment rules
- `GET /stalker/export?projectId=` — same filters as Mentions, CSV in `{ filename, csv }`
- `GET /stalker/views?projectId=`, `POST /stalker/views`, `DELETE /stalker/views/:id`
- `GET /stalker/themes`
- `POST /stalker/draft` `{ "mentionId"?: "...", "themeId"?: "...", "mode": "post" | "quote" }`
- `POST /stalker/poll` — runs one check for the current organization (the Settings "Check now" button).

The 6-hour loop is the Temporal workflow `stalkerPollWorkflow`. It starts from the backend only when `RUN_CRON=1` and `STALKER_ENABLED=true`. Its activity signature is unchanged. It does not change any existing workflow.

## Environment variables

Set the same flag on the frontend (Vercel) and the backend (Railway):

- `STALKER_ENABLED=true` — turns the API, the poll workflow, and the dashboard switcher on. Any other value, including unset, leaves Stalker off.
- `OPENAI_API_KEY` — already used by the app. Required for categories, themes, suggested replies, and generated drafts. Mentions still collect without it.
- `STALKER_OPENAI_MODEL` — model for Stalker classification (relevance, category, sentiment), theme clustering, and AI reply or post drafts. Defaults to `gpt-4o-mini` when unset.
- `EMAIL_FROM_ADDRESS` and `EMAIL_FROM_NAME` — already used by the app. Urgent alerts are skipped when either is missing.
- `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET` — already used for YouTube connect. Keyword search and comment reads use the connected channel token. No new YouTube scope is requested. `youtubepartner` is not used.
- `REDDIT_STALKER_CLIENT_ID` and `REDDIT_STALKER_CLIENT_SECRET` — Reddit app-only credentials. Both must be set or Reddit search stays off.
- `X_STALKER_BEARER_TOKEN` — X API v2 recent search bearer. When unset, Stalker uses `X_API_KEY` and `X_API_SECRET` to mint an app-only bearer. X stays off only when neither the bearer nor both app keys are set.
- `X_STALKER_MAX_RESULTS` — how many recent posts one X search will collect. Default 100. Values above 200 are capped at 200. Values below 10 are raised to 10, which is the smallest `max_results` the recent search endpoint accepts.
- LinkedIn has no credential. It stays off.
- `RUN_CRON=1` on the backend process that registers long-running workflows, or the 6-hour loop never starts. "Check now" still works without it.

## YouTube quota

Costs are in YouTube Data API units, per organization, per 6-hour run, assuming the caps above:

| Call | Units | Cap per run |
| --- | --- | --- |
| Channel `commentThreads.list` | 1 | 1 per connected YouTube channel |
| Keyword `search.list` | 100 | 5 |
| Keyword `commentThreads.list` | 1 | 5 videos x 5 keywords = 25 |

A full keyword run is about 525 units plus 1 unit per extra YouTube channel. `StalkerSearchCache` reuses that result for every organization and project that watches the same phrase during the 6-hour window, so the quota is spent once per phrase, not once per workspace. Instagram, Facebook, Reddit, and X do not spend YouTube units.

## UI

`/stalker` redirects to `/stalker/mentions`. The sidebar is Mentions, Analytics, Themes, Keywords, Alerts, Settings, plus the project switcher. A workspace with no project sees the wizard instead of that nav. Mentions can be filtered by date, source, author, keyword, category, sentiment, status, free text, and what matched. Saved views store that combination. The feed is grouped by day. With no rows and no filters, the empty state is `No mentions yet. Stalker is listening for mentions of <project>`. Analytics defaults to the last 30 days and includes volume, sentiment mix, sources, categories, keywords, themes, and the accounts that mention the brand most. Alerts edits the rules and lists delivery state. Keywords can queue a 30-day backfill. Mentions can export the current filters as CSV. The Schedule menu is unchanged. The switcher is the way between `/launches` and `/stalker/mentions`. Usage caps are not enforced.
