# Release Process (v1)

## Versioning

- Use semantic versioning: `MAJOR.MINOR.PATCH`.
- `PATCH`: bugfix or non-breaking internal update.
- `MINOR`: backward-compatible feature.
- `MAJOR`: breaking API/UI/behavior change.

## Release Checklist

1. `make check` passes.
2. `bash scripts/env-report.sh` generates report.
3. `bash scripts/preflight-release.sh` passes.
4. Update `CHANGELOG.md`.
5. Create release tag and release notes.

## Rollback

1. Revert to previous tag.
2. Re-deploy previous artifact/container.
3. Run `bash scripts/health-check.sh`.
4. Record incident + root cause in postmortem.
