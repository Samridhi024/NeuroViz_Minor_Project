# Deployment Runbook — Samruddhi Agros

This runbook describes steps to deploy to Azure staging using the provided Bicep template and Container Apps.

Prerequisites
- Azure CLI installed and logged in (`az login`)
- Appropriate RBAC permissions on the target resource group
- Secrets: `AZURE_CREDENTIALS` (service principal JSON for GitHub Actions), `AZURE_RESOURCE_GROUP`, `ACR_NAME`, `ACR_LOGIN_SERVER`, `ACR_USERNAME`, `ACR_PASSWORD`

Steps

1. Validate Bicep template locally

```bash
az deployment group validate --resource-group <rg> --template-file infra/azure/main.bicep --parameters environment=staging
```

2. Deploy infrastructure (Key Vault, ACR, Container Apps environment)

```bash
az deployment group create --resource-group <rg> --template-file infra/azure/main.bicep --parameters environment=staging
```

3. Build and push server image

```bash
docker build -t <acr-login>/samruddhi/server:staging ./server
az acr login --name <acr-name>
docker push <acr-login>/samruddhi/server:staging
```

4. Update container app image

```bash
az containerapp update --name samruddhi-staging-app --resource-group <rg> --image <acr-login>/samruddhi/server:staging
```

5. Run smoke tests

```bash
# health
curl -f https://<container-app-host>/health
# run basic k6 test
k6 run test/load/k6_script.js
```

Rollback
- To rollback to previous image tag, update the container app with the previous image tag and monitor.

Notes
- Configure Key Vault access policies for the `server` user-assigned identity.
- Store payment provider sandbox keys in Key Vault and reference them via environment variables in the Container App configuration.
