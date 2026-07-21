#!/bin/sh
set -eu

DATABASE_URL="${DATABASE_URL:-file:/app/packages/mission-engine/prisma/dev.db}"
export DATABASE_URL

case "$DATABASE_URL" in
  file:*)
    database_path="${DATABASE_URL#file:}"
    mkdir -p "$(dirname "$database_path")"
    ;;
esac

prisma db push \
  --schema /app/prisma/schema.prisma \
  --skip-generate

exec node /app/apps/web/server.js
