#!/bin/sh
# Apply the Prisma schema, then start the API.
#
# Prisma 6.5 treats --accept-data-loss as a presence flag. Passing it would
# allow drops. Leaving it off is the non-destructive mode: in this
# non-interactive container a push that would drop columns or tables exits
# non-zero and the process does not start. Additive changes (the Link-in-Bio
# tables, Organization.customDomainAddon) are applied. --skip-generate keeps
# the client compiled into the image.
set -eu
cd /app
node ./node_modules/prisma/build/index.js db push \
  --skip-generate \
  --schema ./libraries/nestjs-libraries/src/database/prisma/schema.prisma
cd /app/apps/backend
exec node --experimental-require-module dist/apps/backend/src/main.js
