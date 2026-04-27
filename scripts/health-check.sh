#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:3000/health}"
WEB_PORT="${WEB_PORT:-5173}"
NEO4J_PORT="${NEO4J_PORT:-7687}"

failures=0

check_http() {
  local name="$1"
  local url="$2"
  if curl -fsS "$url" >/dev/null 2>&1; then
    echo "[PASS] $name: $url"
  else
    echo "[FAIL] $name: $url"
    failures=$((failures + 1))
  fi
}

check_tcp() {
  local name="$1"
  local host="$2"
  local port="$3"
  if (echo >/dev/tcp/"$host"/"$port") >/dev/null 2>&1; then
    echo "[PASS] $name: $host:$port"
  else
    echo "[WARN] $name not reachable: $host:$port"
  fi
}

check_http "API health" "$API_URL"
check_tcp "Web dev server" "127.0.0.1" "$WEB_PORT"
check_tcp "Neo4j bolt" "127.0.0.1" "$NEO4J_PORT"

if [[ "$failures" -gt 0 ]]; then
  echo "Health check failed with $failures blocking issue(s)."
  exit 1
fi

echo "Health check passed."
