#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is not installed. Please install Docker Desktop/Engine first."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose is not available. Please install Docker Compose v2."
  exit 1
fi

echo "Starting docker compose services..."
docker compose -f infra/docker/docker-compose.yml up -d
echo "Services started."
