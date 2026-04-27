.PHONY: setup test test-services test-web build-web dev-api dev-web check up down health env-validate env-report preflight release-drill

setup:
	bash scripts/bootstrap.sh

test-services:
	node --test \
		services/ingestion-service/src/index.test.js \
		services/graph-service/src/index.test.js \
		services/agent-service/src/index.test.js \
		apps/api-gateway/src/server.test.js

test-web:
	pnpm test:web

test: test-services test-web

build-web:
	pnpm build:web

check: test build-web

up:
	bash scripts/dev-up.sh

down:
	bash scripts/dev-down.sh

health:
	bash scripts/health-check.sh

env-validate:
	bash scripts/env-validate.sh

env-report:
	bash scripts/env-report.sh

preflight:
	bash scripts/preflight-release.sh

release-drill:
	bash scripts/release-drill.sh

dev-api:
	pnpm dev:api

dev-web:
	pnpm --filter web dev --host 0.0.0.0
