#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[WARN] .env.local not found, fallback defaults will be used."
  exit 0
fi

echo "Validating ${ENV_FILE}..."

check_var() {
  local name="$1"
  local level="$2"
  local value
  value="$(grep -E "^${name}=" "$ENV_FILE" | tail -n 1 | cut -d'=' -f2- || true)"
  if [[ -n "${value}" ]]; then
    echo "[PASS] ${name} (${level})"
    return
  fi
  if [[ "$level" == "required" ]]; then
    echo "[FAIL] ${name} (${level}) is empty"
    failures=$((failures + 1))
  else
    echo "[WARN] ${name} (${level}) is empty; service may run in degraded mode"
  fi
}

failures=0

check_var "DEEPSEEK_API_KEY" "optional"
check_var "NEO4J_URI" "optional"
check_var "NEO4J_USERNAME" "optional"
check_var "NEO4J_PASSWORD" "optional"
check_var "FEISHU_APP_ID" "optional"
check_var "FEISHU_APP_SECRET" "optional"
check_var "YOUTUBE_API_KEY" "optional"

if [[ "$failures" -gt 0 ]]; then
  echo "Environment validation failed with $failures required issue(s)."
  exit 1
fi

echo "Environment validation finished."
