# Azure IaC for Samruddhi Agros

This folder contains a minimal Bicep scaffold used to provision Azure resources for staging.

Resources created:
- Key Vault
- PostgreSQL Flexible Server (placeholder)
- Azure Cache for Redis (placeholder)
- Azure Container Registry (ACR)
- Container Apps managed environment and a Container App

Usage:

```bash
# deploy to a resource group
az deployment group create --resource-group <rg> --template-file infra/azure/main.bicep --parameters environment=staging
```

Notes:
- Update naming, networking, and access policies for production readiness.
- Create Key Vault access policies for managed identities and CI/CD service principal.
