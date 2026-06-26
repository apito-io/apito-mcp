# Changelog

All notable changes to this project are documented in this file.

## [1.3.0] - 2026-06-26

### Added — platform management (~99% Console admin coverage)

v1.3 extends MCP from schema/data tooling to full **project administration** via system GraphQL. ~50 new platform tools are registered in `src/platform-tools.ts`, dispatched by `src/platform-handlers.ts`, and merged into `listTools` in `src/index.ts`.

#### Phase 1 — SaaS tenants & app users `[pro]` / `[core]`

**Tenant catalog** (pro engine resolvers: `getTenants`, `createTenant`, `updateTenant`, `deleteTenant`, `generateTenantToken`, `searchTenantsByDomain`):

| MCP tool | Purpose |
|----------|---------|
| `list_tenants` | List tenant catalog rows |
| `create_tenant` | Create tenant; provisions per-tenant DB when enabled |
| `update_tenant` | Update name, domain, metadata JSON |
| `delete_tenant` | Remove/deactivate catalog row |
| `generate_tenant_token` | Mint tenant-scoped API token (sensitive) |
| `search_tenant_by_domain` | Resolve tenant by hostname for login routing |

**App end-users** (open-core + pro hooks: `searchUsers`, `createUser`, `updateUser`, `deleteUser`, `resetUserPassword`, `loginUser`, `googleOAuthState`):

| MCP tool | Purpose |
|----------|---------|
| `search_app_users` | Paginated user search (`project_id`, optional `tenant_id`) |
| `create_app_user` | Create with password |
| `update_app_user` | Update profile/role |
| `delete_app_user` | Remove user |
| `reset_app_user_password` | Set new password |
| `login_app_user` | Test local login → JWT (sensitive) |
| `google_oauth_state` | OAuth state for Google login flow |
| `login_app_user_google` | Complete Google login with `code`+`state` or `id_token` |

- **`apito://saas-auth-guide`** resource and **`get_saas_auth_guide`** tool — local + Google OAuth steps, tenant routing, token sensitivity (`src/guides/saas-auth-guide.ts`)
- Per-request **`tenant_id`** on platform tools and existing data tools (`get_data`, `upsert_data`, `delete_data`, `duplicate_data`) via `GraphQLRequestOptions.tenantId` → `X-Apito-Tenant-ID`
- GraphQL clients: `src/graphql/tenants.ts`, `src/graphql/app-users.ts`

#### Phase 2 — Project admin

| MCP tool | Engine op (representative) |
|----------|---------------------------|
| `list_roles`, `upsert_role`, `duplicate_role`, `delete_role` | `currentProject.roles`, `upsertRoleToProject`, … |
| `get_permissions_catalog` | `listPermissionsAndScopes` |
| `get_project_settings`, `update_project_settings` | `currentProject`, `updateProject` |
| `list_api_keys`, `create_api_key`, `delete_api_key` | `generateProjectToken`, `deleteProjectToken` |
| `get_auth_settings`, `update_auth_settings` | Project authentication settings |
| `get_storage_settings`, `update_storage_settings` | Project storage/S3 settings |
| `list_team_members`, `update_team_members` | Console team on project |

- GraphQL client: `src/graphql/project-admin.ts`
- Schema versioning **read/safe-write** extras `[pro]`: `get_schema_diff`, `list_schema_versions`, `list_schema_change_events`, `discard_schema_draft`

#### Phase 3 — Integrations

| MCP tool | Purpose |
|----------|---------|
| `list_webhooks`, `create_webhook`, `delete_webhook` | Webhook CRUD |
| `list_plugins`, `configure_plugin`, `remove_plugin` | Plugin install/configure |
| `list_functions`, `upsert_function`, `delete_function` | Project functions |
| `list_media`, `upload_media_from_url`, `delete_media` | Media library |

- GraphQL client: `src/graphql/integrations.ts`

#### Phase 4 — Data plane extras

| MCP tool | Purpose |
|----------|---------|
| `list_data` | Filtered/paginated `getModelData` with `tenant_id` |
| `connect_relation`, `disconnect_relation` | Relation updates via upsert connect/disconnect |
| `get_model_document_counts` | Row counts per model |
| `list_document_revisions` | Document revision history |
| `reorder_fields` | Field serial reorder |

- GraphQL client: `src/graphql/data-plane.ts`

#### Phase 5 — Edition split

- **`APITO_MCP_EDITION`** env: `open` hides tools marked `proOnly: true`; default `pro` exposes full surface (`src/mcp-edition.ts`)
- Tool descriptions tagged `[pro]`, `[core]`, or `[core/pro]` for future open-mcp vs pro-mcp packages

#### Testing & docs

- `pnpm test:tenant-users` — edition filtering, handler registry, optional live `listTenants` / `searchAppUsers`
- README expanded with platform workflows, engine GraphQL mapping, routing, and excluded ops

### Excluded (intentionally not in MCP)

Destructive or human-reviewed Console workflows are **not** exposed:

- Schema **publish** (`approveSchemaChanges`), **rollback** (`rollbackSchemaVersion`), **flush sync** (`flushSchemaSync`), execution repair mutations
- `deleteProject`, billing/subscription operations, plugin **build** trigger

MCP stages schema drafts and reads versioning state; operators publish in Console. Only `discard_schema_draft` is included as a safe draft undo.

## [1.2.0] - 2026-06-21

### Added

- **`is_common_model`** on `create_model` — mark project-wide (common) models at creation on SaaS projects
- **`update_model`** tool — toggle `is_common_model` or `single_page_model` on existing models
- **`get_saas_model_guide`** tool and **`apito://saas-model-guide`** resource — LLM/user guide for common vs tenant-scoped models with examples (app release policy, hospital medicine catalog)
- **`list_models`** shows model scope: common, tenant-scoped, or tenant catalogue
- GraphQL client requests `is_common_model` on `projectModelsInfo` and model mutations

### Changed

- `get_project_context` points SaaS projects to the model classification guide
- Schema versioning guide references SaaS model scope

## [1.1.0] - 2026-06-03

### Added

- **Pro schema versioning**: stage mutations into a draft; MCP never publishes
- Tools: `get_schema_versioning_status`, `get_schema_preview`, `get_effective_schema`, `get_schema_change_plan`, `summarize_schema_draft_for_review`
- `source` parameter on `list_models`, `get_model_schema`, `get_relation_graph` (`live` | `draft` | `effective`)
- `schema-versioning.ts` overlay merge and draft-only model guards for data tools
- Resource `apito://schema-versioning-guide`
- SaaS: `X-Apito-Tenant-ID` on worker requests; stdio `TENANT_ID` / `APITO_TENANT_ID`
- `playground-mcp.ts` and `pnpm playground:mcp` for local MCP tool testing
- `test-schema-versioning.ts` and `pnpm test:versioning`

### Changed

- Schema mutations return staging-aware responses with publish reminders
- `upsert_data` / `get_data` / `delete_data` / `duplicate_data` require published (live) models
- Stdio server only auto-starts when run as main module (playground can import `ApitoMCPServer`)

## [1.0.0] - Initial release

- Model, field, relation, and data CRUD via system GraphQL
- Cloudflare Workers remote MCP deployment
- Content insert / query structure documentation
