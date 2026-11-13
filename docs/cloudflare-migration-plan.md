# crea8.one on Cloudflare

Decision doc for moving the whole product onto Cloudflare before launch, while there are no users. This file is the plan only. It does not change runtime code, data, or any host.

**Go on the all-Cloudflare path below. Do not treat it as one cutover.** The frontend, the API, the orchestrator, files, and the waitlist fit. Postgres bytes cannot live on Cloudflare. The Temporal cluster is the piece that runs badly there; the least-bad place for it until the job rewrite lands is Railway.

Brand is crea8.one. Do not revive [crea8-app #171](https://github.com/harshvp967/crea8-app/pull/171). Do not merge [crea8-waitlist #21](https://github.com/harshvp967/crea8-waitlist/pull/21) if phase 0 is chosen.

## All-Cloudflare path

| Layer today | Target | What has to change |
| --- | --- | --- |
| Vercel project `crea8-app` (Next.js 16.3.1, `app.crea8.one`) | Workers via OpenNext | A new build path, not a revive of #171. See that section. |
| `crea8-backend` NestJS API | Containers, same image | A Worker in front of the container. Boot stays `prisma db push` then the API. No Workers port: native Prisma, bcrypt, and sharp. |
| `crea8-orchestrator` (the only worker process; provider queues run inside it) | Containers, same image, kept awake | Nothing at first. It keeps polling until jobs move. Sleep would stop posts. |
| Temporal workflows (post versions, media, email, token refresh, autopost, clipping, stalker scan/poll/digest, streak, digest email, video, missing post) | Cloudflare Workflows for the steps, Queues for bursts, Cron Triggers for schedules, Durable Objects for per-provider locks | New callers. Do not edit a workflow file already on `origin/main`. Long native steps (sharp, video) stay a Container call from a Workflow step. Workers CPU tops out at 5 minutes. |
| Railway `Postgres` (app data) | External Postgres, reached through Hyperdrive from any Worker and directly from Containers | Dump and restore. Prisma stays Postgres. Not D1. |
| Railway `Redis` | Durable Objects for atomic keys, lists, and locks. KV for read-mostly cache | Replace `redis.service.ts`. Not a connection-string swap. |
| Media | R2, already the production store when `STORAGE_PROVIDER=cloudflare` | Keep it. No new bucket in this plan. |
| Waitlist (other repo) | Workers + D1 | Phase 0. |

Hyperdrive is included on the Workers Paid plan. It pools and caches. It is not a database.

## Postgres does not live on Cloudflare

Cloudflare does not host Postgres. Hyperdrive connects to someone else's Postgres (Neon and the other hosts in the Hyperdrive docs, including Supabase as an origin). D1 is SQLite: 10 GB per database, one writer, and a 50 MB query-result cap. The app schema is Prisma 6.5 against Postgres, and the API applies it with `prisma db push` on boot.

D1 fits the waitlist table and nothing else. The app database and Temporal's own database stay Postgres on an external host. That host is still a bill, and it is not a Cloudflare product. Moving either database is a production data move and needs Harsh's approval even with no users.

## What does not run well

**Temporal's nine Railway services.** Workflows, Queues, Cron Triggers, and Durable Objects can replace the jobs. They cannot host the Temporal gRPC cluster (`temporalio/server`, the UI, Caddy, admin-tools, or `temporal-db`). Least-bad on Cloudflare: six always-on Containers (frontend, history, matching, system worker, UI, Caddy) plus an external Postgres for `temporal-db`. Schema and bootstrap are one-shot admin-tools containers, not Cron Triggers. That layout fights Container sleep, bills provisioned memory, and costs more than leaving the cluster on Railway. Do that container layout only if the job rewrite is refused. Prefer Railway until the rewrite deletes the cluster.

**The Nest process on Workers.** Least-bad is Containers, which is already the path. Workers are the wrong runtime for this API.

**Redis as a protocol.** There is no Cloudflare Redis. KV is the wrong tool for `INCR`, `SET NX`, and lists (eventual consistency, one write per second per key). Durable Objects are the least-bad match. A `redis:8.2` Container is worse: its disk dies when the instance sleeps.

**Postgres on D1.** Least-bad is external Postgres plus Hyperdrive, as above.

## Supabase in this repo

Searched `harshvp967/crea8-app` for Supabase clients, env names, and storage. Application code does not use Supabase for storage, auth, or a database.

| Found | Replacement |
| --- | --- |
| No Supabase client, SQL, or storage call | Nothing to migrate |
| Auth is the app's JWT cookie and bcrypt | Keep it. Not Supabase Auth |
| Files are R2, or local disk when `STORAGE_PROVIDER=local` | R2 stays. There is no Supabase Storage bucket |
| `@supabase/supabase-js` appears once, as an optional peer of `@langchain/community` in `pnpm-lock.yaml` | Unused. Do not wire it up. No code change |

The product's real Supabase use is the waitlist repo, not this one. Phase 0 replaces that database with D1. [crea8-waitlist #21](https://github.com/harshvp967/crea8-waitlist/pull/21) would point the Vercel waitlist at Railway `Postgres` and needs a public TCP proxy. **Do not merge #21 if phase 0 is chosen.** This plan does not edit that repo or that PR.

## Railway project tranquil-bravery

Production, 13 services, one replica each, region `sfo`. Read from Railway on 13 Nov 2026. No variable values are listed. No service has a cron schedule. Local `docker-compose.yaml` runs Elasticsearch for Temporal; this project has no Elasticsearch service.

| Service | What it is | All-Cloudflare target |
| --- | --- | --- |
| `crea8-backend` | `ghcr.io/harshvp967/crea8-app-backend`. NestJS API. `prisma db push`, then listen on 3000. | Container. |
| `crea8-orchestrator` | `ghcr.io/harshvp967/crea8-app-orchestrator`. Temporal workers (main queue and provider queues) in one process, port 3002. Does not migrate. | Container, kept awake, until Workflows replace it. |
| `Postgres` | `ghcr.io/railwayapp-templates/postgres-ssl:18`. App data. Volume 500 MB at `/var/lib/postgresql/data`. | External Postgres + Hyperdrive. Not D1. |
| `Redis` | `redis:8.2`. Rate limits, locks, upload-session lists, Stalker cache. Volume 50 GB at `/data`. | Durable Objects and KV. |
| `temporal-frontend` | `temporalio/server:1.31.2`. gRPC entry the SDK dials. | Least-bad: always-on Container. Better: retire after the job rewrite. |
| `temporal-history` | `temporalio/server:1.31.2`. Workflow history. | Same. |
| `temporal-matching` | `temporalio/server:1.31.2`. Task queues. | Same. |
| `temporal-system-worker` | `temporalio/server:1.31.2`. Temporal's own internal worker, not the crea8 orchestrator. | Same. |
| `temporal-ui` | `temporalio/ui:2.53.3`. | Same. A Cloudflare Access proxy is not a move. |
| `temporal-ui-auth` | `caddy:2.11.4-alpine`. The name says auth proxy. The Caddyfile is not in this repo, so that role is inferred. | Same Container, or drop it with the UI. |
| `temporal-db` | Second Postgres, same image family. Temporal persistence. Volume 50 GB. Not the app database. | External Postgres. Not D1. |
| `temporal-schema` | `temporalio/admin-tools:1.31.2`. Schema setup. Deployed once, 24 Sep 2026. Whether the process is still doing work was not checked. | One-shot Container. Not a Cron Trigger. |
| `temporal-bootstrap` | `temporalio/admin-tools:1.31.2`. Namespace bootstrap, inferred from the name and image. Same deploy date. | One-shot Container. |

The browser extension is a separate Vite app. It is not one of these services and not the Vercel frontend.

## Frontend and #171

#171 is a parked draft. It added an OpenNext build (`@opennextjs/cloudflare`, Wrangler) and did not deploy, change DNS, or use vinext. Reuse the findings. Do not revive or edit the PR.

Still true:

- Next image optimizer does not run unless Cloudflare Images is bound. The build turned optimization off. The existing `next/image` uses were already unoptimized.
- Workers cannot load the native addons behind `jsdom` and `ws` (`canvas`, `bufferutil`, `utf-8-validate`). The build excluded them.
- The local upload route uses `fs`. On Workers a missing `fs` returns 404. Production media is R2. That route is the local-dev path.
- There is no page-level ISR. Public Link-in-Bio pages used a 60 second fetch cache. With no R2, KV, or Durable Object cache binding, #171 set that cache to 0 so those pages call the API every time.
- `next.config.js` headers do not apply to files in `public/` or `/_next/static`. #171 repeated them in `public/_headers`.
- Next.js 16 `src/proxy.ts` was bundled as experimental middleware.
- A Railway private hostname is not reachable from Workers. The API origin has to be the public one.
- A `*.workers.dev` host is a different site, so the production cookie and CORS will not accept a login there. Cut over on `app.crea8.one`, not on `workers.dev`.

The size note is stale. #171 measured about 12.2 MB gzip and compared it with the old 10 MB paid gzip cap. On 4 Sep 2026 Cloudflare dropped that cap. The limit is now 64 MiB uncompressed. #171 did not record the uncompressed size, so a deploy may still fail. Measure it on a new branch. vinext is Cloudflare's current recommendation for a new Next.js app and was not tried. OpenNext stays the path because that is the build that already completed. Switch to vinext only if OpenNext cannot deploy.

Vercel project `crea8-app` is Next.js, Node 24.x, domains include `app.crea8.one`. Plan was not read.

## Blockers

- **Long-running workers.** The orchestrator polls for the life of the process. Workers are per invocation. Containers sleep when idle, and sleep stops the poller. Keep the orchestrator Container awake until Workflows replace it, and pay for that time.
- **WebSockets.** This repo has no Nest gateway. Nostr uses `ws` as a client. Reddit posting avoids holding a socket inside an activity. MCP can answer over SSE. Outbound sockets belong in the Container. Nothing here needs a Durable Object WebSocket server.
- **Cron.** Posting schedules are Temporal workflows started by the API (`processCron`). No Nest cron, and no Railway cron on the 13 services. Cron Triggers start a Worker on a timer. They do not resume a Temporal workflow. They fit only after that workflow is a Cloudflare Workflow.
- **Uploads.** R2 already. The local `fs` route 404s on Workers. `sharp` stays in the Container.
- **Node APIs.** bcrypt, sharp, the Prisma query engine, and the Temporal SDK. The images are Node 22. Workers are not that runtime.
- **Prisma.** Stays on Postgres. D1 would be a schema rewrite. `prisma db push` on boot must not gain `--accept-data-loss`.

## Cost

List prices read 13 Nov 2026. Railway: [pricing plans](https://docs.railway.com/pricing/plans) (RAM $10/GB/month, CPU $20/vCPU/month, volume $0.15/GB/month, egress $0.05/GB; Pro is $20/month and includes $20 of usage). Cloudflare: [Workers](https://developers.cloudflare.com/workers/platform/pricing/), [Containers](https://developers.cloudflare.com/containers/platform/pricing/) (memory $0.0000025/GiB-second after 25 GiB-hours, disk $0.00000007/GB-second after 200 GB-hours, CPU $0.000020/vCPU-second after 375 vCPU-minutes; `standard-1` is 4 GiB, 8 GB disk, up to 1/2 vCPU). Vercel: [pricing](https://vercel.com/pricing) (Hobby $0, Pro $20 per member). Pre-launch traffic is treated as inside the included request, CPU, D1, KV, Queue, Workflow, and R2 allowances (R2 includes 10 GB). Egress is treated as about $0. CPU and RAM on Railway were not metered.

**Current, about $75–$95/month plus R2.**

The 50 GB `temporal-db` and `Redis` volumes are above the Hobby plan's 5 GB volume cap, so the figure uses Pro. The subscription itself was not read. Provisioned volumes are 0.5 + 50 + 50 = 100.5 GB × $0.15 = $15.08. Assumption, not a measurement: each of the 13 replicas averages 0.1 vCPU and 256 MB. That is $26 CPU + $33.28 RAM. Usage $74.36, and the Pro bill is $74.36 because usage is above the included $20. Vercel plan was not read: $0 on Hobby, or $20 if the team is Pro (one seat covers `crea8-app` and `crea8-waitlist`). Waitlist Supabase was not priced.

**All-Cloudflare end state, about $65/month on Cloudflare, plus an external Postgres bill.**

Workers Paid $5. Two `standard-1` Containers (API and orchestrator) awake for 730 hours: memory about $52, disk about $3, CPU about $5 if each averages 10% of its 1/2 vCPU, minus about $1 of included usage. Frontend, D1, KV, Durable Objects, Queues, Workflows, Cron Triggers, Hyperdrive, and R2 stay inside included amounts at this traffic. Railway and Vercel go to $0. The Postgres host is extra and is not a Cloudflare line. A Neon free database may cover pre-launch; confirm that before counting it as $0.

**Interim if Temporal is also moved, about $250/month on Cloudflare, plus two Postgres hosts.**

Six more always-on `standard-1` Containers are about $180. That is worse than today's Railway bill. It is the least-bad Cloudflare home for the cluster, and it is the wrong one to pick for cost.

Shrinking the two 50 GB Railway volumes is a Railway change, not part of this move. It is the only measured slice of the current bill ($15 of the $74).

## Phases and rollback

Each phase leaves the old host up. No public TCP proxy to Railway Postgres. Containers and Workers cannot use `railway.internal`.

**Phase 0. Waitlist to Workers + D1.** Repo `harshvp967/crea8-waitlist`, which this PR does not touch. One Worker, one D1 database, form post and count. Supersedes #21. Do not merge #21. Rollback: put the hostname back on the Vercel project `crea8-waitlist` and leave Supabase in place until the Worker has been quiet. Deleting Supabase is a later step.

**Phase 1. OpenNext spike.** New branch. Measure uncompressed size against 64 MiB. No DNS. Rollback: delete the Worker. Vercel stays.

**Phase 2. Frontend DNS.** Only after login, a public Link-in-Bio page, and an upload work against the public API origin. Rollback: point `app.crea8.one` back at Vercel project `crea8-app`. #171 recorded CNAME `e1601e2c160f9fa2.vercel-dns-017.com` on 19 Oct 2026. Re-read the live record at cutover.

**Phase 3. App Postgres to an external host, then the API Container.** Copy the database, then run the existing backend image as a Container against that host. Hyperdrive only if a Worker queries it. The Container dials Postgres directly. Rollback: point the API hostname back at Railway `crea8-backend`, which still uses the private Railway database. Do not delete `Postgres`.

**Phase 4. Redis to Durable Objects and KV.** Replace the client. Rate limits, `SET NX` locks, and upload-session lists go to Durable Objects. Stalker and bearer caches go to KV. Rollback: redeploy the previous API and orchestrator images. They keep using Railway `Redis`, which is still up. Do not delete `Redis` in this phase.

**Phase 5. Jobs to Workflows, Queues, Cron Triggers, and Durable Objects.** Add the new runners and point callers at them one workflow at a time. The orchestrator Container stays until that workflow is done. Leave every Temporal workflow file on `origin/main` as it is. Rollback: point that caller back at Temporal. The Railway Temporal services are still up.

**Phase 6. Retire Temporal.** Stop `crea8-orchestrator` and the nine Temporal services only after phase 5 has been quiet. Rollback: start those Railway services again from the existing images and the `temporal-db` volume. Do not delete the volume in the same step. History from the gap is not replayed.

**Phase 7. Remove Railway and Vercel.** After the quiet period. Rollback of a removed Railway deployment is limited to image retention (120 hours on Pro) and does not bring a deleted volume back. Delete volumes last, in their own step, or not at all until a dump is stored in R2.

## Recommendation

Go. Move the waitlist, the frontend, the API, the orchestrator, Redis, and files onto Cloudflare in that order. Keep R2. Use OpenNext. Use Containers for the two Node images. Use Durable Objects and KV instead of Redis. Use Workflows, Queues, Cron Triggers, and Durable Objects for jobs, as new code, without editing the Temporal workflow files.

Do not put the app database or `temporal-db` on D1. Postgres cannot live on Cloudflare. Budget an external Postgres host from phase 3 on.

Do not run the Temporal cluster on Containers. It is the piece that fits badly, and the least-bad option is to leave those nine services on Railway until phase 5 replaces the jobs. After that, Railway can go. Until then, crea8.one is Cloudflare plus one Railway cluster and one external Postgres, which is the honest shape of "all Cloudflare" for this codebase.
