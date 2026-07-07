#!/bin/sh
set -eu

if [ "${AUTO_MIGRATE:-true}" = "true" ]; then
  if [ -d "prisma/migrations" ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
    echo "🗃️ Running Prisma migrations (deploy)..."
    npx prisma migrate deploy
  else
    echo "🗃️ No Prisma migrations found; skipping migrate deploy."
  fi
fi

exec npm run start:api
