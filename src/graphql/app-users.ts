import type { ApitoGraphQLClient, GraphQLRequestOptions } from '../graphql-client.js';
import type { AppUserItem, LoginAppUserPayload } from '../types.js';

const SEARCH_USERS = `
  query SearchUsers($project_id: String!, $limit: Int, $offset: Int, $tenant_id: String) {
    searchUsers(project_id: $project_id, limit: $limit, offset: $offset, tenant_id: $tenant_id) {
      count
      users {
        id
        email
        username
        phone
        role
        provider
        tenant_id
        status
        created_at
        updated_at
      }
    }
  }
`;

const CREATE_USER = `
  mutation CreateUser(
    $project_id: String!
    $password: String!
    $email: String
    $phone: String
    $role: String
    $username: String
    $tenant_id: String
  ) {
    createUser(
      project_id: $project_id
      password: $password
      email: $email
      phone: $phone
      role: $role
      username: $username
      tenant_id: $tenant_id
    ) {
      id
      email
      username
      phone
      role
      provider
      tenant_id
      status
      created_at
      updated_at
    }
  }
`;

const UPDATE_USER = `
  mutation UpdateUser(
    $user_id: String!
    $email: String
    $phone: String
    $role: String
    $username: String
    $tenant_id: String
  ) {
    updateUser(
      user_id: $user_id
      email: $email
      phone: $phone
      role: $role
      username: $username
      tenant_id: $tenant_id
    ) {
      id
      email
      username
      phone
      role
      provider
      tenant_id
      status
      created_at
      updated_at
    }
  }
`;

const DELETE_USER = `
  mutation DeleteUser($user_id: String!) {
    deleteUser(user_id: $user_id)
  }
`;

const RESET_USER_PASSWORD = `
  mutation ResetUserPassword($user_id: String!, $password: String!) {
    resetUserPassword(user_id: $user_id, password: $password)
  }
`;

const LOGIN_USER = `
  query LoginUser(
    $project_id: String!
    $tenant_id: String
    $auth_method: String
    $email: String
    $phone: String
    $password: String
    $code: String
    $state: String
    $id_token: String
  ) {
    loginUser(
      project_id: $project_id
      tenant_id: $tenant_id
      auth_method: $auth_method
      email: $email
      phone: $phone
      password: $password
      code: $code
      state: $state
      id_token: $id_token
    ) {
      token
      user {
        id
        email
        username
        phone
        role
        provider
        tenant_id
        status
      }
    }
  }
`;

const GOOGLE_OAUTH_STATE = `
  query GoogleOAuthState($project_id: String!) {
    googleOAuthState(project_id: $project_id) {
      state
    }
  }
`;

export async function searchAppUsers(
  client: ApitoGraphQLClient,
  args: { project_id: string; limit?: number; offset?: number; tenant_id?: string },
  reqOpts?: GraphQLRequestOptions
): Promise<{ count: number; users: AppUserItem[] }> {
  const result = await client.request<{
    searchUsers: { count: number; users: AppUserItem[] };
  }>(SEARCH_USERS, args, reqOpts);
  return result.searchUsers;
}

export async function createAppUser(
  client: ApitoGraphQLClient,
  args: {
    project_id: string;
    password: string;
    email?: string;
    phone?: string;
    role?: string;
    username?: string;
    tenant_id?: string;
  },
  reqOpts?: GraphQLRequestOptions
): Promise<AppUserItem> {
  const result = await client.request<{ createUser: AppUserItem }>(CREATE_USER, args, reqOpts);
  return result.createUser;
}

export async function updateAppUser(
  client: ApitoGraphQLClient,
  args: {
    user_id: string;
    email?: string;
    phone?: string;
    role?: string;
    username?: string;
    tenant_id?: string;
  },
  reqOpts?: GraphQLRequestOptions
): Promise<AppUserItem> {
  const result = await client.request<{ updateUser: AppUserItem }>(UPDATE_USER, args, reqOpts);
  return result.updateUser;
}

export async function deleteAppUser(
  client: ApitoGraphQLClient,
  userId: string,
  reqOpts?: GraphQLRequestOptions
): Promise<boolean> {
  const result = await client.request<{ deleteUser: boolean }>(
    DELETE_USER,
    { user_id: userId },
    reqOpts
  );
  return result.deleteUser;
}

export async function resetAppUserPassword(
  client: ApitoGraphQLClient,
  args: { user_id: string; password: string },
  reqOpts?: GraphQLRequestOptions
): Promise<boolean> {
  const result = await client.request<{ resetUserPassword: boolean }>(
    RESET_USER_PASSWORD,
    args,
    reqOpts
  );
  return result.resetUserPassword;
}

export async function loginAppUser(
  client: ApitoGraphQLClient,
  args: {
    project_id: string;
    tenant_id?: string;
    auth_method?: string;
    email?: string;
    phone?: string;
    password?: string;
    code?: string;
    state?: string;
    id_token?: string;
  },
  reqOpts?: GraphQLRequestOptions
): Promise<LoginAppUserPayload> {
  const result = await client.request<{ loginUser: LoginAppUserPayload }>(LOGIN_USER, args, reqOpts);
  return result.loginUser;
}

export async function googleOAuthState(
  client: ApitoGraphQLClient,
  projectId: string,
  reqOpts?: GraphQLRequestOptions
): Promise<string> {
  const result = await client.request<{ googleOAuthState: { state: string } }>(
    GOOGLE_OAUTH_STATE,
    { project_id: projectId },
    reqOpts
  );
  return result.googleOAuthState.state;
}

export function reqOptsFromTenantId(tenantId?: string): GraphQLRequestOptions | undefined {
  const tid = tenantId?.trim();
  return tid ? { tenantId: tid } : undefined;
}

export const SENSITIVE_TOKEN_WARNING =
  '**Sensitive:** The returned token is a project/tenant user JWT. Do not log or commit it. Use on public /secured/graphql as Bearer token.';
