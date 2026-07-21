import type { ApitoGraphQLClient, GraphQLRequestOptions } from '../graphql-client.js';

/**
 * Logic Functions lifecycle GraphQL helpers (system API).
 *
 * Mirrors the Console documents in
 * `apito-console-v4/open-core/src/graphql/{mutations,queries}/functions.ts`.
 * Reuses the engine ops shipped in open-core — no new engine GraphQL.
 */

const LIST_FUNCTIONS = `
  query ListAllFunctionInfo {
    projectFunctionsInfo {
      name
      description
      graphql_schema_type
      created_at
      updated_at
      trigger_type
      source
      active_revision_id
      capabilities
      function_connected
      function_provider_id
      request {
        model
        optional_payload
      }
      response {
        model
        is_array
      }
      runtime_config {
        handler
        memory
        runtime
        time_out
      }
      env_vars {
        key
        value
      }
      rest_api_secret_url_key
    }
  }
`;

const UPSERT_FUNCTION = `
  mutation UpsertFunctionToProject(
    $name: String!
    $description: String
    $function_connected: Boolean
    $function_provider_id: String
    $provider_exported_variable: String
    $function_exported_variable: String
    $graphql_schema_type: String
    $function_path: String
    $runtime_config: Function_Provider_Config_Payload
    $env_vars: [Function_Provider_Env_Vars_Payload]
    $request: String
    $request_payload_is_optional: Boolean
    $response: String
    $response_is_array: Boolean
    $update: Boolean
    $source: String
    $trigger_type: String
    $language: String
    $capabilities: [String]
  ) {
    upsertFunctionToProject(
      name: $name
      description: $description
      function_connected: $function_connected
      function_provider_id: $function_provider_id
      provider_exported_variable: $provider_exported_variable
      function_exported_variable: $function_exported_variable
      function_path: $function_path
      graphql_schema_type: $graphql_schema_type
      runtime_config: $runtime_config
      env_vars: $env_vars
      request: $request
      request_payload_is_optional: $request_payload_is_optional
      response: $response
      response_is_array: $response_is_array
      update: $update
      source: $source
      trigger_type: $trigger_type
      language: $language
      capabilities: $capabilities
    ) {
      name
      description
      graphql_schema_type
      created_at
      updated_at
      trigger_type
      source
      active_revision_id
      capabilities
      function_connected
      provider_exported_variable
      function_exported_variable
      function_provider_id
      request {
        model
        optional_payload
      }
      response {
        model
        is_array
      }
      runtime_config {
        handler
        memory
        runtime
        time_out
      }
      env_vars {
        key
        value
      }
      rest_api_secret_url_key
    }
  }
`;

const DELETE_FUNCTION = `
  mutation DeleteFunctionFromProject($function: String!) {
    deleteFunctionFromProject(function: $function) {
      id
      name
    }
  }
`;

const TEST_FUNCTION_DRAFT = `
  mutation TestFunctionDraft(
    $name: String!
    $source: String
    $payload: JSON
    $tenant_id: String
  ) {
    testFunctionDraft(
      name: $name
      source: $source
      payload: $payload
      tenant_id: $tenant_id
    ) {
      ok
      response
      error
      error_class
      duration_ms
      invocation_id
      logs {
        level
        message
      }
    }
  }
`;

const DEPLOY_FUNCTION = `
  mutation DeployFunctionToProject($name: String!, $source: String) {
    deployFunctionToProject(name: $name, source: $source) {
      function {
        name
        source
        active_revision_id
        rest_api_secret_url_key
        updated_at
      }
      revision {
        id
        revision
        artifact_key
        artifact_hash
        created_at
      }
      deployment {
        id
        revision_id
        status
        created_at
      }
    }
  }
`;

const ROLLBACK_FUNCTION = `
  mutation RollbackFunctionDeployment($name: String!, $revision_id: String!) {
    rollbackFunctionDeployment(name: $name, revision_id: $revision_id) {
      function {
        name
        source
        active_revision_id
        updated_at
      }
      revision {
        id
        artifact_key
        created_at
      }
      deployment {
        id
        revision_id
        status
        rollback_of
        created_at
      }
    }
  }
`;

const LIST_FUNCTION_REVISIONS = `
  query ListFunctionRevisions($name: String!, $limit: Int) {
    listFunctionRevisions(name: $name, limit: $limit) {
      id
      name
      revision
      source
      artifact_key
      artifact_hash
      created_by
      created_at
      capabilities
    }
  }
`;

const LIST_FUNCTION_DEPLOYMENTS = `
  query ListFunctionDeployments($name: String!, $limit: Int) {
    listFunctionDeployments(name: $name, limit: $limit) {
      id
      name
      revision_id
      status
      deployed_by
      rollback_of
      created_at
      environment
    }
  }
`;

/** Runtime config accepted by upsertFunctionToProject (Function_Provider_Config_Payload). */
export type FunctionRuntimeConfig = {
  handler?: string;
  memory?: number;
  runtime?: string;
  time_out?: number;
};

export type UpsertFunctionArgs = {
  name: string;
  description?: string;
  source?: string;
  capabilities?: string[];
  language?: string;
  trigger_type?: string;
  graphql_schema_type?: string;
  runtime_config?: FunctionRuntimeConfig;
  env_vars?: Array<{ key: string; value: string }>;
  request?: string;
  request_payload_is_optional?: boolean;
  response?: string;
  response_is_array?: boolean;
  function_connected?: boolean;
  function_provider_id?: string;
  provider_exported_variable?: string;
  function_exported_variable?: string;
  function_path?: string;
  update?: boolean;
};

export type TestFunctionDraftArgs = {
  name: string;
  source?: string;
  payload?: unknown;
  tenant_id?: string;
};

/** Row shape returned by projectFunctionsInfo (subset consumers rely on). */
export type FunctionInfoRow = {
  name: string;
  description?: string;
  source?: string;
  active_revision_id?: string;
  capabilities?: string[];
  trigger_type?: string;
  rest_api_secret_url_key?: string;
  [key: string]: unknown;
};

export async function listFunctions(
  client: ApitoGraphQLClient,
  filter?: { name?: string },
  reqOpts?: GraphQLRequestOptions
): Promise<FunctionInfoRow[]> {
  const result = await client.request<{ projectFunctionsInfo: FunctionInfoRow[] }>(
    LIST_FUNCTIONS,
    {},
    reqOpts
  );
  const rows = result.projectFunctionsInfo ?? [];
  const name = filter?.name?.trim();
  return name ? rows.filter((r) => r.name === name) : rows;
}

/** Find a single function row by name (used to resolve the REST secret for execute). */
export async function findFunction(
  client: ApitoGraphQLClient,
  name: string,
  reqOpts?: GraphQLRequestOptions
): Promise<FunctionInfoRow | undefined> {
  const rows = await listFunctions(client, { name }, reqOpts);
  return rows[0];
}

export async function upsertFunction(
  client: ApitoGraphQLClient,
  args: UpsertFunctionArgs,
  reqOpts?: GraphQLRequestOptions
) {
  const variables: Record<string, unknown> = { name: args.name };
  const assign = (key: keyof UpsertFunctionArgs) => {
    if (args[key] !== undefined) variables[key] = args[key];
  };
  assign('description');
  assign('source');
  assign('capabilities');
  assign('language');
  assign('trigger_type');
  assign('graphql_schema_type');
  assign('runtime_config');
  assign('env_vars');
  assign('request');
  assign('request_payload_is_optional');
  assign('response');
  assign('response_is_array');
  assign('function_connected');
  assign('function_provider_id');
  assign('provider_exported_variable');
  assign('function_exported_variable');
  assign('function_path');
  assign('update');

  const result = await client.request<{ upsertFunctionToProject: unknown }>(
    UPSERT_FUNCTION,
    variables,
    reqOpts
  );
  return result.upsertFunctionToProject;
}

export async function deleteFunction(
  client: ApitoGraphQLClient,
  functionName: string,
  reqOpts?: GraphQLRequestOptions
) {
  const result = await client.request<{ deleteFunctionFromProject: unknown }>(
    DELETE_FUNCTION,
    { function: functionName },
    reqOpts
  );
  return result.deleteFunctionFromProject;
}

export async function testFunctionDraft(
  client: ApitoGraphQLClient,
  args: TestFunctionDraftArgs,
  reqOpts?: GraphQLRequestOptions
) {
  const variables: Record<string, unknown> = { name: args.name };
  if (args.source !== undefined) variables.source = args.source;
  if (args.payload !== undefined) variables.payload = args.payload;
  if (args.tenant_id !== undefined) variables.tenant_id = args.tenant_id;

  const result = await client.request<{ testFunctionDraft: unknown }>(
    TEST_FUNCTION_DRAFT,
    variables,
    reqOpts
  );
  return result.testFunctionDraft;
}

export async function deployFunction(
  client: ApitoGraphQLClient,
  args: { name: string; source?: string },
  reqOpts?: GraphQLRequestOptions
) {
  const variables: Record<string, unknown> = { name: args.name };
  if (args.source !== undefined) variables.source = args.source;

  const result = await client.request<{ deployFunctionToProject: unknown }>(
    DEPLOY_FUNCTION,
    variables,
    reqOpts
  );
  return result.deployFunctionToProject;
}

export async function rollbackFunction(
  client: ApitoGraphQLClient,
  args: { name: string; revision_id: string },
  reqOpts?: GraphQLRequestOptions
) {
  const result = await client.request<{ rollbackFunctionDeployment: unknown }>(
    ROLLBACK_FUNCTION,
    { name: args.name, revision_id: args.revision_id },
    reqOpts
  );
  return result.rollbackFunctionDeployment;
}

export async function listFunctionRevisions(
  client: ApitoGraphQLClient,
  args: { name: string; limit?: number },
  reqOpts?: GraphQLRequestOptions
) {
  const variables: Record<string, unknown> = { name: args.name };
  if (args.limit !== undefined) variables.limit = args.limit;
  const result = await client.request<{ listFunctionRevisions: unknown[] }>(
    LIST_FUNCTION_REVISIONS,
    variables,
    reqOpts
  );
  return result.listFunctionRevisions ?? [];
}

export async function listFunctionDeployments(
  client: ApitoGraphQLClient,
  args: { name: string; limit?: number },
  reqOpts?: GraphQLRequestOptions
) {
  const variables: Record<string, unknown> = { name: args.name };
  if (args.limit !== undefined) variables.limit = args.limit;
  const result = await client.request<{ listFunctionDeployments: unknown[] }>(
    LIST_FUNCTION_DEPLOYMENTS,
    variables,
    reqOpts
  );
  return result.listFunctionDeployments ?? [];
}
