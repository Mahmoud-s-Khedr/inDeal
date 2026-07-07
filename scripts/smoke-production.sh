#!/bin/sh
set -eu

BASE_URL="${1:-http://127.0.0.1:3000}"

echo "Checking root endpoint..."
curl --fail --silent --show-error "$BASE_URL/" >/dev/null

echo "Checking health endpoint..."
curl --fail --silent --show-error "$BASE_URL/api/v1/health" >/dev/null

echo "Checking system config endpoint..."
curl --fail --silent --show-error "$BASE_URL/api/v1/system/config" >/dev/null

echo "Smoke checks passed for $BASE_URL"
