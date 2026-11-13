# crea8.one on Cloudflare

Move the waitlist and, if it fits, the frontend. The backend stays on Railway. This file is the plan only. It does not change runtime code, data, or any host.

**Go on the waitlist, on the Workers free plan. Treat the frontend as a measured spike, not a cutover.** `crea8-backend`, `crea8-orchestrator`, `Postgres`, `Redis`, and the nine Temporal services stay on Railway project tranquil-bravery. Do not revive [crea8-app #171](https://github.com/harshvp967/crea8-app/pull/171). Do not merge [crea8-waitlist #21](https://github.com/harshvp967/crea8-waitlist/pull/21) if phase 0 is chosen.

## What moves

| Piece | Target | Stays the same |
| --- | --- | --- |
| Waitlist (`harshvp967/crea8-waitlist`, Vercel project `crea8-waitlist`, signups in Supabase) | Workers + D1, free plan | The form labels and the count. One small Worker, not the Next.js app. |
| Vercel project `crea8-app` (Next.js 16.3.1, `app.crea8.one`) | Workers via OpenNext, free plan, and only if the checks below pass | It calls the Railway API at the same public origin it uses today. |
| Media | R2, already the production store | No bucket move. |
| `crea8-backend`, `crea8-orchestrator`, `Postgres`, `Redis`, Temporal | Railway | No Container, no Hyperdrive, no D1, no Queue, no Workflow. |

The browser extension is a separate Vite app. It is not part of this move.

## Free plan

The waitlist must stay inside the Workers free limits: 100,000 requests a day, 10 ms of CPU per request, and 50 subrequests per request. D1 on the free plan allows 100,000 rows written a day, 5 million rows read a day, and a 500 MB database. A signup insert and a count query fit. The Worker has to stay a small script. Do not put the Next.js app on that same Worker.

The frontend is the piece that may not fit.

- The frontend PR must report the compressed Worker bundle size against the **3 MB free limit** and the **10 MB paid** figure. #171 measured about 12.2 MB gzip, which is over both. That number is from the parked build, not a new measurement. On 4 Sep 2026 Cloudflare stopped rejecting deploys on those gzip caps. The upload limit is now 64 MiB uncompressed on every plan. Report gzip anyway. Over 3 MB fails this plan's free-plan gate even if Cloudflare accepts the upload. Also report the uncompressed size so the 64 MiB check is visible.
- The same PR must flag routes likely to exceed **10 ms of CPU**. Waiting on the Railway API does not count. Server rendering does. Cloudflare's own Vercel-to-Workers note says an SSR app usually needs the paid plan because free CPU is 10 ms, and that auth or SSR work is often 10–20 ms. From a static read of this repo, no browser run:
  - `src/proxy.ts` runs on every HTML route (the matcher skips `api/`, `_next/`, and static files). Legal paths return before the auth fetch. Everything else can do more work.
  - Likely over 10 ms: the `(app)` shell, because `app/(app)/layout.tsx` is `force-dynamic` and reads cookies, and so are launches, analytics, media, billing, settings, account, admin, auth, and the public post page `p/[id]` (it fetches the post and sanitizes HTML). Link-in-Bio `[slug]` and `bio-host` render on the server from an API response.
  - Best chance of fitting: `/privacy`, `/terms`, and `/data-deletion`, which are static JSX and leave the proxy early. The PR still has to measure them.
- Free also caps a Worker at 100,000 requests a day. Pre-launch that is enough. It is not a reason to pick the paid plan by itself.

If the frontend is over 3 MB gzip or the app routes exceed 10 ms, leave `app.crea8.one` on Vercel. Workers Paid is $5 a month and raises CPU to 30 seconds (5 minutes if configured). That is a later decision. It is not this plan, and it is not a reason to move the backend.

## What does not move cleanly

Only inside this scope.

**The OpenNext frontend on the free plan.** Least-bad: keep it on Vercel until a build is under 3 MB gzip and the routes above are shown to be under 10 ms. #171 is the background, not the patch to merge. It also found: no Next image optimizer unless Images is bound; native `canvas`, `bufferutil`, and `utf-8-validate` do not load; the local `fs` upload route 404s (production media is R2); the public Link-in-Bio fetch cache was set to 0; `next.config.js` headers do not apply to static files; `src/proxy.ts` was experimental middleware; a Railway private hostname is not reachable, so the API URL stays the public origin; a `*.workers.dev` host is a different site, so login cookies will not work there. Cut over on `app.crea8.one` or not at all.

**The waitlist does move cleanly**, as a small Worker and one D1 database, provided it stays inside the free limits above. Supabase in `harshvp967/crea8-app` is unused: no client, no auth, no storage. The only string is an optional peer of `@langchain/community` in `pnpm-lock.yaml`. Auth in this app is the JWT cookie. The Supabase database to retire is the waitlist's.

## Railway, unchanged

Production, 13 services, one replica each, region `sfo`, read 13 Nov 2026. They are not migration targets.

`crea8-backend` (NestJS API, `prisma db push` then port 3000), `crea8-orchestrator` (Temporal workers in one process, port 3002), `Postgres` (app data, 500 MB volume), `Redis` (rate limits, locks, lists, cache, 50 GB volume), `temporal-frontend`, `temporal-history`, `temporal-matching`, `temporal-system-worker` (Temporal's own worker, not the orchestrator), `temporal-ui`, `temporal-ui-auth` (Caddy; the Caddyfile is not in this repo), `temporal-db` (Temporal's Postgres, 50 GB volume, not the app database), `temporal-schema`, and `temporal-bootstrap` (admin-tools, deployed once on 24 Sep 2026). No service has a cron schedule. Local compose runs Elasticsearch for Temporal; this project has no Elasticsearch service.

## Cost

**Railway today is about $28 a month.** That is the measured bill as of 13 Nov 2026. The earlier $75–$95 figure is wrong and is withdrawn. It assumed each of the 13 replicas averaged 0.1 vCPU and 256 MB for a full month ($26 of CPU at $20/vCPU plus $33 of RAM at $10/GB) and added $15.08 for the provisioned volumes (0.5 GB + 50 GB + 50 GB at $0.15/GB). Actual usage is lower than that model. Do not use it.

**A backend move would be about $134 a month, so it is not in this plan.** Assumptions behind that $134, using [Container rates](https://developers.cloudflare.com/containers/platform/pricing/) as of 13 Nov 2026. This is a planning total, not a second invoice:

- Workers Paid is $5. Containers are not on the free plan.
- `crea8-backend` and `crea8-orchestrator` as two always-on `standard-2` Containers (6 GiB, 12 GB disk) for 730 hours. Memory is 2 × 6 × 2,628,000 × $0.0000025 = $78.84. Disk is 2 × 12 × 2,628,000 × $0.00000007 = $4.42.
- CPU assumes the two together average 0.5 vCPU: 0.5 × 2,628,000 × $0.000020 = $26.28. Not measured.
- One external Postgres at about $19. Postgres bytes cannot live on Cloudflare. Not measured.
- Redis and the nine Temporal services are not given Containers in this total. Adding them would cost more.
- $5 + $78.84 + $4.42 + $26.28 + $19 = $133.54, about $134.

**This plan, if the free tier holds: Railway stays about $28, and Cloudflare is $0.** The waitlist is inside the free allowances above. The frontend adds $0 only when it is under 3 MB gzip and 10 ms CPU. Vercel's plan was not read (Hobby is $0, Pro is $20 per member). Retiring it removes that bill and does not change the $28. Supabase for the waitlist was not priced. R2 does not change.

## Phases and rollback

No public TCP proxy. Workers call the public API origin, never `railway.internal`.

**Phase 0. Waitlist to Workers + D1, on the free plan.** Repo `harshvp967/crea8-waitlist`. This PR does not edit it. One Worker, one D1 database, the form post and the count. The signups leave Supabase. Supersedes #21, which would point the Vercel app at Railway `Postgres` and needs a public TCP proxy. **Do not merge #21.** Rollback: put the hostname back on Vercel project `crea8-waitlist` and leave Supabase in place until the Worker has been quiet.

**Phase 1. OpenNext spike. No DNS.** New branch. The PR must report gzip size against 3 MB (free) and 10 MB (paid), plus the uncompressed size against 64 MiB, and must flag the routes above against 10 ms CPU. The Worker calls the Railway API as today. Rollback: delete the Worker. Vercel stays. Do not revive #171.

**Phase 2. Frontend DNS, only if phase 1 fits the free plan.** Rollback: point `app.crea8.one` back at Vercel project `crea8-app`. #171 recorded CNAME `e1601e2c160f9fa2.vercel-dns-017.com` on 19 Oct 2026. Re-read the live record at cutover. If phase 1 does not fit, skip this phase and leave the frontend on Vercel.

**Phase 3. Retire Vercel and Supabase.** After phase 0 has been quiet, remove the waitlist from Vercel and delete the Supabase project in its own step. Remove Vercel project `crea8-app` only if phase 2 happened. Rollback is "the projects are still there": do not delete them in the same step as the DNS change.

There is no phase for the API, the orchestrator, Postgres, Redis, or Temporal.

## Recommendation

Go on phase 0. Keep the waitlist Worker inside the free limits. Run phase 1 and stop there unless the gzip size is under 3 MB and the dynamic routes are under 10 ms of CPU. The parked build's 12.2 MB gzip says the frontend probably stays on Vercel.

Leave the backend on Railway. About $28 a month there against about $134 to move it is the whole reason. Postgres, Redis, and Temporal do not get a Cloudflare design in this plan.
