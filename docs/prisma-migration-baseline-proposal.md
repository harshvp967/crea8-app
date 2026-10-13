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

Do these in order. Stop if a check fails. Nothing below has been run.

### 1. Freeze and prove the schema matches production

Stop merging schema edits. On a restored backup (see `docs/backup-restore-runbook.md`), not on production, confirm the live database and `schema.prisma` describe the same shape:

```text
pnpm dlx prisma@6.5.0 migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel libraries/nestjs-libraries/src/database/prisma/schema.prisma \
  --script
```

The URL is the private URL of the restored copy, used from a temporary Railway Function on the backend service. An empty script means they match. Any SQL means production has drifted. Fix that drift, with Harsh's approval, before a baseline. Do not use `--accept-data-loss` to "fix" it.

`--from-url` needs a shadow database when Prisma asks for one. Give the function a second empty Postgres (a new Railway Postgres service) as `SHADOW_DATABASE_URL`. Do not point the shadow URL at the database that has customers.

### 2. Generate the baseline SQL

From an empty schema, still on a machine that is not production:

```text
pnpm dlx prisma@6.5.0 migrate diff \
  --from-empty \
  --to-schema-datamodel libraries/nestjs-libraries/src/database/prisma/schema.prisma \
  --script
```

Save the output as:

`libraries/nestjs-libraries/src/database/prisma/migrations/<timestamp>_baseline/migration.sql`

`<timestamp>` is `YYYYMMDDHHMMSS`. Add the folder to git. Do not edit the SQL after it is merged. The existing SQL files under `migrations/` stay where they are. They are not the baseline and Prisma will not run them as part of this step.

Check the file by applying it to the empty shadow database only:

```text
pnpm dlx prisma@6.5.0 migrate diff \
  --from-empty \
  --to-schema-datamodel libraries/nestjs-libraries/src/database/prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL" \
  --script
```

Then, on the shadow database, `migrate deploy` once. It should apply the baseline and only the baseline.

### 3. Mark the baseline applied on production

Production already has the tables. Replaying the baseline would try to create them again. `migrate resolve` only writes a row to `_prisma_migrations`. It does not run the SQL.

Run it once, from a temporary Railway Function on the backend service in `tranquil-bravery`. The function's environment already has the private `DATABASE_URL`. Do not open a public TCP proxy. Do not run this from a laptop.

```text
pnpm dlx prisma@6.5.0 migrate resolve \
  --applied <timestamp>_baseline \
  --schema libraries/nestjs-libraries/src/database/prisma/schema.prisma
```

Delete the function when it exits.

Before that production command, run the same `migrate resolve --applied` against the restored copy and confirm the next section there.

### 4. Verify the history

On the restored copy first, then on production from another temporary function:

```text
pnpm dlx prisma@6.5.0 migrate status \
  --schema libraries/nestjs-libraries/src/database/prisma/schema.prisma
```

Status must say the database is up to date and list `<timestamp>_baseline` as applied.

```text
pnpm dlx prisma@6.5.0 migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel libraries/nestjs-libraries/src/database/prisma/schema.prisma \
  --script
```

That script must be empty. `migrate deploy` on the copy must print that no pending migrations remain.

### 5. Swap boot from db push to migrate deploy, behind a flag

Do this only after step 4 is empty on production. This section describes the edit. It is not done in the repo today. `package.json`, `pm2-run`, and `var/docker/backend-start.sh` stay on `db push` until Harsh approves and a later change lands.

Add `PRISMA_MIGRATE=1` on the Railway backend only. Leave it unset everywhere else.

When the flag is unset, behavior stays exactly what ships now:

- `pnpm run prisma-db-push` remains `prisma db push --accept-data-loss` for local use. Do not point it at production.
- `pm2-run` still runs `pnpm run prisma-db-push` before the processes.
- `var/docker/backend-start.sh` still runs `prisma db push` without `--accept-data-loss`, then the API.

When `PRISMA_MIGRATE=1`, those three call `prisma migrate deploy` instead of `db push`:

- `package.json`: a script `prisma-migrate-deploy` equal to `pnpm dlx prisma@6.5.0 migrate deploy --schema ./libraries/nestjs-libraries/src/database/prisma/schema.prisma`. `prisma-db-push` itself stays the push command so a local operator can still opt into it. `pm2-run` becomes: if `PRISMA_MIGRATE` is `1`, run `prisma-migrate-deploy`, otherwise run `prisma-db-push`.
- `var/docker/backend-start.sh`: if `PRISMA_MIGRATE` is `1`, run `migrate deploy` with `--schema` pointed at the same schema file, and do not run `db push`. Otherwise keep the current push.
- The orchestrator does not apply schema. It does not get the flag. Vercel does not get the flag.

`migrate deploy` applies pending folders and will not drop columns that a migration does not drop. It fails closed if a migration was edited after it was applied.

### 6. Later schema changes

Each change is a new folder `migrations/<timestamp>_<name>/migration.sql` produced with `migrate dev` against a local database, or with `migrate diff` from the previous schema to the new one. Review the SQL. Deploy by setting `PRISMA_MIGRATE=1` and booting the backend, which runs `migrate deploy`. Do not edit the baseline. Do not run `db push` against production after the flag is on.

### 7. Rollback

`migrate deploy` does not have a down command in Prisma 6.5. Roll back by restoring, not by editing applied SQL.

1. Stop the orchestrator so writes pause.
2. If the bad migration only added unused objects and you have written a reviewed reverse SQL file, run that SQL from a temporary Railway Function on the private `DATABASE_URL`, then `migrate resolve --rolled-back <migration_name>` from that same function. Only do this when the reverse SQL is the exact inverse and nobody has written data you still need.
3. Otherwise restore the PITR timestamp from before the migration into a new Postgres service, following `docs/backup-restore-runbook.md`. Point the backend and orchestrator `DATABASE_URL` at the new service. Redeploy.
4. Unset `PRISMA_MIGRATE` only if you are also moving the code back to the previous release. A new binary that expects the new columns will not run against the old database. Roll the code and the database back together.
5. Delete the temporary function. Do not leave a public proxy.

A failed `migrate deploy` that did not commit (the migration SQL errored) leaves `_prisma_migrations` without a finished row. Fix the SQL in a new migration. Do not edit the failed folder if it partially committed; add a forward migration or restore.

### 8. Verification after the first real deploy

1. Temporary function: `migrate status` is up to date.
2. `migrate diff` from the production URL to `schema.prisma` prints no SQL.
3. The backend boots, `GET /monitor` responds, and a login still works.
4. The orchestrator boots and a queued post still has its row.
5. No `db push` line in the backend boot logs while `PRISMA_MIGRATE=1`.

## What stays the same until approval

`prisma-db-push`, `pm2-run`, Docker boot, and the existing migration SQL files are unchanged by this proposal. No production data is read or written to write this file. No flag is set.
