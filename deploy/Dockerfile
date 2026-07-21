# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

WORKDIR /app

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/agents/package.json packages/agents/package.json
COPY packages/mcp-adapters/package.json packages/mcp-adapters/package.json
COPY packages/mission-engine/package.json packages/mission-engine/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile --ignore-scripts

FROM dependencies AS builder

COPY . .

ENV DATABASE_URL="file:/tmp/nexus-build.db"

RUN pnpm --filter @nexus/mission-engine db:generate
RUN pnpm build

FROM node:22-bookworm-slim AS runner

ENV NODE_ENV="production"
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/app/packages/mission-engine/prisma/dev.db"

WORKDIR /app

RUN apt-get update \
  && apt-get install --yes --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && npm install --global prisma@6.19.1 \
  && npm cache clean --force

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/packages/mission-engine/prisma/schema.prisma \
  ./prisma/schema.prisma
COPY scripts/start-production.sh ./scripts/start-production.sh

RUN chmod +x ./scripts/start-production.sh

VOLUME ["/app/packages/mission-engine/prisma"]

EXPOSE 3000

CMD ["./scripts/start-production.sh"]
