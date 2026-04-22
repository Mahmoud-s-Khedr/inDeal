#!/bin/sh
set -eu

LOCKFILE="package-lock.json"
HASH_FILE="node_modules/.lockfile-sha256"

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
  npm install
  mkdir -p node_modules
  echo "$current_hash" > "$HASH_FILE"
fi

exec npm run dev
