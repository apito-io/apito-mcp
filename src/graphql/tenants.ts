import type { ApitoGraphQLClient, GraphQLRequestOptions } from '../graphql-client.js';
import type { TenantListItem } from '../types.js';

const GET_TENANTS = `
  query GetTenants {
    getTenants {
      tenants {
        id
        name
        icon
        data
        domain
      }
    }
  }
`;

const CREATE_TENANT = `
  mutation CreateTenant($name: String!, $data: String, $domain: String) {
    createTenant(name: $name, data: $data, domain: $domain) {
      id
      name
      status
      data
      domain
    }
  }
`;

const UPDATE_TENANT = `
  mutation UpdateTenant($tenant_id: String!, $name: String, $data: String, $domain: String) {
    updateTenant(tenant_id: $tenant_id, name: $name, data: $data, domain: $domain) {
      id
      name
      status
      data
      domain
    }
  }
`;

const DELETE_TENANT = `
  mutation DeleteTenant($tenant_id: String!) {
    deleteTenant(tenant_id: $tenant_id)
  }
`;

const GENERATE_TENANT_TOKEN = `
  mutation GenerateTenantToken($tenant_id: String!, $duration: String!, $role: String) {
    generateTenantToken(tenant_id: $tenant_id, duration: $duration, role: $role) {
      token
      tenant_id
      role
    }
  }
`;

const SEARCH_TENANTS_BY_DOMAIN = `
  query SearchTenantsByDomain($project_id: String!, $domain: String!) {
    searchTenantsByDomain(project_id: $project_id, domain: $domain) {
      tenant {
        id
        name
        status
        domain
        data
      }
    }
  }
`;

export async function listTenants(
  client: ApitoGraphQLClient,
  reqOpts?: GraphQLRequestOptions
): Promise<TenantListItem[]> {
  const result = await client.request<{ getTenants: { tenants: TenantListItem[] } }>(
    GET_TENANTS,
    {},
    reqOpts
  );
  return result.getTenants?.tenants ?? [];
}

export async function createTenant(
  client: ApitoGraphQLClient,
  args: { name: string; data?: string; domain?: string },
  reqOpts?: GraphQLRequestOptions
): Promise<TenantListItem> {
  const result = await client.request<{ createTenant: TenantListItem }>(CREATE_TENANT, args, reqOpts);
  return result.createTenant;
}

export async function updateTenant(
  client: ApitoGraphQLClient,
  args: { tenant_id: string; name?: string; data?: string; domain?: string },
  reqOpts?: GraphQLRequestOptions
): Promise<TenantListItem> {
  const result = await client.request<{ updateTenant: TenantListItem }>(UPDATE_TENANT, args, reqOpts);
  return result.updateTenant;
}

export async function deleteTenant(
  client: ApitoGraphQLClient,
  tenantId: string,
  reqOpts?: GraphQLRequestOptions
): Promise<boolean> {
  const result = await client.request<{ deleteTenant: boolean }>(
    DELETE_TENANT,
    { tenant_id: tenantId },
    reqOpts
  );
  return result.deleteTenant;
}

export async function generateTenantToken(
  client: ApitoGraphQLClient,
  args: { tenant_id: string; duration: string; role?: string },
  reqOpts?: GraphQLRequestOptions
): Promise<{ token: string; tenant_id: string; role?: string }> {
  const result = await client.request<{
    generateTenantToken: { token: string; tenant_id: string; role?: string };
  }>(GENERATE_TENANT_TOKEN, args, reqOpts);
  return result.generateTenantToken;
}

export async function searchTenantByDomain(
  client: ApitoGraphQLClient,
  args: { project_id: string; domain: string },
  reqOpts?: GraphQLRequestOptions
): Promise<TenantListItem | null> {
  const result = await client.request<{
    searchTenantsByDomain: { tenant: TenantListItem | null };
  }>(SEARCH_TENANTS_BY_DOMAIN, args, reqOpts);
  return result.searchTenantsByDomain?.tenant ?? null;
}
