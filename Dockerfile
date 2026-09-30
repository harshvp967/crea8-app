# Production images for the Railway backend and orchestrator.
#
# Railpack currently reinstalls the whole workspace (frontend included) on
# every deploy. These targets install only the server runtime, compile both
# Nest apps the same way the repo scripts do (`pnpm --filter <app> run build`,
# which is `nest build`), generate the Prisma client at build time (the same
# work the root postinstall does today), and leave start-up to the node
# command those package.json scripts already exec.
#
# No environment values are baked in. Railway injects service variables at
# runtime. Prisma db push is not part of either service's start script (it
# only runs from the all-in-one `pm2-run` script), so the containers do not
# migrate on boot.

# syntax=docker/dockerfile:1.7

FROM node:22.20-bookworm-slim AS build

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    openssl \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

RUN npm install --global pnpm@10.6.1

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY tsconfig.base.json tsconfig.json ./
COPY apps/backend ./apps/backend
COPY apps/orchestrator ./apps/orchestrator
COPY libraries/nestjs-libraries ./libraries/nestjs-libraries
COPY libraries/helpers ./libraries/helpers
COPY var/docker/prepare-server-package.mjs var/docker/prepare-server-package.mjs
COPY var/docker/link-gitroom-aliases.sh var/docker/link-gitroom-aliases.sh

# Dummy URL satisfies `env("DATABASE_URL")` in the Prisma schema during
# `prisma generate`. It is not copied into the runtime stages.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build

RUN node var/docker/prepare-server-package.mjs \
  && pnpm install --ignore-scripts --no-frozen-lockfile \
  && pnpm rebuild bcrypt \
  && pnpm exec prisma generate --schema ./libraries/nestjs-libraries/src/database/prisma/schema.prisma \
  && NODE_OPTIONS=--max-old-space-size=4096 pnpm --filter ./apps/backend run build \
  && NODE_OPTIONS=--max-old-space-size=4096 pnpm --filter ./apps/orchestrator run build \
  && pnpm prune --prod \
  && rm -rf \
    node_modules/@nestjs/cli \
    node_modules/@nestjs/schematics \
    node_modules/@swc/cli \
    node_modules/fork-ts-checker-webpack-plugin \
    node_modules/@types \
    /root/.local /root/.cache /tmp/* \
  && find node_modules -name '*.map' -delete

FROM node:22.20-bookworm-slim AS runtime-base

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/var/docker/link-gitroom-aliases.sh ./var/docker/link-gitroom-aliases.sh

FROM runtime-base AS backend

COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/package.json ./apps/backend/package.json
RUN sh var/docker/link-gitroom-aliases.sh backend \
  && node --experimental-require-module -e "require('@gitroom/nestjs-libraries/sentry/initialize.sentry'); require('@prisma/client'); require('bcrypt'); require('sharp');"

WORKDIR /app/apps/backend
EXPOSE 3000
# Same node invocation as apps/backend/package.json "start", without
# `dotenv -e ../../.env`. That wrapper is for local dev; a missing .env file
# makes dotenv-cli exit, and Railway already injects service variables.
CMD ["node", "--experimental-require-module", "dist/apps/backend/src/main.js"]

FROM runtime-base AS orchestrator

COPY --from=build /app/apps/orchestrator/dist ./apps/orchestrator/dist
COPY --from=build /app/apps/orchestrator/package.json ./apps/orchestrator/package.json
RUN sh var/docker/link-gitroom-aliases.sh orchestrator \
  && node --experimental-require-module -e "require('@gitroom/nestjs-libraries/sentry/initialize.sentry'); require('@gitroom/orchestrator/workflows'); require('@prisma/client'); require('bcrypt'); require('sharp');"

WORKDIR /app/apps/orchestrator
EXPOSE 3002
CMD ["node", "--experimental-require-module", "dist/apps/orchestrator/src/main.js"]
