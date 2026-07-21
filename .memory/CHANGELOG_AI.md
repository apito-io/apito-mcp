# apito-mcp — AI Changelog

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
