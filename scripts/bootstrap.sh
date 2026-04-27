#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/7] Enable corepack + pin pnpm"
corepack enable
corepack prepare pnpm@10.33.0 --activate

echo "[2/7] Install dependencies"
pnpm install --frozen-lockfile || pnpm install

echo "[3/7] Prepare env file"
if [[ ! -f .env.local ]]; then
  cp .env.example .env.local
  echo "  created .env.local from .env.example"
else
  echo "  .env.local already exists (skip)"
fi

echo "[3.5/7] Validate env (non-blocking warnings supported)"
bash scripts/env-validate.sh || true

echo "[4/7] Run service/backend tests"
node --test \
  services/ingestion-service/src/index.test.js \
  services/graph-service/src/index.test.js \
  services/agent-service/src/index.test.js \
  apps/api-gateway/src/server.test.js

echo "[5/7] Run web tests"
pnpm test:web

echo "[6/7] Build web"
pnpm build:web

echo "[7/7] Done"
echo "Start API: pnpm dev:api"
echo "Start Web: pnpm --filter web dev --host 0.0.0.0"
