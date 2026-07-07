#!/bin/sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

echo "Pulling/building production images..."
docker compose -f "$COMPOSE_FILE" build api worker

echo "Starting Valkey..."
docker compose -f "$COMPOSE_FILE" up -d valkey

echo "Running Prisma migrations..."
docker compose -f "$COMPOSE_FILE" --profile ops run --rm migrate

echo "Starting API and worker..."
docker compose -f "$COMPOSE_FILE" up -d api worker

echo "Current service status:"
docker compose -f "$COMPOSE_FILE" ps
