Integration Test Guide
======================

Prerequisites
- Docker & Docker Compose installed and running

Run integration stack (Postgres, Redis, server):

```bash
docker compose -f docker-compose.test.yml up --build
```

In another terminal, wait for the server to be healthy, then run:

```bash
cd server
npm ci --no-audit --no-fund
npm test # or run the integration vitest command
```

Notes
- Integration tests currently include a basic health check and placeholders for checkout/refund flows.
- To fully run E2E tests, ensure migrations are applied and environment variables for Key Vault and payments are set.
