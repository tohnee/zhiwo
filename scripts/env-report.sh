#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACT_DIR="${ROOT_DIR}/artifacts"
JSON_REPORT="${ARTIFACT_DIR}/env-report.json"
MD_REPORT="${ARTIFACT_DIR}/env-report.md"

mkdir -p "$ARTIFACT_DIR"

timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
node_version="$(node -v 2>/dev/null || echo "missing")"
pnpm_version="$(pnpm -v 2>/dev/null || echo "missing")"

run_status() {
  local name="$1"
  shift
  if "$@" >/tmp/"${name}".log 2>&1; then
    echo "pass"
  else
    echo "fail"
  fi
}

svc_status="$(run_status service_tests node --test services/ingestion-service/src/index.test.js services/graph-service/src/index.test.js services/agent-service/src/index.test.js apps/api-gateway/src/server.test.js)"
web_status="$(run_status web_tests pnpm test:web)"
build_status="$(run_status web_build pnpm build:web)"
health_status="$(run_status health_check bash scripts/health-check.sh)"

cat >"$JSON_REPORT" <<EOF
{
  "generatedAt": "${timestamp}",
  "nodeVersion": "${node_version}",
  "pnpmVersion": "${pnpm_version}",
  "checks": {
    "serviceTests": "${svc_status}",
    "webTests": "${web_status}",
    "webBuild": "${build_status}",
    "healthCheck": "${health_status}"
  }
}
EOF

cat >"$MD_REPORT" <<EOF
# Environment Report

- Generated at: ${timestamp}
- Node: ${node_version}
- pnpm: ${pnpm_version}

## Checks

- serviceTests: ${svc_status}
- webTests: ${web_status}
- webBuild: ${build_status}
- healthCheck: ${health_status}
EOF

echo "Generated:"
echo "  ${JSON_REPORT}"
echo "  ${MD_REPORT}"
