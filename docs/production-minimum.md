# Production Minimum Configuration

## Runtime

- Node.js 22+
- pnpm 10+
- Optional Docker + Compose for containerized deploy

## Required Ports

- API Gateway: `3000`
- Web (if hosted separately): `5173` (dev) / static web server (prod)
- Neo4j (optional): `7474` / `7687`

## Environment Variables

- `DEEPSEEK_API_KEY` (optional, enables live LLM)
- `DEEPSEEK_MODEL` (optional)
- `NEO4J_URI` / `NEO4J_USERNAME` / `NEO4J_PASSWORD` (optional)

## Reverse Proxy Baseline

- Route `/api/*` to API gateway
- Route web static assets to frontend host
- Enable HTTPS
- Enable basic request/response logging
- See deployable example: `docs/deploy/nginx.conf.example`

## Security Baseline

- Keep `.env.local` out of VCS
- Rotate external API keys periodically
- Restrict inbound access by firewall/SG
- Keep dependencies up to date
