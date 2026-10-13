# SaaS 15-layer audit

Audit of the Crea8 / Postiz fork against the 15-layer playbook. Date: 2026-10-13. No production data was read. No schema was changed. Browser QA was not run.

Status values: **fixed in this PR**, **proposed**, **owner decision**.

## Critical

1. **Production schema is applied with `prisma db push --accept-data-loss`.** `package.json` script `prisma-db-push` and `pm2-run`. Docker boot in `var/docker/backend-start.sh` also runs `db push`. `prisma migrate deploy` is not wired up. A push can drop columns on a live database that already has customers. **Proposed.** The steps are in `docs/prisma-migration-baseline-proposal.md` and were not executed. Owner: Harsh must approve before any production schema change, and that change runs only from a temporary Railway Function, never a public TCP proxy.

## High

2. **Pull requests did not run tests or a typecheck.** `.github/workflows/build.yml` only runs `pnpm run build`. The root Jest config imported `@nx/jest`, which is not a dependency, so `pnpm test` could not start. **Fixed in this PR.** `.github/workflows/ci.yml` runs lint, `tsc --noEmit` for the backend and orchestrator, and `pnpm test`. Frontend typecheck stays in the existing Build workflow via `next build`.

3. **The public API was barely rate limited.** `ThrottlerBehindProxyGuard` only counted `POST` URLs containing `/public/v1/posts`. Reads and other writes were open. **Fixed in this PR.** Every `/public/v1` method is limited per organization in Redis (`API_LIMIT` writes, `API_LIMIT_READ` reads) and returns 429 with `Retry-After`.

4. **Login, signup, and password reset had no dedicated limit.** `apps/backend/src/api/routes/auth.controller.ts` only throttled Farcaster signer routes. **Fixed in this PR.** `AuthRateLimitGuard` limits `/auth/register`, `/auth/login`, `/auth/forgot`, and `/auth/forgot-return` to 5 per 15 minutes per IP and per email (`AUTH_RATE_LIMIT`, `AUTH_RATE_WINDOW_MS`).

5. **MCP endpoints had no rate limit.** `libraries/nestjs-libraries/src/chat/start.mcp.ts` accepts API keys and `pos_` OAuth tokens with no cap. **Fixed in this PR.** `/mcp`, `/mcp/:id`, `/mcp-oauth*`, `/sse/:id`, and `/message/:id` share a Redis window (`MCP_RATE_LIMIT`, default 120/minute) keyed by a hash of the token or IP.

6. **Link-in-Bio lead and click routes needed an explicit, tested cap.** They already used `ThrottlerRealIpGuard`. **Fixed in this PR.** Limits now live in `LINK_PUBLIC_LIMITS` (click/view 240/hour, subscribe 30/hour, unlock 20/hour, contact 10/hour) and are covered by `throttler.provider.spec.ts`.

7. **Sentry on the API and worker only read `NEXT_PUBLIC_SENTRY_DSN`, and events included email.** `libraries/nestjs-libraries/src/sentry/initialize.sentry.ts`, `libraries/react-shared-libraries/src/sentry/initialize.sentry.client.ts` (`sendDefaultPii: true`). **Fixed in this PR.** Backend and orchestrator use `SENTRY_DSN`, then `NEXT_PUBLIC_SENTRY_DSN`, and do nothing when both are empty. The frontend does the same. User context is id and organization id. `sendDefaultPii` is false. Sourcemap upload runs only when `SENTRY_AUTH_TOKEN` is set. `apps/frontend/next.config.js` keeps an empty `turbopack` key so Next.js 16 still builds when no DSN is set and `withSentryConfig` is skipped. Alert rules were not added. **Owner decision:** Bugs Team owns uptime and Sentry alerting.

8. **Public Link-in-Bio pages and Stalker scan loads always hit the origin.** `apps/frontend/src/components/link-in-bio/link.load.ts` used `cache: 'no-store'`. `StalkerService.latestScan` always queried Postgres. **Fixed in this PR.** Public pages use Next fetch `revalidate` (`PUBLIC_LINK_CACHE_SECONDS`, default 60). Finished and idle scans are cached in Redis at `stalker:scan:{organizationId}:{projectId}` (`STALKER_SCAN_CACHE_SECONDS`, default 20) and dropped when a scan is requested or finishes. Running scans are not cached. Authenticated scan JSON is not given a shared CDN header.

9. **Stripe webhooks are verified but not idempotent.** `libraries/nestjs-libraries/src/services/stripe.service.ts` calls `constructEvent` and does not store the event id. A replay can apply the same subscription change twice. **Proposed.** Persist processed event ids and ignore duplicates. Not done here (no schema change).

10. **Outbound publish webhooks are unsigned.** `apps/orchestrator/src/activities/post.activity.ts` POSTs JSON with no HMAC. Link-in-Bio lead webhooks already sign with `X-Crea8-Signature`. **Proposed.** Sign post webhooks the same way.

11. **Cookie session plus credentialed CORS, and no CSRF token.** `apps/backend/src/main.ts` CORS, auth cookie `sameSite: 'none'` in `apps/backend/src/services/auth/auth.middleware.ts`. **Proposed.** A CSRF token or a same-site session cookie for first-party calls.

12. **Plan checks allow every action when Stripe is unset.** `apps/backend/src/services/auth/permissions/permissions.service.ts` treats a missing `STRIPE_PUBLISHABLE_KEY` as PRO. **Owner decision** for self-hosted installs. Production must keep the Stripe key set.

13. **Uploaded files can be world-readable.** `libraries/nestjs-libraries/src/upload/media.public.url.ts` builds a public `CLOUDFLARE_BUCKET_URL`. Local storage is served by `apps/frontend/src/app/(app)/api/uploads/[[...path]]/route.ts` with a path check and no auth. **Proposed.** Private R2 objects and short-lived signed download URLs after an organization check.

14. **No backup or restore runbook.** The only retention text is the legal page `apps/frontend/src/app/(legal)/data-deletion/page.tsx`. **Owner decision** for Railway Postgres backups. A restore drill is still required before launch.

## Medium

15. **Project memory described the frontend as Vite.** `CLAUDE.md` was stale and there was no `AGENTS.md`. **Fixed in this PR.** Both files are the same and name Next.js, NestJS, Temporal, Prisma, Railway, and Vercel.

16. **Core flows had no scheduling, lead, or MCP auth tests in CI.** Stalker and link rules already had unit tests. **Fixed in this PR.** New specs cover post schedule state and time, Stalker scan load and mention organization scope, Link-in-Bio public gating and lead capture, and MCP bearer auth. They run in CI. End-to-end browser tests were not added (no browser QA on this task). **Proposed** for a later Playwright pass.

17. **Redis falls back to an in-process map.** `libraries/nestjs-libraries/src/redis/redis.service.ts` uses `MockRedis` when `REDIS_URL` is unset, so limits and the scan cache do not cross instances. **Proposed.** Production already sets `REDIS_URL`. Refuse to boot in production when it is missing.

18. **Auth JWT cookies last about a year.** `apps/backend/src/api/routes/auth.controller.ts` sets `expires` to 365 days. Password hashing is bcrypt in `libraries/helpers/src/auth/auth.service.ts` (a known library, not a hand-rolled hash). **Proposed.** Shorter sessions and revocation on password reset.

19. **The API has no readiness check.** The orchestrator exposes `GET /health/status` (`apps/orchestrator/src/health.controller.ts`) and checks Temporal. The backend monitor route does not check Postgres or Redis. **Proposed.**

20. **`StalkerSearchCache` is shared across organizations.** `schema.prisma` model `StalkerSearchCache` (around line 2170) reuses keyword search results. **Owner decision.** The key is a search phrase, not a customer record. Confirm that cached payloads cannot contain another tenant's private text.

21. **Frontend loading and error UI is thin.** One route `loading.tsx` under Stalker. `apps/frontend/src/app/global-error.tsx` reports to Sentry only when a DSN is set. Many screens still depend on local spinners. **Proposed.**

22. **The root ESLint flat config crashes.** `eslint.config.mjs` uses `FlatCompat` with `next/core-web-vitals` and ESLint 8 throws a circular JSON error. **Fixed in this PR** for CI via `eslint.ci.mjs`, which parses the files this change owns. **Proposed** to repair the root config so the whole repo lints.

23. **Database pool size is the Prisma default.** `schema.prisma` datasource has no `connection_limit`. Several API instances plus the worker can exhaust Postgres connections. **Proposed.** Set a pool size per service before horizontal scale-out.

24. **Dependency audit is not a failing CI check.** `.github/Dependabot.yml` exists. `pnpm audit` is not in CI. **Proposed.**

## Low

25. **Some tables are global on purpose.** `Mentions`, `Announcement`, `PopularPosts`, and marketplace orders are not organization-owned. Tenant tables (`Post`, `Integration`, `Media`, `LinkPage`) carry `organizationId` or `orgId`. **Owner decision** to keep the global ones.

26. **Scan logs use `console.log` / `console.error`.** `StalkerService.logScan`. Sentry's console integration can forward them when a DSN is set. **Proposed.** A JSON logger with request id, and redaction of tokens.

27. **Sentry still records OpenAI inputs when a DSN is set.** `initialize.sentry.ts` `openAIIntegration({ recordInputs: true, recordOutputs: true })`. **Owner decision.** Turn off input recording if prompts can contain customer content.

28. **No load test, status page, or alert runbook in the repo.** **Owner decision.** Bugs Team owns alerting. This PR does not add alert rules.

29. **Branch protection and preview deploys are not in git.** Vercel preview and Railway production are outside this repo. **Owner decision** to require the CI and Build checks on `main`.

## What this PR did not change

No Prisma schema edit, no migration execution, no production query, no alert rule, no Temporal workflow or activity signature, no browser pass.
