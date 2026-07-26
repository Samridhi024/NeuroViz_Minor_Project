## Azure Deploy

Workflows added:
- `.github/workflows/deploy-azure.yml` — Bicep deploy + build/push image to ACR + deploy to Container Apps (requires AZURE_CREDENTIALS, ACR_* secrets).
- `.github/workflows/build-and-push.yml` — manual build+push image workflow.
- `.github/workflows/integration-compose.yml` — runs docker-compose integration tests in CI.

Required secrets for deploy:
- `AZURE_CREDENTIALS` (service principal JSON)
- `AZURE_RESOURCE_GROUP`
- `ACR_NAME`, `ACR_LOGIN_SERVER`, `ACR_USERNAME`, `ACR_PASSWORD`

Usage (manually):

```bash
# Deploy infra
az deployment group create --resource-group <rg> --template-file infra/azure/main.bicep --parameters environment=staging

# Build and push image
docker build -t <acr-login>/samruddhi/server:latest ./server
az acr login --name <acr-name>
docker push <acr-login>/samruddhi/server:latest

# Create container app (example)
az containerapp create --name samruddhi-staging-app --resource-group <rg> --environment samruddhi-staging-env --image <acr-login>/samruddhi/server:latest --ingress 'external' --target-port 3000 --registry-server <acr-login> --registry-username <acr-username> --registry-password <acr-password>
```