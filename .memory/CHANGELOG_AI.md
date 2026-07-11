# apito-mcp — AI Changelog

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
