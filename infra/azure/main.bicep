// Azure IaC scaffold for Samruddhi Agros
@description('Location for resources')
param location string = resourceGroup().location
param environment string = 'staging'
param principalId string = ''
param acrAdminEnabled bool = false

resource kv 'Microsoft.KeyVault/vaults@2022-11-01' = {
  name: 'samruddhi-${environment}-kv'
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    accessPolicies: []
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Deny'
      virtualNetworkRules: [
        {
          id: '${vnet.id}/subnets/default'
        }
      ]
    }
    enablePurgeProtection: true
    enableSoftDelete: true
  }
}

// Virtual Network and Subnet for isolation (placeholder)
resource vnet 'Microsoft.Network/virtualNetworks@2020-06-01' = {
  name: 'samruddhi-${environment}-vnet'
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.1.0.0/16'
      ]
    }
    subnets: [
      {
        name: 'default'
        properties: {
          addressPrefix: '10.1.0.0/24'
          networkSecurityGroup: {
            id: resourceId('Microsoft.Network/networkSecurityGroups', 'samruddhi-${environment}-nsg')
          }
        }
      }
    ]
  }
}

// Network Security Group for VNet subnet
resource nsg 'Microsoft.Network/networkSecurityGroups@2020-06-01' = {
  name: 'samruddhi-${environment}-nsg'
  location: location
  properties: {
    securityRules: [
      {
        name: 'AllowOutboundHTTPS'
        properties: {
          priority: 100
          direction: 'Outbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '443'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
        }
      }
    ]
  }
}

// Private Endpoint for Key Vault to keep secrets traffic inside the VNet
resource kvPrivateEndpoint 'Microsoft.Network/privateEndpoints@2021-08-01' = {
  name: 'samruddhi-${environment}-kv-pe'
  location: location
  properties: {
    subnet: {
      id: '${vnet.id}/subnets/default'
    }
    privateLinkServiceConnections: [
      {
        name: 'kv-privlink'
        properties: {
          privateLinkServiceId: kv.id
          groupIds: [
            'vault'
          ]
        }
      }
    ]
  }
}

output kvPrivateEndpointId string = kvPrivateEndpoint.id

// User-managed identity to assign to Container App
resource serverIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2018-11-30' = {
  name: 'samruddhi-${environment}-identity'
  location: location
}

// Grant Key Vault access policy to the server identity if principalId not empty
resource kvAccess 'Microsoft.KeyVault/vaults/accessPolicies@2022-11-01' = if (!empty(serverIdentity.id)) {
  parent: kv
  name: 'add'
  properties: {
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: serverIdentity.properties.principalId
        permissions: {
          secrets: [ 'get', 'list' ]
        }
      }
    ]
  }
}

// Placeholder for Azure Database for PostgreSQL Flexible Server
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2022-12-01' = {
  name: 'samruddhi-${environment}-pg'
  location: location
  properties: {
    version: '15'
  }
}

// Placeholder for Azure Cache for Redis
resource redis 'Microsoft.Cache/Redis@2023-04-01' = {
  name: 'samruddhi-${environment}-redis'
  location: location
  properties: {
    sku: {
      name: 'Standard'
      family: 'C'
      capacity: 1
    }
  }
}

// Azure Container Registry for images
resource acr 'Microsoft.ContainerRegistry/registries@2023-01-01' = {
  name: 'samruddhi${environment}acr'
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {}
}

// Container Apps environment (Managed Environment)
resource containerEnv 'Microsoft.Web/managedEnvironments@2023-05-01' = {
  name: 'samruddhi-${environment}-env'
  location: location
  properties: {}
}

// Container App (placeholder) referencing the ACR image
resource containerApp 'Microsoft.Web/containerApps@2023-05-01' = {
  name: 'samruddhi-${environment}-app'
  location: location
  properties: {
    managedEnvironmentId: containerEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
      }
    }
    template: {
      containers: [
        {
          name: 'server'
          image: '${acr.properties.loginServer}/samruddhi/server:latest'
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
      }
    }
  }
}

  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${serverIdentity.id}': {}
    }
  }

output acrLoginServer string = acr.properties.loginServer
output containerAppName string = containerApp.name
output serverIdentityId string = serverIdentity.id
output vnetId string = vnet.id

// Optional role assignment for pushing images to ACR
resource acrRole 'Microsoft.Authorization/roleAssignments@2020-04-01-preview' = if (!empty(principalId)) {
  name: guid(acr.id, principalId, 'acrpusher')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

output keyVaultName string = kv.name
output postgresName string = postgres.name
output redisName string = redis.name
