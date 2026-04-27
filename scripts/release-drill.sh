#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REVIEW_DIR="${ROOT_DIR}/docs/reviews"
STAMP="$(date -u +%Y-%m-%d)"
RUN_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
REPORT="${REVIEW_DIR}/release-drill-${STAMP}.md"
HEALTH_STATUS="PASS"

mkdir -p "$REVIEW_DIR"

echo "[1/3] Run preflight"
bash "${ROOT_DIR}/scripts/preflight-release.sh"

echo "[2/3] Run runtime health (best effort)"
if ! bash "${ROOT_DIR}/scripts/health-check.sh"; then
  HEALTH_STATUS="WARN"
fi

echo "[3/3] Generate drill report ${REPORT}"
cat >"${REPORT}" <<EOF_REPORT
# Release Drill Report (${STAMP})

## Scope

- Validate release readiness flow from check -> preflight -> health.

## Executed Commands

1. \`make check\`
2. \`make preflight\`
3. \`make health\` (best effort)

## Result

- Drill executed at: \`${RUN_AT}\`.
- Preflight completed.
- Runtime health status: **${HEALTH_STATUS}**.
- Review \`artifacts/release-preflight-report.md\` for latest runtime notes.

## Next Actions

- If runtime health shows WARN/FAIL, start dependencies and re-run \`make health\`.
- Capture rollback dry-run evidence in this report before production release.
EOF_REPORT

echo "Done: generated ${REPORT}"
