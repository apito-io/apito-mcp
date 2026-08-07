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
    description:
      '[pro] List all SaaS tenant catalog rows (getTenants). Unbounded — prefer search_tenants for large catalogs or text filter.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'search_tenants',
    proOnly: true,
    description:
      '[pro] Paginated SaaS tenant catalog search (searchTenants). Optional q filters name, id, domain, and data. Optional status: active (default), deleted, or all. Use instead of get_data search on tenant model.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: PROJECT_ID_PARAM,
        limit: { type: 'number' },
        offset: { type: 'number' },
        q: { type: 'string', description: 'Free-text filter (case-insensitive contains)' },
        status: {
          type: 'string',
          description: 'Catalog status filter: active (default), deleted, or all',
        },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'create_tenant',
    proOnly: true,
    description:
      '[pro] Create a tenant catalog row (createTenant). Provisions pro_tenants + mirrored project tenant row. Do not use get_data/upsert_data on the tenant model for lifecycle.',
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
    description:
      '[pro] Soft-delete tenant catalog row (deleteTenant). Sets status=deleted; content and mirror remain. Permanent purge requires Console hard delete — not exposed as an MCP tool.',
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
    description:
      '[core/pro] Search project app end-users (searchUsers). Optional tenant_id and q (email, username, phone, id). Prefer over get_data on user model.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: PROJECT_ID_PARAM,
        limit: { type: 'number' },
        offset: { type: 'number' },
        tenant_id: TENANT_ID_PARAM,
        q: { type: 'string', description: 'Free-text filter (case-insensitive contains)' },
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
    description:
      '[core] Read project authentication settings (general + Google/Facebook/GitHub/X/LinkedIn OAuth).',
    inputSchema: {
      type: 'object',
      properties: { project_id: PROJECT_ID_PARAM },
    },
  },
  {
    name: 'update_auth_settings',
    description:
      '[core] Update project authentication settings (UpdateProjectAuthenticationInput; flat per-provider fields).',
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
    description:
      '[core] List project functions (projectFunctionsInfo). Returns source, capabilities, active_revision_id, trigger_type, runtime_config and rest_api_secret_url_key. Pass name to filter to a single function.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Optional: filter to one function by name.' },
      },
    },
  },
  {
    name: 'upsert_function',
    description:
      '[core] Create or update a project Logic function (upsertFunctionToProject). Saves the DRAFT source; call deploy_function to publish a revision. Set update=true when editing an existing function.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        source: {
          type: 'string',
          description: 'Draft function source (Deno/TS) for apito-functions runtime.',
        },
        capabilities: {
          type: 'array',
          items: { type: 'string' },
          description: 'Granted capabilities, e.g. ["data.read"].',
        },
        language: { type: 'string', description: 'e.g. "typescript".' },
        trigger_type: { type: 'string', description: 'e.g. "function" / "callable".' },
        runtime: {
          type: 'string',
          description: 'Runtime label recorded in runtime_config.runtime (e.g. "apito-deno").',
        },
        graphql_schema_type: { type: 'string' },
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
    name: 'test_function_draft',
    description:
      '[core] Admin DRAFT test via GraphQL (testFunctionDraft). Privileged project-admin session; no X-Fn-Hash / app-user JWT. Pass tenant_id for SaaS so the server validates and scopes data reads. Distinct from live execute_function.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        source: {
          type: 'string',
          description: 'Optional source override; defaults to the saved draft.',
        },
        payload: {
          type: 'object',
          description: 'Mock request payload passed to the handler.',
        },
        tenant_id: {
          type: 'string',
          description:
            'Admin-selected SaaS tenant for draft test (validated server-side). Not used as live end-user identity.',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'deploy_function',
    description:
      '[core] Deploy the current draft (or given source) as a new immutable revision and mark it active (deployFunctionToProject). Returns function/revision/deployment incl. active_revision_id.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        source: {
          type: 'string',
          description: 'Optional source to deploy; defaults to the saved draft.',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'execute_function',
    description:
      '[core] Live invoke of a DEPLOYED function via REST (POST /function/:project/:name). Sends X-Fn-Hash plus Authorization Bearer app-user JWT for SaaS (tenant/user from JWT claims only). Do not pass tenant_id as authoritative identity. System apt_ access tokens are for draft testing / management, not live SaaS identity.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        payload: { type: 'object', description: 'Request body sent to the function.' },
        app_user_token: {
          type: 'string',
          description:
            'App end-user JWT (Bearer). Required for SaaS live calls; tenant comes from token claims. Never echoed in tool output.',
        },
        fn_hash: {
          type: 'string',
          description: 'Optional explicit X-Fn-Hash; otherwise resolved from the function row.',
        },
        reveal_secret: {
          type: 'boolean',
          description: 'If true, include the resolved secret in the response (default: masked).',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_function_revisions',
    description: '[core] List immutable revisions for a function (listFunctionRevisions).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_function_deployments',
    description: '[core] List deployment history for a function (listFunctionDeployments).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['name'],
    },
  },
  {
    name: 'rollback_function',
    description:
      '[core] Roll back a function to a prior revision, making it active again (rollbackFunctionDeployment).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        revision_id: { type: 'string' },
      },
      required: ['name', 'revision_id'],
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
      '[core] List/filter model records (getModelData). Prefer where JSON filters over search (search is unreliable on JSON fields). SaaS tenant catalog lifecycle → create_tenant/update_tenant/delete_tenant; catalog search → search_tenants. App users → search_app_users. get_data on tenant is mirror/debug only. Supports tenant_id for SaaS.',
    inputSchema: {
      type: 'object',
      properties: {
        model_name: { type: 'string' },
        page: { type: 'number' },
        limit: { type: 'number' },
        where: { type: 'object', description: 'Preferred filter — e.g. { "email": { "contains": "x" } }' },
        status: { type: 'string', enum: ['all', 'draft', 'published'] },
        search: {
          type: 'string',
          description: 'Legacy text search — unreliable; prefer where or platform tools (search_tenants, search_app_users)',
        },
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
  // --- System logs [pro] — system-scoped read (no write lease) ---
  {
    name: 'search_system_logs',
    proOnly: true,
    description:
      '[pro] Search structured system logs (searchSystemLogs). System-scoped read — project_id optional filter only. Max 50 rows; large text fields truncated.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Optional filter — not required for system-scoped read.',
        },
        tenant_id: TENANT_ID_PARAM,
        trace_id: { type: 'string' },
        request_id: { type: 'string' },
        scope_key: { type: 'string' },
        user_id: { type: 'string' },
        role_id: { type: 'string' },
        sources: { type: 'array', items: { type: 'string' } },
        kinds: { type: 'array', items: { type: 'string' } },
        levels: { type: 'array', items: { type: 'string' } },
        statuses: { type: 'array', items: { type: 'string' } },
        environment: { type: 'string' },
        method: { type: 'string' },
        status_code: { type: 'number' },
        model: { type: 'string' },
        driver_engine: { type: 'string' },
        nats_subject: { type: 'string' },
        from_ns: { type: 'string', description: 'Start of time window (nanoseconds since epoch)' },
        to_ns: { type: 'string', description: 'End of time window (nanoseconds since epoch)' },
        min_duration_us: { type: 'number' },
        text: { type: 'string', description: 'Full-text search against FTS index' },
        cursor: { type: 'string', description: 'Opaque pagination cursor from prior search' },
        limit: { type: 'number', description: 'Page size (max 50)' },
        ascending: { type: 'boolean', description: 'Sort oldest→newest when true' },
      },
    },
  },
  {
    name: 'get_system_log',
    proOnly: true,
    description:
      '[pro] Fetch one log event by id (systemLog). System-scoped read. Payload fields truncated to 4 KiB each.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Log event id' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_system_trace',
    proOnly: true,
    description:
      '[pro] Fetch events sharing a trace_id (systemLogTrace). System-scoped read. Max 50 rows.',
    inputSchema: {
      type: 'object',
      properties: {
        trace_id: { type: 'string' },
      },
      required: ['trace_id'],
    },
  },
  {
    name: 'summarize_system_logs',
    proOnly: true,
    description:
      '[pro] Aggregate log counts (systemLogStats aggregates). System-scoped read. Use group_by (source, kind, level, status, project_id, tenant_id, model, status_code) or interval_s for time buckets. Max 50 buckets.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Optional filter — not required for system-scoped read.',
        },
        tenant_id: TENANT_ID_PARAM,
        trace_id: { type: 'string' },
        sources: { type: 'array', items: { type: 'string' } },
        kinds: { type: 'array', items: { type: 'string' } },
        levels: { type: 'array', items: { type: 'string' } },
        statuses: { type: 'array', items: { type: 'string' } },
        from_ns: { type: 'string' },
        to_ns: { type: 'string' },
        text: { type: 'string' },
        group_by: {
          type: 'string',
          description:
            'Group dimension: source, kind, level, status, project_id, tenant_id, model, status_code',
        },
        interval_s: {
          type: 'number',
          description: 'When > 0, bucket by time interval (seconds) instead of group_by',
        },
      },
    },
  },
  {
    name: 'get_log_store_health',
    proOnly: true,
    description:
      '[pro] Log store health and counters snapshot (systemLogStats health/store). System-scoped read.',
    inputSchema: { type: 'object', properties: {} },
  },
];
