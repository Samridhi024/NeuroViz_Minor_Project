# PR: D2C slot-based delivery + FEFO, reservations, refunds, infra

## Summary
This PR implements the D2C slot-based delivery transition and supporting systems:

- FEFO inventory allocation with Redis-first atomic reservations (Lua script)
- Redis soft-reservation (10-minute TTL) and reservation expiry worker
- Refund pipeline (pre-fulfillment via adapters, post-delivery UPI payout/wallet fallback)
- `PartnerCashLedger` net-settlement enforcement and COD cap (₹2,000)
- AES-256-GCM PII encryption with Key Vault envelope keys
- HMAC-SHA256 webhook verification + idempotency storage
- Append-only `AuditLog` model
- Rate-limiting, BullMQ workers, and test coverage (unit/integration)
- Dockerfile, `docker-compose.test.yml`, `k6` load smoke script
- Azure IaC (`infra/azure/main.bicep`) with Key Vault, ACR, Container Apps env, user-assigned identity, NSG, and KV private endpoint
- GitHub Actions workflows for CI, build/push, integration-compose and deploy scaffold

## Checklist before merging
- [ ] Add remote and push branch:

```bash
# replace <repo-url> with your GitHub repo (HTTPS or SSH)
git remote add origin <repo-url>
git push -u origin feature/d2c-slot-delivery
```

- [ ] Open a PR from `feature/d2c-slot-delivery` to your default branch via GitHub; include this PR body.
- [ ] Add GitHub Actions secrets:
  - `AZURE_CREDENTIALS` (service principal JSON) — for `deploy-azure.yml`
  - `AZURE_RESOURCE_GROUP` — resource group name
  - `ACR_NAME`, `ACR_USERNAME`, `ACR_PASSWORD` — for building/pushing images
  - Payment sandbox keys (optional): `RAZORPAY_SANDBOX_KEY`, `PHONEPE_SANDBOX_KEY`, `UPI_SANDBOX_KEY`
- [ ] Merge and monitor GitHub Actions (CI, integration-compose). The integration job will run docker-compose and optionally k6.

## How to run integration locally
1. Start the stack:

```bash
docker compose -f docker-compose.test.yml up --build -d
```

2. Run integration tests:

```bash
cd server
RUN_INTEGRATION=1 npm ci --no-audit --no-fund
RUN_INTEGRATION=1 npx vitest
```

3. Run k6 smoke test (requires k6 or Docker):

```bash
# via Docker
docker run --rm -i loadimpact/k6 run - < test/load/k6_script.js
```

---

If you want, I can open the PR for you if you provide a GitHub token (or run the `gh` CLI here). Otherwise push the branch and I will monitor CI and help triage any failures.