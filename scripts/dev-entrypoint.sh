#!/bin/sh
set -eu

LOCKFILE="package-lock.json"
HASH_FILE="/tmp/indeal-lockfile-sha256"

compute_hash() {
  if [ -f "$LOCKFILE" ]; then
    sha256sum "$LOCKFILE" | awk '{print $1}'
  else
    echo ""
  fi
}

current_hash="$(compute_hash)"
stored_hash=""

if [ -f "$HASH_FILE" ]; then
  stored_hash="$(cat "$HASH_FILE")"
fi

needs_install=0

if [ ! -d "node_modules" ]; then
  needs_install=1
elif [ ! -d "node_modules/@prisma/client" ]; then
  needs_install=1
elif [ "$current_hash" != "$stored_hash" ]; then
  needs_install=1
fi

if [ "$needs_install" -eq 1 ]; then
  echo "📦 Syncing npm dependencies..."
  if [ -f "$LOCKFILE" ]; then
    HUSKY=0 npm ci --no-package-lock --no-audit --no-fund
  else
    HUSKY=0 npm install --no-package-lock --no-audit --no-fund
  fi
  echo "$current_hash" > "$HASH_FILE"
fi

if [ "${AUTO_MIGRATE:-false}" = "true" ]; then
  if [ -d "prisma/migrations" ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
    echo "🗃️ Running Prisma migrations..."
    npm run prisma:migrate:deploy
  else
    echo "🗃️ No Prisma migrations found; syncing schema with db push..."
    npm run prisma:db:push
  fi
fi

echo "🔎 Verifying database schema..."
node scripts/verify-schema.js

if [ "${AUTO_SEED:-false}" = "true" ]; then
  echo "🌱 Running database seeder..."
  if [ -n "${SEED_MODE:-}" ]; then
    SEED_MODE="${SEED_MODE}" npm run db:seed
  else
    npm run db:seed
  fi
fi

exec npm run dev
