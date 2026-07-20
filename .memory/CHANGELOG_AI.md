# apito-mcp — AI Changelog

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

Last Updated: 2026-07-11
