# Prisma migration baseline (proposal only)

This document is a proposal. Nothing in it has been run. Do not apply it to a database, local or production, without Harsh's approval.

## Current state

The schema lives in `libraries/nestjs-libraries/src/database/prisma/schema.prisma`. A `migrations/` directory exists beside it, but nothing in the repo runs `prisma migrate deploy`.

Production and local boot still apply the schema with:

- `pnpm run prisma-db-push`, which is `prisma db push --accept-data-loss`
- `var/docker/backend-start.sh`, which runs `prisma db push` before the API listens

`db push --accept-data-loss` can drop columns and data. It is not a migration history. Two deploys can change the database differently, and there is no down script.

## Decision this needs

Harsh approves the moment production leaves `db push`. Until then, do not change the schema and do not run a baseline.

Production schema changes, when approved, go through a temporary Railway Function on the backend service in project `tranquil-bravery`. The function uses the private `DATABASE_URL` already on that service. Do not open a public TCP proxy to Postgres. Delete the function after it exits. Do not point a laptop at production.

## Proposed baseline (not executed)

1. Freeze schema edits. Confirm `schema.prisma` matches the production database (`prisma migrate diff` from the database to the schema prints no SQL).
2. From an empty shadow database, generate one baseline SQL file:

   `pnpm dlx prisma@6.5.0 migrate diff --from-empty --to-schema-datamodel libraries/nestjs-libraries/src/database/prisma/schema.prisma --script`

   Save it as `libraries/nestjs-libraries/src/database/prisma/migrations/<timestamp>_baseline/migration.sql`.
3. On a copy of production (a restored backup, not production), run `prisma migrate resolve --applied <timestamp>_baseline` so Prisma records the baseline without replaying it.
4. Confirm `prisma migrate status` is up to date and `prisma migrate diff` is empty.
5. Only after that, change the backend boot from `db push` to `prisma migrate deploy`, and remove `--accept-data-loss` from `prisma-db-push`.
6. Later schema changes are new migration folders. Do not edit the baseline.

## What stays the same until approval

`prisma-db-push`, Docker boot, and the existing migration SQL files are unchanged by this proposal. No production data is read or written to write this file.
