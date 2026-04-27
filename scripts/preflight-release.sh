#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_DIR="${ROOT_DIR}/artifacts"
REPORT_FILE="${REPORT_DIR}/release-preflight-report.md"

mkdir -p "$REPORT_DIR"

{
  echo "# Release Preflight Report"
  echo
  echo "- Generated at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo
  echo "## 1) Environment Validation"
  if bash "$ROOT_DIR/scripts/env-validate.sh"; then
    echo "- PASS"
  else
    echo "- FAIL"
    exit 1
  fi
  echo
  echo "## 2) Quality Check"
  if make -C "$ROOT_DIR" check; then
    echo "- PASS"
  else
    echo "- FAIL"
    exit 1
  fi
  echo
  echo "## 3) Runtime Health (best-effort)"
  if bash "$ROOT_DIR/scripts/health-check.sh"; then
    echo "- PASS"
  else
    echo "- WARN (runtime services may not be started in current environment)"
  fi
} | tee "$REPORT_FILE"

echo "Wrote ${REPORT_FILE}"
