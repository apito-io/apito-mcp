# apito-mcp — AI Changelog

## 2026-07-28/29 — update_field nested parent + GraphQL map plan

- **Changed:** `update_field` accepts `parent_field` / `field_sub_type` for
  nested metadata updates (e.g. import measurement dropdowns). Planned
  (not coded) v1.6: `get_public_graphql_model_map`, `probe_public_document`,
  scope sticky lease/TTL — plan `improve_apito_mcp_gaps_62f8ec7c`.
- **Why:** Nested updates without `parent_field` staged wrong root fields;
  agents need public GraphQL field map beyond system schema CRUD.
- **Affected:** `src/index.ts` (update_field). Plan only for map/probe.
  Ask before commit / implement plan.

---

## 2026-07-28 — rename_model tool

- **Changed:** Added `rename_model({ model_name, new_name, project_id, scope_lease })`
  staging via system `updateModel(type: rename)`. Docs: README, CHANGELOG,
  SCHEMA_MIGRATION_GUIDE.
- **Why:** Console-parity rename for MCP agents (Suchok product→category).
- **Affected:** `src/index.ts`, package docs. MCP never publishes — user
  Publishes in Console. Requires engine rename DDL (not drop+create).

---

## 2026-07-22 — v1.5.1 deep nested projectModelsInfo

- **Changed:** Nested `sub_field_info` depth 5 + structural validation fields in GraphQL client.
- **Why:** Parity with CLI sync so MCP schema tools see deep repeated/object trees.
- **Affected:** `src/graphql-client.ts`, package **1.5.1**. Tagged/pushed.

---

## 2026-07-21 — Explicit project scope

### Changed

- Added exact project/tenant allowlists and canonical project GraphQL header
- Added prepare/confirm/get scope tools with TTL-bound write leases
- Centralized read/write/destructive/secret metadata and tool schema decoration
- Isolated clients/schema context per scoped call; removed implicit project lookup
- Added Worker project forwarding/cache/CORS isolation and focused tests/docs
- Gap fix: Worker no longer mutates env scope config; tenant-only client options
  keep default project; Worker responses set `Vary` for project/tenant isolation

### Why

Multi-project `apt_` tokens need fail-closed routing and explicit write confirmation
without a mutable current-project lock that can leak across concurrent calls.

### Affected

`src/project-scope.ts`, `graphql-client.ts`, `index.ts`, `platform-handlers.ts`,
`worker.ts`, `test-project-scope.ts`, package scripts, README/CHANGELOG,
`.knowledge/`, `.memory/`

---

## 2026-07-18 — Logic functions lifecycle tools

### Changed

- Added `src/graphql/functions.ts`; moved function ops out of `integrations.ts`
- Expanded `list_functions` / `upsert_function` (source, capabilities, runtime)
- New tools: `test_function_draft`, `deploy_function`, `execute_function`,
  `list_function_revisions`, `list_function_deployments`, `rollback_function`
- REST helper on GraphQL client; `APITO_REST_ENDPOINT` override; secret masking
- Feature doc, README workflow, CHANGELOG; `npm run test:functions`

### Why

Parity with Console Logic workspace so agents can author/test/deploy/invoke
Deno functions without new engine GraphQL.

### Affected

`src/graphql/functions.ts`, `graphql-client.ts`, `platform-tools.ts`,
`platform-handlers.ts`, `test-functions.ts`, `.knowledge/features/`, README,
CHANGELOG

---

## 2026-07-11 — v1.4.0 monorepo + search parity

### Changed

- Registered in monorepo as submodule; knowledge/memory scaffold
- Added **`search_tenants`** (`searchTenants` + `q`)
- **`search_app_users`** accepts **`q`** (searchUsers parity)
- `get_data` / `list_data`: document `where` over `search`; warn when search used
- Fixed monorepo MCP paths (was legacy `Projects/apito/apito-mcp`)

### Why

- Agents used `get_data` search on tenant model → all 131 rows; catalog needs system GraphQL
- User/tenant count verification needs `search_app_users` with free-text filter

### Affected

- `src/graphql/tenants.ts`, `app-users.ts`, `platform-tools.ts`, `platform-handlers.ts`, `index.ts`
- `.cursor/mcp.json`, udbhabon app mcp configs, `.gitmodules`

---

Last Updated: 2026-07-21
