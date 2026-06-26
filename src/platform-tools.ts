import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export type PlatformTool = Tool & { proOnly?: boolean };

const TENANT_ID_PARAM = {
  type: 'string',
  description: 'SaaS tenant ID for this request (also sent as X-Apito-Tenant-ID). Overrides TENANT_ID env.',
} as const;

const PROJECT_ID_PARAM = {
  type: 'string',
  description: 'Project ID (required for cross-project API keys; optional when key is project-scoped).',
} as const;

export const PLATFORM_TOOL_DEFINITIONS: PlatformTool[] = [
  // --- Tenants [pro] ---
  {
    name: 'list_tenants',
    proOnly: true,
    description: '[pro] List SaaS tenant catalog rows for the current project (getTenants).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'create_tenant',
    proOnly: true,
    description: '[pro] Create a tenant catalog row (createTenant). Provisions tenant DB when per-tenant separate DB is enabled.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Tenant display name' },
        data: { type: 'string', description: 'Optional JSON string stored on catalog row' },
        domain: { type: 'string', description: 'Optional hostname for domain-based tenant lookup' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_tenant',
    proOnly: true,
    description: '[pro] Update tenant catalog row (updateTenant).',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        name: { type: 'string' },
        data: { type: 'string' },
        domain: { type: 'string' },
      },
      required: ['tenant_id'],
    },
  },
  {
    name: 'delete_tenant',
    proOnly: true,
    description: '[pro] Delete/deactivate tenant catalog row (deleteTenant).',
    inputSchema: {
      type: 'object',
      properties: { tenant_id: { type: 'string' } },
      required: ['tenant_id'],
    },
  },
  {
    name: 'generate_tenant_token',
    proOnly: true,
    description: '[pro] Mint tenant-scoped API token (generateTenantToken). Sensitive — treat like a secret.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        duration: { type: 'string', description: 'Expiry date YYYY-MM-DD' },
        role: { type: 'string', description: 'Defaults to admin' },
      },
      required: ['tenant_id', 'duration'],
    },
  },
  {
    name: 'search_tenant_by_domain',
    proOnly: true,
    description: '[pro] Resolve tenant by domain hostname (searchTenantsByDomain).',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: PROJECT_ID_PARAM,
        domain: { type: 'string' },
      },
      required: ['project_id', 'domain'],
    },
  },
  // --- App users ---
  {
    name: 'search_app_users',
    description: '[core/pro] Search project app end-users (searchUsers). SaaS: pass tenant_id.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: PROJECT_ID_PARAM,
        limit: { type: 'number' },
        offset: { type: 'number' },
        tenant_id: TENANT_ID_PARAM,
      },
      required: ['project_id'],
    },
  },
  {
    name: 'create_app_user',
    description: '[core/pro] Create app end-user (createUser). Password required.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: PROJECT_ID_PARAM,
        password: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        role: { type: 'string' },
        username: { type: 'string' },
        tenant_id: TENANT_ID_PARAM,
      },
      required: ['project_id', 'password'],
    },
  },
  {
    name: 'update_app_user',
    description: '[core/pro] Update app end-user (updateUser).',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        role: { type: 'string' },
        username: { type: 'string' },
        tenant_id: TENANT_ID_PARAM,
      },
      required: ['user_id'],
    },
  },
  {
    name: 'delete_app_user',
    description: '[core/pro] Delete app end-user (deleteUser).',
    inputSchema: {
      type: 'object',
      properties: { user_id: { type: 'string' } },
      required: ['user_id'],
    },
  },
  {
    name: 'reset_app_user_password',
    description: '[core/pro] Reset app end-user password (resetUserPassword).',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        password: { type: 'string' },
      },
      required: ['user_id', 'password'],
    },
  },
  {
    name: 'login_app_user',
    description:
      '[core/pro] Test login as app end-user (loginUser). Returns sensitive JWT. See resource apito://saas-auth-guide.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: PROJECT_ID_PARAM,
        tenant_id: TENANT_ID_PARAM,
        email: { type: 'string' },
        phone: { type: 'string' },
        password: { type: 'string' },
      },
      required: ['project_id', 'password'],
    },
  },
  {
    name: 'google_oauth_state',
    description: '[core/pro] Get Google OAuth state for login flow (googleOAuthState).',
    inputSchema: {
      type: 'object',
      properties: { project_id: PROJECT_ID_PARAM },
      required: ['project_id'],
    },
  },
  {
    name: 'login_app_user_google',
    description:
      '[core/pro] Complete Google login (loginUser auth_method=google). Pass code+state or id_token. See apito://saas-auth-guide.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: PROJECT_ID_PARAM,
        tenant_id: TENANT_ID_PARAM,
        code: { type: 'string' },
        state: { type: 'string' },
        id_token: { type: 'string' },
      },
      required: ['project_id'],
    },
  },
  // --- Schema versioning read / safe write ---
  {
    name: 'get_schema_diff',
    proOnly: true,
    description: '[pro] Read schema diff JSON for a changeset (schemaDiff). Does not publish.',
    inputSchema: {
      type: 'object',
      properties: { changeset_id: { type: 'string' } },
    },
  },
  {
    name: 'list_schema_versions',
    proOnly: true,
    description: '[pro] List published schema versions (schemaVersions).',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number' }, offset: { type: 'number' } },
    },
  },
  {
    name: 'list_schema_change_events',
    proOnly: true,
    description: '[pro] Audit events for a schema changeset (schemaChangeEvents).',
    inputSchema: {
      type: 'object',
      properties: { changeset_id: { type: 'string' } },
    },
  },
  {
    name: 'discard_schema_draft',
    proOnly: true,
    description:
      '[pro] Discard unstaged schema draft (discardSchemaDraft). Does NOT publish. Safer than approveSchemaChanges.',
    inputSchema: {
      type: 'object',
      properties: { changeset_id: { type: 'string' } },
      required: ['changeset_id'],
    },
  },
  // --- Project admin ---
  {
    name: 'list_roles',
    description: '[core] List project roles from currentProject.roles.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_permissions_catalog',
    description: '[core] List available API permission keys (listPermissionsAndScopes).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'upsert_role',
    description: '[core] Create or update a project role (upsertRoleToProject).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        is_admin: { type: 'boolean' },
        logic_executions: { type: 'array', items: { type: 'string' } },
        api_permissions: { type: 'object', description: 'JSON map of model -> CRUD flags' },
      },
      required: ['name'],
    },
  },
  {
    name: 'duplicate_role',
    description: '[core] Duplicate a role (duplicateRoleInProject).',
    inputSchema: {
      type: 'object',
      properties: {
        source_role: { type: 'string' },
        new_name: { type: 'string' },
      },
      required: ['source_role', 'new_name'],
    },
  },
  {
    name: 'delete_role',
    description: '[core] Delete a role (deleteRoleFromProject).',
    inputSchema: {
      type: 'object',
      properties: { role: { type: 'string' } },
      required: ['role'],
    },
  },
  {
    name: 'get_project_settings',
    description: '[core] Read project name, description, settings, roles.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'update_project_settings',
    description: '[core] Update project name, description, or settings payload.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        settings: { type: 'object', description: 'UpdateSettingsPayload fields' },
      },
    },
  },
  {
    name: 'list_api_keys',
    description: '[core] List project API tokens (currentProject.tokens).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'create_api_key',
    description: '[core] Generate project API token (generateProjectToken). Returns sensitive token.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        duration: { type: 'string', description: 'YYYY-MM-DD expiry' },
        role: { type: 'string' },
      },
      required: ['name', 'duration', 'role'],
    },
  },
  {
    name: 'delete_api_key',
    description: '[core] Revoke project API token (deleteProjectToken).',
    inputSchema: {
      type: 'object',
      properties: {
        duration: { type: 'string' },
        token: { type: 'string' },
      },
      required: ['duration', 'token'],
    },
  },
  {
    name: 'get_auth_settings',
    description: '[core] Read project authentication settings (Google, local auth).',
    inputSchema: {
      type: 'object',
      properties: { project_id: PROJECT_ID_PARAM },
    },
  },
  {
    name: 'update_auth_settings',
    description: '[core] Update project authentication settings.',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'object', description: 'UpdateProjectAuthenticationInput' },
      },
      required: ['input'],
    },
  },
  {
    name: 'get_storage_settings',
    description: '[core] Read project storage/S3 settings.',
    inputSchema: {
      type: 'object',
      properties: { project_id: PROJECT_ID_PARAM },
    },
  },
  {
    name: 'update_storage_settings',
    description: '[core] Update project storage settings.',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'object', description: 'UpdateProjectStorageInput' },
      },
      required: ['input'],
    },
  },
  {
    name: 'list_team_members',
    description: '[core] List console team members for the project.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'update_team_members',
    description: '[core] Add or remove console team members via updateProject.',
    inputSchema: {
      type: 'object',
      properties: {
        add_team_member: { type: 'object' },
        remove_team_member: { type: 'object' },
      },
    },
  },
  // --- Integrations ---
  {
    name: 'list_webhooks',
    description: '[core] List project webhooks.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'create_webhook',
    description: '[core] Create webhook (createWebHook).',
    inputSchema: {
      type: 'object',
      properties: {
        events: { type: 'array', items: { type: 'string' } },
        model: { type: 'string' },
        name: { type: 'string' },
        url: { type: 'string' },
        logic_executions: { type: 'array', items: { type: 'string' } },
      },
      required: ['events', 'model', 'name', 'url'],
    },
  },
  {
    name: 'delete_webhook',
    description: '[core] Delete webhook by id.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'list_plugins',
    description: '[core] List installed project plugins by type enum.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'PLUGIN_TYPE_ENUM e.g. STORAGE, FUNCTION',
        },
      },
      required: ['type'],
    },
  },
  {
    name: 'configure_plugin',
    description: '[core] Enable/configure plugin (upsertPlugin).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        enable: { type: 'boolean' },
        activate_status: { type: 'string' },
        env_vars: {
          type: 'array',
          items: {
            type: 'object',
            properties: { key: { type: 'string' }, value: { type: 'string' } },
          },
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'remove_plugin',
    description: '[core] Remove project plugin (removeProjectSpecificPlugin).',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'list_functions',
    description: '[core] List project functions (projectFunctionsInfo).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'upsert_function',
    description: '[core] Create or update project function (upsertFunctionToProject).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        function_connected: { type: 'boolean' },
        function_provider_id: { type: 'string' },
        update: { type: 'boolean' },
      },
      required: ['name'],
    },
  },
  {
    name: 'delete_function',
    description: '[core] Delete project function.',
    inputSchema: {
      type: 'object',
      properties: { function: { type: 'string' } },
      required: ['function'],
    },
  },
  {
    name: 'list_media',
    description: '[core] List uploaded media files.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
        page: { type: 'number' },
        search: { type: 'string' },
      },
    },
  },
  {
    name: 'upload_media_from_url',
    description: '[core] Upload image from URL (uploadImageFromURL).',
    inputSchema: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url'],
    },
  },
  {
    name: 'delete_media',
    description: '[core] Delete media files by ids.',
    inputSchema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' } },
      },
      required: ['ids'],
    },
  },
  // --- Data plane extras ---
  {
    name: 'list_data',
    description:
      '[core] List/filter model records (getModelData). Prefer over get_data when paginating or filtering. Supports tenant_id for SaaS.',
    inputSchema: {
      type: 'object',
      properties: {
        model_name: { type: 'string' },
        page: { type: 'number' },
        limit: { type: 'number' },
        where: { type: 'object' },
        status: { type: 'string', enum: ['all', 'draft', 'published'] },
        search: { type: 'string' },
        tenant_id: TENANT_ID_PARAM,
      },
      required: ['model_name'],
    },
  },
  {
    name: 'connect_relation',
    description:
      '[core] Connect relations on a record via upsertModelData connect payload. Use get_relation_graph for field names.',
    inputSchema: {
      type: 'object',
      properties: {
        model_name: { type: 'string' },
        _id: { type: 'string', description: 'Document id (omit for create-with-connect)' },
        payload: { type: 'object', description: 'Document data fields' },
        connect: { type: 'object', description: 'Relation connect map' },
        tenant_id: TENANT_ID_PARAM,
      },
      required: ['model_name', 'connect'],
    },
  },
  {
    name: 'disconnect_relation',
    description: '[core] Disconnect relations on a record via upsertModelData disconnect payload.',
    inputSchema: {
      type: 'object',
      properties: {
        model_name: { type: 'string' },
        _id: { type: 'string' },
        disconnect: { type: 'object' },
        tenant_id: TENANT_ID_PARAM,
      },
      required: ['model_name', '_id', 'disconnect'],
    },
  },
  {
    name: 'get_model_document_counts',
    description: '[core] Document counts per model (modelDocumentCounts).',
    inputSchema: {
      type: 'object',
      properties: {
        models: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'list_document_revisions',
    description: '[core] List revision history for a document.',
    inputSchema: {
      type: 'object',
      properties: {
        _id: { type: 'string' },
        model: { type: 'string' },
      },
      required: ['_id'],
    },
  },
  {
    name: 'reorder_fields',
    description: '[core] Reorder field serial within a model (rearrangeSerialOfFieldType).',
    inputSchema: {
      type: 'object',
      properties: {
        model_name: { type: 'string' },
        field_name: { type: 'string' },
        serial: { type: 'number' },
      },
      required: ['model_name', 'field_name', 'serial'],
    },
  },
  {
    name: 'get_saas_auth_guide',
    description: '[pro] SaaS app user auth guide (local + Google login, tenant_id, token handling).',
    inputSchema: { type: 'object', properties: {} },
  },
];
