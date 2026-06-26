import type { ApitoGraphQLClient, GraphQLRequestOptions } from '../graphql-client.js';

const LIST_WEBHOOKS = `
  query ListWebHooks {
    listWebHooks {
      _key
      events
      id
      model
      name
      type
      url
      logic_executions
    }
  }
`;

const CREATE_WEBHOOK = `
  mutation CreateWebHook(
    $events: [String]!
    $model: String!
    $name: String!
    $url: String!
    $logic_executions: [String]
  ) {
    createWebHook(
      events: $events
      model: $model
      name: $name
      url: $url
      logic_executions: $logic_executions
    ) {
      _key
      events
      id
      model
      name
      type
      url
      logic_executions
    }
  }
`;

const DELETE_WEBHOOK = `
  mutation DeleteWebHook($id: String!) {
    deleteWebHook(id: $id) {
      msg
    }
  }
`;

const LIST_PROJECT_PLUGINS = `
  query ListProjectPlugins($type: PLUGIN_TYPE_ENUM!) {
    getProjectSpecificInstalledPlugins(type: $type) {
      author
      branch
      description
      enable
      id
      load_status
      activate_status
      title
      type
      version
    }
  }
`;

const UPSERT_PLUGIN = `
  mutation UpsertPlugin(
    $id: String!
    $env_vars: [PluginConfigEnvVarsPayload]
    $enable: Boolean
    $activate_status: PLUGIN_ACTIVATION_TYPE_ENUM
  ) {
    upsertPlugin(
      id: $id
      env_vars: $env_vars
      enable: $enable
      activate_status: $activate_status
    ) {
      id
      title
      enable
      activate_status
      load_status
      type
      version
    }
  }
`;

const REMOVE_PLUGIN = `
  mutation RemoveProjectPlugin($id: String!) {
    removeProjectSpecificPlugin(id: $id) {
      message
    }
  }
`;

const LIST_FUNCTIONS = `
  query ListAllFunctionInfo {
    projectFunctionsInfo {
      name
      description
      graphql_schema_type
      function_connected
      function_provider_id
      created_at
      updated_at
    }
  }
`;

const UPSERT_FUNCTION = `
  mutation UpsertFunctionToProject(
    $name: String!
    $description: String
    $function_connected: Boolean
    $function_provider_id: String
    $update: Boolean
  ) {
    upsertFunctionToProject(
      name: $name
      description: $description
      function_connected: $function_connected
      function_provider_id: $function_provider_id
      update: $update
    ) {
      name
      description
      graphql_schema_type
      function_connected
      function_provider_id
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

const LIST_MEDIA = `
  query ListMedia($limit: Int, $page: Int, $search: String) {
    listAllDataOfAMedia(limit: $limit, page: $page, search: $search) {
      count
      results {
        id
        file_name
        file_size
        file_type
        url
        created_at
      }
    }
  }
`;

const UPLOAD_MEDIA_FROM_URL = `
  mutation UploadImageFromUrl($url: String!) {
    uploadImageFromURL(url: $url) {
      id
      url
    }
  }
`;

const DELETE_MEDIA = `
  mutation DeleteMediaFile($ids: [String]!) {
    deleteMediaFile(ids: $ids) {
      msg
    }
  }
`;

export async function listWebhooks(client: ApitoGraphQLClient, reqOpts?: GraphQLRequestOptions) {
  const result = await client.request<{ listWebHooks: unknown[] }>(LIST_WEBHOOKS, {}, reqOpts);
  return result.listWebHooks ?? [];
}

export async function createWebhook(
  client: ApitoGraphQLClient,
  args: {
    events: string[];
    model: string;
    name: string;
    url: string;
    logic_executions?: string[];
  },
  reqOpts?: GraphQLRequestOptions
) {
  const result = await client.request<{ createWebHook: unknown }>(CREATE_WEBHOOK, args, reqOpts);
  return result.createWebHook;
}

export async function deleteWebhook(
  client: ApitoGraphQLClient,
  id: string,
  reqOpts?: GraphQLRequestOptions
) {
  const result = await client.request<{ deleteWebHook: { msg?: string } }>(
    DELETE_WEBHOOK,
    { id },
    reqOpts
  );
  return result.deleteWebHook;
}

export async function listPlugins(
  client: ApitoGraphQLClient,
  pluginType: string,
  reqOpts?: GraphQLRequestOptions
) {
  const result = await client.request<{ getProjectSpecificInstalledPlugins: unknown[] }>(
    LIST_PROJECT_PLUGINS,
    { type: pluginType },
    reqOpts
  );
  return result.getProjectSpecificInstalledPlugins ?? [];
}

export async function configurePlugin(
  client: ApitoGraphQLClient,
  args: {
    id: string;
    env_vars?: Array<{ key: string; value: string }>;
    enable?: boolean;
    activate_status?: string;
  },
  reqOpts?: GraphQLRequestOptions
) {
  const result = await client.request<{ upsertPlugin: unknown }>(UPSERT_PLUGIN, args, reqOpts);
  return result.upsertPlugin;
}

export async function removePlugin(
  client: ApitoGraphQLClient,
  id: string,
  reqOpts?: GraphQLRequestOptions
) {
  const result = await client.request<{ removeProjectSpecificPlugin: { message?: string } }>(
    REMOVE_PLUGIN,
    { id },
    reqOpts
  );
  return result.removeProjectSpecificPlugin;
}

export async function listFunctions(client: ApitoGraphQLClient, reqOpts?: GraphQLRequestOptions) {
  const result = await client.request<{ projectFunctionsInfo: unknown[] }>(
    LIST_FUNCTIONS,
    {},
    reqOpts
  );
  return result.projectFunctionsInfo ?? [];
}

export async function upsertFunction(
  client: ApitoGraphQLClient,
  args: {
    name: string;
    description?: string;
    function_connected?: boolean;
    function_provider_id?: string;
    update?: boolean;
  },
  reqOpts?: GraphQLRequestOptions
) {
  const result = await client.request<{ upsertFunctionToProject: unknown }>(
    UPSERT_FUNCTION,
    args,
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

export async function listMedia(
  client: ApitoGraphQLClient,
  args: { limit?: number; page?: number; search?: string } = {},
  reqOpts?: GraphQLRequestOptions
) {
  const result = await client.request<{ listAllDataOfAMedia: { count: number; results: unknown[] } }>(
    LIST_MEDIA,
    args,
    reqOpts
  );
  return result.listAllDataOfAMedia;
}

export async function uploadMediaFromUrl(
  client: ApitoGraphQLClient,
  url: string,
  reqOpts?: GraphQLRequestOptions
) {
  const result = await client.request<{ uploadImageFromURL: unknown }>(
    UPLOAD_MEDIA_FROM_URL,
    { url },
    reqOpts
  );
  return result.uploadImageFromURL;
}

export async function deleteMedia(
  client: ApitoGraphQLClient,
  ids: string[],
  reqOpts?: GraphQLRequestOptions
) {
  const result = await client.request<{ deleteMediaFile: { msg?: string } }>(
    DELETE_MEDIA,
    { ids },
    reqOpts
  );
  return result.deleteMediaFile;
}
