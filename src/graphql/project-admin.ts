import type { ApitoGraphQLClient, GraphQLRequestOptions } from '../graphql-client.js';
import type {
  ProjectPlan,
  ProjectRole,
  SchemaChangeEventItem,
  SchemaVersionItem,
} from '../types.js';

const GET_PROJECT_ROLES = `
  query GetProjectRoles {
    currentProject {
      id
      roles
    }
  }
`;

const LIST_PERMISSIONS = `
  query ListPermissionsAndScopes {
    listPermissionsAndScopes {
      permissions
      models
      functions
    }
  }
`;

const GET_PROJECT_SETTINGS = `
  query GetProjectSettings {
    currentProject {
      id
      name
      description
      project_secret_key
      roles
      settings {
        locals
        enable_revision_history
        system_graphql_hooks
        default_storage_plugin
        default_function_plugin
        default_locale
      }
    }
  }
`;

const UPDATE_PROJECT_SETTINGS = `
  mutation UpdateProjectSettings(
    $name: String
    $description: String
    $settings: UpdateSettingsPayload
  ) {
    updateProject(name: $name, description: $description, settings: $settings) {
      id
      name
      description
      settings {
        locals
        enable_revision_history
        system_graphql_hooks
        default_storage_plugin
        default_function_plugin
        default_locale
      }
    }
  }
`;

const UPSERT_ROLE = `
  mutation UpsertRoleToProject(
    $name: String!
    $is_admin: Boolean
    $logic_executions: [String]
    $api_permissions: JSON
  ) {
    upsertRoleToProject(
      name: $name
      is_admin: $is_admin
      logic_executions: $logic_executions
      api_permissions: $api_permissions
    ) {
      administrative_permissions
      api_permissions
      is_admin
      logic_executions
      system_generated
    }
  }
`;

const DUPLICATE_ROLE = `
  mutation DuplicateRoleInProject($source_role: String!, $new_name: String!) {
    duplicateRoleInProject(source_role: $source_role, new_name: $new_name) {
      administrative_permissions
      api_permissions
      is_admin
      logic_executions
      system_generated
    }
  }
`;

const DELETE_ROLE = `
  mutation DeleteRoleFromProject($role: String!) {
    deleteRoleFromProject(role: $role) {
      message
    }
  }
`;

const GET_PROJECT_PLANS = `
  query GetProjectPlans {
    getProjectPlans {
      id
      name
      description
      api_permissions
      logic_executions
      quotas
      system_generated
      currency
      price_monthly
      play_product_id
      play_base_plan_id
      paddle_price_id
      prices
      provider_products
    }
  }
`;

const UPSERT_PLAN = `
  mutation UpsertPlanToProject(
    $id: String!
    $name: String
    $description: String
    $api_permissions: JSON
    $logic_executions: [String]
    $quotas: JSON
    $currency: String
    $price_monthly: Float
    $play_product_id: String
    $play_base_plan_id: String
    $paddle_price_id: String
    $prices: JSON
    $provider_products: JSON
  ) {
    upsertPlanToProject(
      id: $id
      name: $name
      description: $description
      api_permissions: $api_permissions
      logic_executions: $logic_executions
      quotas: $quotas
      currency: $currency
      price_monthly: $price_monthly
      play_product_id: $play_product_id
      play_base_plan_id: $play_base_plan_id
      paddle_price_id: $paddle_price_id
      prices: $prices
      provider_products: $provider_products
    ) {
      id
      name
      description
      api_permissions
      logic_executions
      quotas
      system_generated
      currency
      price_monthly
      play_product_id
      play_base_plan_id
      paddle_price_id
      prices
      provider_products
    }
  }
`;

const LIST_API_KEYS = `
  query ListApiKeys {
    currentProject {
      id
      project_secret_key
      tokens {
        name
        token
        role
        expire
      }
    }
  }
`;

const GENERATE_API_KEY = `
  mutation GenerateProjectToken($name: String!, $duration: String!, $role: String!) {
    generateProjectToken(name: $name, duration: $duration, role: $role) {
      token
    }
  }
`;

const DELETE_API_KEY = `
  mutation DeleteProjectToken($duration: String!, $token: String!) {
    deleteProjectToken(duration: $duration, token: $token) {
      msg
    }
  }
`;

const GET_AUTH_SETTINGS = `
  query GetProjectAuthentication($_id: String = "") {
    getProject(_id: $_id) {
      authentication_settings {
        enable_general_auth
        enable_google_auth
        enable_facebook_auth
        enable_github_auth
        enable_x_auth
        enable_linkedin_auth
        general_authentication_method
        google_client_id
        google_oauth_redirect_uri
        has_google_client_secret
        facebook_client_id
        facebook_oauth_redirect_uri
        has_facebook_client_secret
        github_client_id
        github_oauth_redirect_uri
        has_github_client_secret
        x_client_id
        x_oauth_redirect_uri
        has_x_client_secret
        linkedin_client_id
        linkedin_oauth_redirect_uri
        has_linkedin_client_secret
        default_registration_role
      }
    }
  }
`;

const UPDATE_AUTH_SETTINGS = `
  mutation UpdateProjectAuthenticationSettings($input: UpdateProjectAuthenticationInput!) {
    updateProjectAuthenticationSettings(input: $input) {
      authentication_settings {
        enable_general_auth
        enable_google_auth
        enable_facebook_auth
        enable_github_auth
        enable_x_auth
        enable_linkedin_auth
        general_authentication_method
        google_client_id
        google_oauth_redirect_uri
        has_google_client_secret
        facebook_client_id
        facebook_oauth_redirect_uri
        has_facebook_client_secret
        github_client_id
        github_oauth_redirect_uri
        has_github_client_secret
        x_client_id
        x_oauth_redirect_uri
        has_x_client_secret
        linkedin_client_id
        linkedin_oauth_redirect_uri
        has_linkedin_client_secret
        default_registration_role
      }
    }
  }
`;

const GET_STORAGE_SETTINGS = `
  query GetProjectStorage($_id: String = "") {
    getProject(_id: $_id) {
      storage_settings {
        use_free_cloud_storage
        endpoint
        region
        bucket
        access_key_id
        has_secret_access_key
        public_base_url
        force_path_style
      }
    }
  }
`;

const UPDATE_STORAGE_SETTINGS = `
  mutation UpdateProjectStorageSettings($input: UpdateProjectStorageInput!) {
    updateProjectStorageSettings(input: $input) {
      storage_settings {
        use_free_cloud_storage
        endpoint
        region
        bucket
        access_key_id
        has_secret_access_key
        public_base_url
        force_path_style
      }
    }
  }
`;

const LIST_TEAM_MEMBERS = `
  query ListTeamMembers {
    workspaceMembers {
      id
      first_name
      last_name
      email
      avatar
      grants {
        project_id
        project_name
        role
        permissions
        invite_status
        invite_expires_at
      }
    }
  }
`;

const INVITE_WORKSPACE_MEMBER = `
  mutation InviteWorkspaceMember(
    $email: String!
    $project_ids: [String!]!
    $administrative_permissions: [String]
    $make_admin: Boolean
  ) {
    inviteWorkspaceMember(
      email: $email
      project_ids: $project_ids
      administrative_permissions: $administrative_permissions
      make_admin: $make_admin
    )
  }
`;

const REMOVE_WORKSPACE_MEMBER = `
  mutation RemoveWorkspaceMember($user_id: String!, $project_id: String) {
    removeWorkspaceMember(user_id: $user_id, project_id: $project_id)
  }
`;

export async function listRoles(client: ApitoGraphQLClient, reqOpts?: GraphQLRequestOptions) {
  const result = await client.request<{ currentProject: { id: string; roles: unknown } }>(
    GET_PROJECT_ROLES,
    {},
    reqOpts
  );
  return result.currentProject;
}

export async function getPermissionsCatalog(client: ApitoGraphQLClient, reqOpts?: GraphQLRequestOptions) {
  return client.request<{ listPermissionsAndScopes: Record<string, unknown> }>(
    LIST_PERMISSIONS,
    {},
    reqOpts
  );
}

export async function getProjectSettings(client: ApitoGraphQLClient, reqOpts?: GraphQLRequestOptions) {
  const result = await client.request<{ currentProject: Record<string, unknown> }>(
    GET_PROJECT_SETTINGS,
    {},
    reqOpts
  );
  return result.currentProject;
}

export async function updateProjectSettings(
  client: ApitoGraphQLClient,
  args: { name?: string; description?: string; settings?: Record<string, unknown> },
  reqOpts?: GraphQLRequestOptions
) {
  const result = await client.request<{ updateProject: Record<string, unknown> }>(
    UPDATE_PROJECT_SETTINGS,
    args,
    reqOpts
  );
  return result.updateProject;
}

export async function upsertRole(
  client: ApitoGraphQLClient,
  args: {
    name: string;
    is_admin?: boolean;
    logic_executions?: string[];
    api_permissions?: Record<string, unknown>;
  },
  reqOpts?: GraphQLRequestOptions
): Promise<ProjectRole> {
  const result = await client.request<{ upsertRoleToProject: ProjectRole }>(UPSERT_ROLE, args, reqOpts);
  return result.upsertRoleToProject;
}

export async function duplicateRole(
  client: ApitoGraphQLClient,
  args: { source_role: string; new_name: string },
  reqOpts?: GraphQLRequestOptions
): Promise<ProjectRole> {
  const result = await client.request<{ duplicateRoleInProject: ProjectRole }>(
    DUPLICATE_ROLE,
    args,
    reqOpts
  );
  return result.duplicateRoleInProject;
}

export async function deleteRole(
  client: ApitoGraphQLClient,
  role: string,
  reqOpts?: GraphQLRequestOptions
): Promise<{ message?: string }> {
  const result = await client.request<{ deleteRoleFromProject: { message?: string } }>(
    DELETE_ROLE,
    { role },
    reqOpts
  );
  return result.deleteRoleFromProject;
}

export async function listPlans(
  client: ApitoGraphQLClient,
  reqOpts?: GraphQLRequestOptions
): Promise<ProjectPlan[]> {
  const result = await client.request<{ getProjectPlans: ProjectPlan[] | null }>(
    GET_PROJECT_PLANS,
    {},
    reqOpts
  );
  return result.getProjectPlans ?? [];
}

export async function upsertPlan(
  client: ApitoGraphQLClient,
  args: {
    id: string;
    name?: string;
    description?: string;
    api_permissions?: Record<string, unknown>;
    logic_executions?: string[];
    quotas?: Record<string, number>;
    currency?: string;
    price_monthly?: number;
    play_product_id?: string;
    play_base_plan_id?: string;
    paddle_price_id?: string;
    prices?: Array<{ currency: string; amount: number; default?: boolean }>;
    provider_products?: Array<{ provider: string; product_id: string; variant_id?: string }>;
  },
  reqOpts?: GraphQLRequestOptions
): Promise<ProjectPlan> {
  const result = await client.request<{ upsertPlanToProject: ProjectPlan }>(
    UPSERT_PLAN,
    args,
    reqOpts
  );
  return result.upsertPlanToProject;
}

const DELETE_PLAN = `
  mutation DeletePlanFromProject($id: String!) {
    deletePlanFromProject(id: $id) {
      id
      name
    }
  }
`;

export async function deletePlan(
  client: ApitoGraphQLClient,
  id: string,
  reqOpts?: GraphQLRequestOptions
): Promise<ProjectPlan[]> {
  const result = await client.request<{ deletePlanFromProject: ProjectPlan[] | null }>(
    DELETE_PLAN,
    { id },
    reqOpts
  );
  return result.deletePlanFromProject ?? [];
}

export async function listApiKeys(client: ApitoGraphQLClient, reqOpts?: GraphQLRequestOptions) {
  const result = await client.request<{
    currentProject: { id: string; project_secret_key?: string; tokens?: unknown[] };
  }>(LIST_API_KEYS, {}, reqOpts);
  return result.currentProject;
}

export async function createApiKey(
  client: ApitoGraphQLClient,
  args: { name: string; duration: string; role: string },
  reqOpts?: GraphQLRequestOptions
): Promise<{ token: string }> {
  const result = await client.request<{ generateProjectToken: { token: string } }>(
    GENERATE_API_KEY,
    args,
    reqOpts
  );
  return result.generateProjectToken;
}

export async function deleteApiKey(
  client: ApitoGraphQLClient,
  args: { duration: string; token: string },
  reqOpts?: GraphQLRequestOptions
): Promise<{ msg?: string }> {
  const result = await client.request<{ deleteProjectToken: { msg?: string } }>(
    DELETE_API_KEY,
    args,
    reqOpts
  );
  return result.deleteProjectToken;
}

export async function getAuthSettings(
  client: ApitoGraphQLClient,
  projectId?: string,
  reqOpts?: GraphQLRequestOptions
) {
  const result = await client.request<{
    getProject: { authentication_settings: Record<string, unknown> };
  }>(GET_AUTH_SETTINGS, { _id: projectId ?? '' }, reqOpts);
  return result.getProject?.authentication_settings;
}

export async function updateAuthSettings(
  client: ApitoGraphQLClient,
  input: Record<string, unknown>,
  reqOpts?: GraphQLRequestOptions
) {
  const result = await client.request<{
    updateProjectAuthenticationSettings: { authentication_settings: Record<string, unknown> };
  }>(UPDATE_AUTH_SETTINGS, { input }, reqOpts);
  return result.updateProjectAuthenticationSettings?.authentication_settings;
}

export async function getStorageSettings(
  client: ApitoGraphQLClient,
  projectId?: string,
  reqOpts?: GraphQLRequestOptions
) {
  const result = await client.request<{
    getProject: { storage_settings: Record<string, unknown> };
  }>(GET_STORAGE_SETTINGS, { _id: projectId ?? '' }, reqOpts);
  return result.getProject?.storage_settings;
}

export async function updateStorageSettings(
  client: ApitoGraphQLClient,
  input: Record<string, unknown>,
  reqOpts?: GraphQLRequestOptions
) {
  const result = await client.request<{
    updateProjectStorageSettings: { storage_settings: Record<string, unknown> };
  }>(UPDATE_STORAGE_SETTINGS, { input }, reqOpts);
  return result.updateProjectStorageSettings?.storage_settings;
}

export async function listTeamMembers(client: ApitoGraphQLClient, reqOpts?: GraphQLRequestOptions) {
  const result = await client.request<{ workspaceMembers: unknown[] }>(LIST_TEAM_MEMBERS, {}, reqOpts);
  return result.workspaceMembers ?? [];
}

export async function updateTeamMembers(
  client: ApitoGraphQLClient,
  args: {
    email?: string;
    project_ids?: string[];
    administrative_permissions?: string[];
    make_admin?: boolean;
    user_id?: string;
    project_id?: string;
  },
  reqOpts?: GraphQLRequestOptions
) {
  if (args.user_id) {
    const result = await client.request<{ removeWorkspaceMember: boolean }>(
      REMOVE_WORKSPACE_MEMBER,
      { user_id: args.user_id, project_id: args.project_id },
      reqOpts
    );
    return result.removeWorkspaceMember;
  }
  if (!args.email || !args.project_ids?.length) {
    throw new Error('invite requires email and project_ids; remove requires user_id');
  }
  const result = await client.request<{ inviteWorkspaceMember: boolean }>(
    INVITE_WORKSPACE_MEMBER,
    {
      email: args.email,
      project_ids: args.project_ids,
      administrative_permissions: args.administrative_permissions,
      make_admin: args.make_admin,
    },
    reqOpts
  );
  return result.inviteWorkspaceMember;
}

const SCHEMA_VERSIONS = `
  query SchemaVersions($limit: Int, $offset: Int) {
    schemaVersions(limit: $limit, offset: $offset) {
      version
      published_at
      published_by
      message
      changeset_id
    }
  }
`;

const SCHEMA_CHANGE_EVENTS = `
  query SchemaChangeEvents($changeset_id: String) {
    schemaChangeEvents(changeset_id: $changeset_id) {
      event_type
      actor_id
      created_at
      payload_json
    }
  }
`;

const DISCARD_SCHEMA_DRAFT = `
  mutation DiscardSchemaDraft($changeset_id: String!) {
    discardSchemaDraft(changeset_id: $changeset_id)
  }
`;

export async function listSchemaVersions(
  client: ApitoGraphQLClient,
  args: { limit?: number; offset?: number } = {},
  reqOpts?: GraphQLRequestOptions
): Promise<SchemaVersionItem[]> {
  const result = await client.request<{ schemaVersions: SchemaVersionItem[] }>(
    SCHEMA_VERSIONS,
    args,
    reqOpts
  );
  return result.schemaVersions ?? [];
}

export async function listSchemaChangeEvents(
  client: ApitoGraphQLClient,
  changesetId?: string,
  reqOpts?: GraphQLRequestOptions
): Promise<SchemaChangeEventItem[]> {
  const variables: Record<string, unknown> = {};
  if (changesetId) {
    variables.changeset_id = changesetId;
  }
  const result = await client.request<{ schemaChangeEvents: SchemaChangeEventItem[] }>(
    SCHEMA_CHANGE_EVENTS,
    variables,
    reqOpts
  );
  return result.schemaChangeEvents ?? [];
}

export async function discardSchemaDraft(
  client: ApitoGraphQLClient,
  changesetId: string,
  reqOpts?: GraphQLRequestOptions
): Promise<boolean> {
  const result = await client.request<{ discardSchemaDraft: boolean }>(
    DISCARD_SCHEMA_DRAFT,
    { changeset_id: changesetId },
    reqOpts
  );
  return result.discardSchemaDraft;
}
