# Backup and restore runbook

This is the operator runbook for Crea8 production. It does not change data. Do not open a public TCP proxy to Postgres. Do not run these steps from a laptop pointed at the production database. Project: Railway `tranquil-bravery`. The API is the backend service. The worker is the orchestrator service. The app is on Vercel.

Postgres backups are an owner action. Writing this file does not turn them on.

## Enable Railway Postgres backups

Crea8 uses Railway Postgres. Two layers exist. Use both.

**Point-in-time recovery (PITR).** On the Postgres service, open the Backups tab. If the banner says point-in-time recovery is off, choose Enable PITR and confirm. Railway creates a `Postgres-PITR` bucket, sets the archive variables, and redeploys. On boot the image turns on WAL archiving with pgBackRest, takes a base backup, and then keeps a full backup about every week and a differential about every day. The last 4 full backups are kept, which is about 4 weeks. The restore window starts at the first base backup after you enable it. Yesterday is not recoverable if you enable it today.

**Volume backups.** On the same Backups tab, create a volume backup schedule in addition to PITR. A volume backup is a restore point for the disk. PITR is the one to use when you need a specific minute. Railway's guide is [Back up and restore Postgres](https://docs.railway.com/guides/postgres-backups-restores) and [Point-in-time recovery](https://docs.railway.com/volumes/point-in-time-recovery).

PITR storage is billed as bucket storage plus egress from the database service. There is no separate PITR fee.

## Verify backups

Run these from a machine logged into the Railway CLI, against the production Postgres service. They read backup status. They do not dump customer rows.

1. `railway postgres pitr status --service <postgres-service-name>` shows archiving healthy and a base backup present.
2. The Backups tab shows a restore range whose start is the first base backup, and a volume backup newer than 24 hours.
3. `railway postgres pitr backup create --service <postgres-service-name> --name manual-check` completes, and the new backup is listed. Delete that manual backup after you have seen it, if you do not want to keep it.
4. Record the date you checked and the oldest restorable time in the team notes.

If status shows archiving stalled, or the newest WAL is more than a few minutes behind a busy database, treat PITR as down and take a `pg_dump` before the next schema change.

## pg_dump fallback

Use this when PITR is off, or you want a logical copy before a schema change. Run it inside a temporary Railway Function on the **backend** service so `DATABASE_URL` is the private URL already on that service. Do not add a public TCP proxy. Do not paste the URL into a laptop.

1. In Railway, on the backend service, create a temporary function whose start command is a one-shot dump. Mount no public port.
2. The function writes a custom-format dump to a file on the function's disk, or streams it to a private bucket you control:

   `pg_dump --format=custom --no-owner --no-acl --file /tmp/crea8.dump "$DATABASE_URL"`

3. Download that file through Railway's function output or copy it to a locked bucket. Do not commit it. Do not leave it on a public URL.
4. Check the dump without restoring it: `pg_restore --list /tmp/crea8.dump | head`. You should see the `Post`, `Organization`, `Media`, and `LinkPage` tables.
5. Delete the function when the file is stored. A function left running is a shell on production.

A dump is one moment in time. It does not replace PITR.

## Restore into a fresh Railway Postgres

Restoring never writes over the database that is serving traffic. You get a second database, check it, then point the app at it.

**From PITR.** On the Backups tab, pick a time inside the restore range and choose Restore to this moment. Railway creates a new service named like `<source>-restored-YYYYMMDD-HHMM`. The source keeps serving. The new service replays WAL up to that time and does not archive back into the source bucket. When it is healthy, its private `DATABASE_URL` is the restored database.

**From a volume backup.** Restore the volume onto a new Postgres service, not onto the live volume.

**From pg_dump.** Create an empty Postgres service in `tranquil-bravery`. From a temporary function on the backend (or on that new service, with the dump file available there), run:

`pg_restore --no-owner --no-acl --dbname "$NEW_DATABASE_URL" /tmp/crea8.dump`

Use the new service's private URL. Do not open a public proxy for the restore either.

**Cut over.**

1. Put the API and the orchestrator in a maintenance window. Stop the orchestrator first so it does not write posts while you switch.
2. Set `DATABASE_URL` on the backend and the orchestrator to the restored service's private URL. Redeploy both.
3. Run the checks in the drill checklist below.
4. Leave the old database in place until the drill passes. Do not delete it the same day.
5. If the restored data is wrong, set `DATABASE_URL` back to the original service and redeploy. The original was not modified by PITR or by a restore into a new service.

## Quarterly restore drill

Do this every quarter, and again before any production schema change. The output is a note that says the date, the backup you used, and whether each step passed. A backup that has never been restored is not a backup.

1. [ ] Confirm PITR status is healthy and a volume backup exists from the last day.
2. [ ] Pick a time at least one hour ago and restore it to a new Postgres service. Do not change the live `DATABASE_URL` yet.
3. [ ] From a temporary function using the new private URL, run `SELECT COUNT(*) FROM "Organization"` and `SELECT COUNT(*) FROM "Post"`. The counts are in the same range as production. Do not print row contents into the ticket.
4. [ ] Connect a scratch backend (not the production service) to the new URL and open one known organization in a non-production frontend, or call `GET /monitor` if that scratch process exposes it. Confirm the process boots and can query.
5. [ ] Take a `pg_dump` of the restored database and `pg_restore --list` it.
6. [ ] Write down the wall time from "restore" to "counts look right".
7. [ ] Delete the scratch service, the temporary function, and the drill database. Do not delete the source. Do not delete the PITR bucket.
8. [ ] File the note where the team keeps launch checks. If any step failed, PITR is not done and launch backup sign-off stays open.

## R2 media

Uploaded files live in the Cloudflare R2 bucket named by `CLOUDFLARE_BUCKETNAME`. The public origin is `CLOUDFLARE_BUCKET_URL`. Postgres backups do not include those objects.

**Versioning.** In the Cloudflare dashboard, open the bucket, then Settings, and enable object versioning. Overwrites and deletes then keep the previous object version. That covers a bad upload or an accidental delete. It does not protect you if the whole bucket or the Cloudflare account is lost.

**Off-site copy.** Once a month, copy the bucket to a second R2 bucket in the same account, or to another provider, with `rclone sync`. Keep the destination private. Do not sync it to a public bucket. Test a restore by copying one known object key back to a scratch bucket and opening it with a signed GET.

**What the app expects.** Private media is served with a short-lived signed GET after an organization check. Link-in-Bio images and published post media are served with a longer-lived signed URL, or from a key under the `public/` prefix, which stays on `CLOUDFLARE_BUCKET_URL`. Turning off public access on the bucket does not rewrite rows. The app resolves the stored URL to a signed URL. A link someone saved that points straight at `CLOUDFLARE_BUCKET_URL` stops working once public access is off.

**Drill.** Quarterly, with the database drill: pick one media key from a non-production org, confirm a signed GET returns the bytes, delete nothing in production, and confirm versioning lists more than the current version for an object you overwrote in a scratch bucket.
