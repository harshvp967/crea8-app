# Project: Crea8

Crea8 is a Postiz fork. It schedules social posts to 28+ channels, watches mentions in Stalker, hosts a public Link-in-Bio page with lead capture, and exposes the same actions over MCP.

The customer is an organization. Users belong to organizations through `UserOrganization`. A request acts on the organization selected for that session. One customer's posts, channels, media, Stalker projects, and link page stay separate from another's.

## Stack (do not change without asking)

- Frontend: Next.js (App Router) + TypeScript + Tailwind, hosted on Vercel. The browser extension is a separate Vite app.
- Backend: NestJS API, hosted on Railway (project tranquil-bravery, backend service).
- Background jobs: NestJS orchestrator on Temporal, hosted on Railway (orchestrator service). Workflows and activities live in `apps/orchestrator`.
- Database: Postgres via Prisma 6.5. The running schema path is `prisma db push`. There is no applied migration history. See `docs/prisma-migration-baseline-proposal.md`.
- Auth: JWT in an httpOnly cookie, passwords hashed with bcrypt. Not a third-party auth host.
- Storage: Cloudflare R2 when `STORAGE_PROVIDER=cloudflare`, local disk otherwise.
- Cache and rate limits: Redis (`REDIS_URL`).
- Errors: Sentry, no-op unless `SENTRY_DSN` or `NEXT_PUBLIC_SENTRY_DSN` is set.

## Layout

Monorepo. Dependencies live in the root `package.json`. Use pnpm only.

- `apps/backend` — NestJS controllers. Domain logic stays in `libraries/nestjs-libraries`.
- `apps/orchestrator` — Temporal worker. Workflows and activities.
- `apps/frontend` — Next.js app.
- `libraries/nestjs-libraries` — services shared by the backend and the orchestrator.
- `libraries/helpers` — shared helpers, including auth and fetch.
- `libraries/react-shared-libraries` — shared React and i18n.

## Rules

- Never commit secrets. Document every variable in `.env.example`.
- Every new API endpoint needs input validation, an auth check, an authorization check, and tests.
- Never use raw SQL. Use Prisma.
- Do not add a dependency without asking.
- Prefer a small change. One feature per branch.
- Linting runs from the repo root.
- Do not install frontend component packages. Write native components.
- Tailwind 3. Before a component, read `apps/frontend/src/app/colors.scss`, `apps/frontend/src/app/global.scss`, and `apps/frontend/tailwind.config.js`. Do not use `--color-custom*`.
- Backend shape is DTO, then Controller, then Service, then Repository. Some flows add a Manager between Controller and Service.
- Frontend UI lives in `apps/frontend/src/components/ui`. Routes live in `apps/frontend/src/app`. Fetch with SWR and `useFetch` from `libraries/helpers/src/utils/custom.fetch.tsx`. Each SWR hook is its own hook. Do not call `useSWR` inside a function returned from another hook.
- Provider-specific logic stays inside that provider. A shared file calls the provider interface. Do not branch on Facebook or Instagram inside generic code.
- This system is in production. A change that touches stored data needs a migration plan and must not break existing users.

## Production database

Do not read or change production data. Do not change the production schema. Both require Harsh's approval first.

When a production schema change is approved, run it from a temporary Railway Function on the backend service, using the private `DATABASE_URL` already on that service. Never open a public TCP proxy to Postgres. Delete the function when it finishes. Do not run `prisma db push --accept-data-loss` against production.

## Commands

- Dev: `pnpm dev`
- Backend and frontend only: `pnpm dev-backend`
- Test: `pnpm test`
- Lint: `pnpm run lint`
- Typecheck: `pnpm run typecheck`
- Build: `pnpm run build`
- Generate Prisma client: `pnpm run prisma-generate`
- Schema push (local only, not production): `pnpm run prisma-db-push`

## Architecture decisions

- Tenancy is the organization id on tenant tables. Public Link-in-Bio pages are keyed by slug. Stalker scan cache keys include the organization id.
- Background work is Temporal. Do not change a workflow file that is already on `origin/main`. Changing a workflow fails its in-flight activities. Add a new versioned workflow and switch callers to it.
- Do not change an activity's parameters. Add a new activity and a new workflow that calls it.
- Rate limits and the Stalker scan cache use Redis so more than one API instance shares them.
- Sentry is optional. Unset DSNs are a no-op. Bugs Team owns alerting, so this repo wires the SDK only.

## Pull requests

Follow `.github/PULL_REQUEST_TEMPLATE.md`.

Every PR description must contain a `# QA` section with real numbered steps a reviewer can run without asking the author. Use the heading `# QA`. Write steps as numbered checkboxes (`1. [ ] step`). Do not put the steps in a fenced code block. Do not leave `N/A`, `TBD`, `todo`, `none`, or an empty checkbox as the whole section.

`# What kind of change does this PR introduce?` must say the type, the area (backend, frontend, orchestrator, a provider, or a screen), what changed (function, endpoint, file, or field), and what stayed the same. A category alone is not enough.

Commit messages should say what changed and why.
