# Stalker Lite

Stalker Lite is an audience-listening dashboard for Crea8one. It is off unless `STALKER_ENABLED` is the string `true`. Scheduling and publishing are unchanged when it is off, and the Schedule navigation items are unchanged when it is on. The only shared control is a Schedule | Stalker switcher in the top bar, which is hidden while the flag is off. The switcher list lives in `apps/frontend/src/components/dashboard/dashboard.switcher.tsx` so a later Automation dashboard can be added there.

## Projects

A workspace listens per project. A project has a name, description, and one of six colors. Keywords, custom categories, and mentions belong to that project. The left nav has a project switcher (the choice is stored in `localStorage` as `crea8-stalker-project`). A workspace with no project sees a three-step wizard: project, keywords (with an extra-keyword row and per-keyword X / Reddit / YouTube / LinkedIn toggles), then categories. Unavailable sources are greyed and keep a tooltip. Create project is one `POST /stalker/projects`.

Organizations with no project are not polled.

## What it collects

For each project, about every 6 hours:

1. Comments on the organization's own connected channels, collected once and copied onto every project.
   - YouTube: one `commentThreads.list` for the channel (`allThreadsRelatedToChannelId`), up to 20 threads.
   - Instagram (Facebook Login and standalone): the 5 most recent media items, up to 20 comments each.
   - Facebook Pages: the 5 most recent posts, up to 20 comments each.
2. Keyword search through `StalkerSourceProvider.search(keyword, since)`. A source runs only when it is enabled and the keyword's platform flag is on. Up to 5 flagged keywords per source per run.
   - YouTube: a connected channel token. `search.list` (5 videos from the last 7 days) plus comments on those videos.
   - Reddit: app-only OAuth (`REDDIT_STALKER_CLIENT_ID` and `REDDIT_STALKER_CLIENT_SECRET`), User-Agent `web:crea8one-stalker:1.0 (by /u/crea8one)`, posts then comments, at least 1.1s between requests. Unset credentials leave Reddit off.
   - X: official recent search when `X_STALKER_BEARER_TOKEN` is set. The start time stays inside the last 6 days.
   - LinkedIn: placeholder. `enabled()` is always false. No environment variable turns it on.

Search results are cached in `StalkerSearchCache` by platform and lowercased phrase for the 6-hour poll window, so the same keyword is not fetched again for another organization. A failed call is not cached. An empty result is cached. Mentions are unique per organization, project, and external id (`yt-comment:`, `yt-video:`, `ig-comment:`, `fb-comment:`, `rd-post:`, `rd-comment:`, `x-post:`).

Tokens are the ones already stored for posting. Stalker does not refresh or disconnect a channel. A failed provider call is logged and skipped.

## Classification and themes

When `OPENAI_API_KEY` is set and the project has categories, new mentions are sent to `gpt-4.1` in batches of 20. The prompt lists that project's category names and descriptions. The model returns `categoryName`. Stalker stores the matching `StalkerProjectCategory` id. The older `StalkerCategory` enum stays on the row and is derived from the name (bug, feature/idea, complaint, question, testimonial, praise, spam, otherwise `OTHER`) so existing filters keep working. Sentiment is `POSITIVE`, `NEGATIVE`, or `NEUTRAL`. Urgency is 0 to 100.

If there is no API key or the project has no categories, mentions stay unclassified (`OTHER`, `NEUTRAL`, urgency 0).

Themes are still rebuilt per project from classified, non-spam mentions from the last 14 days. `/stalker/themes` remains so the old URL does not 404. It is not in the sidebar.

Mention status is `NEW`, `REPLIED`, or `IGNORED`.

## Create post

On a mention, Create post asks `/stalker/draft` and opens the existing post composer with that text. A testimonial also has Make quote post. A theme has Create post. Nothing else in Stalker writes to the calendar.

## Data model

`20261001150000_stalker_lite` is unchanged.

Later migrations, also additive:

- `20261004120000_stalker_sources` — `REDDIT_POST`, `REDDIT_COMMENT`, `X_POST`, `LINKEDIN_POST`, and `StalkerSearchCache`.
- `20261004130000_stalker_projects` — `StalkerProject`, `StalkerProjectCategory`, `StalkerMentionStatus`, nullable `projectId` on keywords, mentions, and themes, per-keyword listen flags, mention `categoryId` and `status`. The old unique keys on `(organizationId, phrase)` and `(organizationId, externalId)` are replaced by `(projectId, phrase)` and `(organizationId, projectId, externalId)` so two projects can store the same public post.

A project can store 10 keywords and 12 categories. YouTube and Reddit listen by default. X and LinkedIn do not.

## API

All routes require a signed-in organization and return 404 when the flag is off.

- `GET /stalker/status` — poll settings plus which keyword and comment sources are available for this organization
- `GET /stalker/projects` and `POST /stalker/projects`
- `GET /stalker/mentions?projectId=&date=&source=&from=&keywordId=&categoryId=&sentiment=&status=`
- `POST /stalker/mentions/:id/status` `{ "status": "NEW" | "REPLIED" | "IGNORED" }`
- `GET /stalker/keywords?projectId=`
- `POST /stalker/keywords` `{ "projectId", "phrase", "youtube"?, "reddit"?, "x"?, "linkedin"? }`
- `DELETE /stalker/keywords/:id`
- `GET /stalker/analytics?projectId=`
- `GET /stalker/themes`
- `POST /stalker/draft` `{ "mentionId"?: "...", "themeId"?: "...", "mode": "post" | "quote" }`
- `POST /stalker/poll` — runs one check for the current organization (the Settings "Check now" button).

The 6-hour loop is the Temporal workflow `stalkerPollWorkflow`. It starts from the backend only when `RUN_CRON=1` and `STALKER_ENABLED=true`. Its activity signature is unchanged. It does not change any existing workflow.

## Environment variables

Set the same flag on the frontend (Vercel) and the backend (Railway):

- `STALKER_ENABLED=true` — turns the API, the poll workflow, and the dashboard switcher on. Any other value, including unset, leaves Stalker off.
- `OPENAI_API_KEY` — already used by the app. Required for categories, themes, and generated drafts. Mentions still collect without it.
- `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET` — already used for YouTube connect. Keyword search and comment reads use the connected channel token. No new YouTube scope is requested. `youtubepartner` is not used.
- `REDDIT_STALKER_CLIENT_ID` and `REDDIT_STALKER_CLIENT_SECRET` — Reddit app-only credentials. Both must be set or Reddit search stays off.
- `X_STALKER_BEARER_TOKEN` — X API v2 recent search. Unset leaves X off.
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

`/stalker` redirects to `/stalker/mentions`. The sidebar is Mentions, Analytics, Keywords, Alerts, Settings, plus the project switcher. A workspace with no project sees the wizard instead of that nav. Mentions can be filtered by date, source, author, keyword, category, sentiment, and status. With no rows and no filters, the empty state is `No mentions yet. Stalker is listening for mentions of <project>`. Analytics is counts by source, category, and sentiment, plus a 14-day timeline. Alerts is a placeholder. The Schedule menu is unchanged. The switcher is the way between `/launches` and `/stalker/mentions`.
